/**
 * Slay the Spire 2 mod-page editor.
 *
 * Displays one generated page and collects comments, replacements, and control values.
 * Feedback is saved in the same HTML file under the `pi-page-feedback` script id.
 * The host bridge supplies the file, revision, theme, and write permission.
 */
const FEEDBACK_ID = "pi-page-feedback";
const SCRIPT_RE = new RegExp(`<script[^>]*id="${FEEDBACK_ID}"[^>]*>[\\s\\S]*?</script>\\s*`, "i");
const BLOCK_RE = new RegExp(`<script[^>]*id="${FEEDBACK_ID}"[^>]*>([\\s\\S]*?)</script>`, "i");

const state = document.getElementById("state");
const count = document.getElementById("count");
const saveButton = document.getElementById("save");
const removeButton = document.getElementById("remove");
const reloadButton = document.getElementById("reload");
const page = document.getElementById("page");
const scroll = document.getElementById("scroll");
const toolbar = document.getElementById("toolbar");
const promptForm = document.getElementById("prompt");
const promptLabel = document.getElementById("promptLabel");
const promptText = document.getElementById("promptText");

let pagePath = "";
let revision = null;
let source = "";
let writable = false;
let comments = [];
let baseline = {};
let pending = null;
let pendingReload = null;
let savedSinceLoad = false;
let selectedId = null;
let lastRange = null;
let seq = 0;
const waiting = new Map();

function post(message) {
  window.parent.postMessage(message, "*");
}

function request(type, payload) {
  const requestId = `r${++seq}`;
  return new Promise((resolve) => {
    waiting.set(requestId, resolve);
    post({ type, requestId, ...payload });
  });
}

function settle(requestId, value) {
  const resolve = waiting.get(requestId);
  if (resolve) {
    waiting.delete(requestId);
    resolve(value);
  }
}

function say(text) {
  state.textContent = text;
}

/** Reload from disk. Discard unsent comments by convention. */
function reloadFromDisk(reason) {
  pendingReload = reason;
  post({ type: "editor:readFile", requestId: `r${++seq}` });
}

reloadButton.addEventListener("click", () => reloadFromDisk("manual"));

/* ---------- Read and write the file ---------- */

function readBlock(content) {
  const match = content.match(BLOCK_RE);
  if (!match) return { comments: [], controls: {} };
  try {
    const parsed = JSON.parse(match[1]);
    return {
      comments: Array.isArray(parsed && parsed.comments) ? parsed.comments : [],
      controls:
        parsed && typeof parsed.controls === "object" && parsed.controls !== null ? parsed.controls : {},
    };
  } catch {
    return { comments: [], controls: {} };
  }
}

function withBlock(content, nextComments, controls) {
  const cleaned = content.replace(SCRIPT_RE, "");
  if (nextComments.length === 0 && Object.keys(controls).length === 0) return cleaned;
  const payload = JSON.stringify({ version: 1, comments: nextComments, controls }, null, 2);
  const block = `<script type="application/json" id="${FEEDBACK_ID}">\n${payload}\n</script>\n`;
  const bodyEnd = cleaned.toLowerCase().lastIndexOf("</body>");
  if (bodyEnd === -1) return `${cleaned.replace(/\s*$/, "\n")}${block}`;
  return `${cleaned.slice(0, bodyEnd)}${block}${cleaned.slice(bodyEnd)}`;
}

/* ---------- Render the page ---------- */

function renderPage(content) {
  const doc = new DOMParser().parseFromString(content, "text/html");
  doc.querySelector(`#${FEEDBACK_ID}`)?.remove();
  doc.querySelectorAll("script").forEach((element) => element.remove());

  page.replaceChildren();
  doc.head.querySelectorAll("style").forEach((element) => page.append(element.cloneNode(true)));
  Array.from(doc.body.childNodes).forEach((node) => page.append(node.cloneNode(true)));
}

/* ---------- Form controls ---------- */

/** Read every named control so choices survive in the feedback block. */
function readControls() {
  const values = {};
  page.querySelectorAll("input[name], select[name], textarea[name]").forEach((element) => {
    const name = element.getAttribute("name");
    if (!name) return;
    if (element.type === "checkbox" || element.type === "radio") {
      if (element.checked) values[name] = element.value || "on";
      else if (!(name in values)) values[name] = "";
      return;
    }
    values[name] = element.value;
  });
  return values;
}

function applyControls(values) {
  if (!values) return;
  page.querySelectorAll("input[name], select[name], textarea[name]").forEach((element) => {
    const name = element.getAttribute("name");
    if (!name || !(name in values)) return;
    const saved = values[name];
    if (element.type === "checkbox" || element.type === "radio") {
      element.checked = saved !== "" && saved === (element.value || "on");
      return;
    }
    element.value = saved;
  });
}

function sameControls(left, right) {
  const names = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const name of names) if ((left[name] ?? "") !== (right[name] ?? "")) return false;
  return true;
}

/* ---------- Comments ---------- */

/** Join page text nodes so each quote can be located. */
function textIndex() {
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "";
  let node = walker.nextNode();
  while (node) {
    nodes.push({ node, from: text.length });
    text += node.nodeValue;
    node = walker.nextNode();
  }
  return { nodes, text };
}

/** Find the start of the requested quote occurrence. */
function findQuoteStart(quote, occurrence) {
  const { text } = textIndex();
  let at = -1;
  let seen = 0;
  for (;;) {
    at = text.indexOf(quote, at + 1);
    if (at === -1) return null;
    if (seen === occurrence) return at;
    seen += 1;
  }
}

/** Table structure elements cannot contain comment marks. */
const TABLE_STRUCTURE = new Set(["TABLE", "TBODY", "THEAD", "TFOOT", "TR", "COLGROUP", "CAPTION"]);

/** Split a global range across text nodes without changing surrounding tags. */
function segmentsFor(start, length) {
  const { nodes } = textIndex();
  const end = start + length;
  const out = [];
  for (const { node, from } of nodes) {
    const nodeEnd = from + node.nodeValue.length;
    if (nodeEnd <= start || from >= end) continue;
    const slice = node.nodeValue.slice(Math.max(0, start - from), Math.min(node.nodeValue.length, end - from));
    // Skip whitespace so highlighting does not change layout.
    if (!slice.trim()) continue;
    // Do not insert marks into table structure.
    if (TABLE_STRUCTURE.has(node.parentNode?.tagName)) continue;
    out.push({
      node,
      start: Math.max(0, start - from),
      end: Math.min(node.nodeValue.length, end - from),
    });
  }
  return out;
}

/** Highlight a comment one text segment at a time. */
function wrapQuote(quote, comment, occurrence) {
  if (!quote) return false;
  const start = findQuoteStart(quote, occurrence ?? 0);
  if (start === null) return false;
  segmentsFor(start, quote.length).forEach(({ node, start: from, end: to }) => {
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const element = document.createElement("mark");
    element.dataset.comment = comment.id;
    element.dataset.kind = comment.kind;
    element.title = comment.text || comment.kind;
    range.surroundContents(element);
  });
  return true;
}

/** Return the global text offset for repeated-quote tracking. */
function globalOffset(node, offset) {
  const { nodes, text } = textIndex();
  for (const entry of nodes) {
    if (entry.node === node) return entry.from + offset;
  }
  return Math.min(offset, text.length);
}

function paintComments() {
  page.querySelectorAll("mark[data-comment]").forEach((element) => {
    const parent = element.parentNode;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
    parent.normalize();
  });
  comments.forEach((comment) => wrapQuote(comment.quote, comment, comment.occurrence ?? 0));
  updateBar();
}

function updateBar() {
  count.textContent = comments.length === 0 ? "" : `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
  // Keep the button enabled for empty feedback unless the file is read-only.
  saveButton.disabled = !writable;
  removeButton.hidden = selectedId === null;
}

const SEND_ERROR_TEXT = {
  AGENT_BUSY: "Saved to the page. The agent is busy. Try sending again shortly.",
  NO_SESSION: "Saved to the page. Send /page-annotated in the conversation yourself.",
  NOT_ALLOWED: "Saved to the page. This panel cannot notify the agent. Send /page-annotated yourself.",
  SEND_FAILED: "Saved to the page. The notification failed. Send /page-annotated yourself.",
};

const SAVE_ERROR_TEXT = {
  READ_ONLY: "This file is outside the mod and cannot be changed.",
  WRITE_DENIED: "Only files under your_mods/ can be changed.",
  CONFLICT: "The page changed on disk. Reopen it and add your feedback again.",
  TOO_LARGE: "The page is too large to save.",
};

/** Identify which occurrence of a repeated quote was selected. */
function occurrenceFor(range) {
  const quote = range.toString();
  if (!quote) return 0;
  if (typeof range.startContainer.nodeValue !== "string") return 0;
  const start = globalOffset(range.startContainer, range.startOffset);
  const { text } = textIndex();
  let seen = 0;
  let at = text.indexOf(quote);
  while (at !== -1 && at < start) {
    seen += 1;
    at = text.indexOf(quote, at + 1);
  }
  return seen;
}

function addComment(kind, quote, text, occurrence) {
  comments.push({
    id: `c${Date.now().toString(36)}${comments.length}`,
    kind,
    quote,
    text: text || "",
    ...(occurrence ? { occurrence } : {}),
  });
  paintComments();
  say("Added. Select Send to Agent when you are ready.");
}

function closePrompt() {
  pending = null;
  lastRange = null;
  promptForm.hidden = true;
}

document.getElementById("promptCancel").addEventListener("click", closePrompt);

// Close the prompt after an outside click.
document.addEventListener("mousedown", (event) => {
  if (promptForm.hidden) return;
  if (promptForm.contains(event.target)) return;
  closePrompt();
});

// Close the prompt when focus leaves it.
promptForm.addEventListener("focusout", (event) => {
  if (promptForm.contains(event.relatedTarget)) return;
  if (document.activeElement && promptForm.contains(document.activeElement)) return;
  closePrompt();
});

function commitPrompt() {
  if (!pending) return;
  addComment(pending.kind, pending.quote, promptText.value.trim(), pending.occurrence);
  closePrompt();
  window.getSelection()?.removeAllRanges();
}

// Avoid a form because the editor sandbox blocks form submission.
document.getElementById("promptAdd").addEventListener("click", commitPrompt);

promptText.addEventListener("keydown", (event) => {
  if (event.key === "Enter") commitPrompt();
  if (event.key === "Escape") closePrompt();
});

/* ---------- Selection toolbar ---------- */

function hideToolbar() {
  toolbar.hidden = true;
}

function currentRange() {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (!range.collapsed && page.contains(range.commonAncestorContainer)) {
      lastRange = range.cloneRange();
      return range;
    }
  }
  return null;
}

function showToolbar() {
  const range = currentRange();
  if (!range) {
    hideToolbar();
    return;
  }
  // Position relative to the scrolling container.
  const box = typeof range.getBoundingClientRect === "function" ? range.getBoundingClientRect() : null;
  const frame = typeof scroll.getBoundingClientRect === "function" ? scroll.getBoundingClientRect() : null;
  toolbar.hidden = false;
  if (!box || !frame) return; // Show without positioning when geometry is unavailable.
  const width = toolbar.offsetWidth || 200;
  const left = box.left - frame.left + scroll.scrollLeft;
  const top = box.bottom - frame.top + scroll.scrollTop + 6;
  toolbar.style.left = `${Math.max(8, Math.min(left, scroll.clientWidth - width - 8))}px`;
  toolbar.style.top = `${Math.max(8, top)}px`;
}

function askForText(kind) {
  // Use the saved range because the button click clears the selection.
  if (!lastRange) return;
  pending = { kind, quote: lastRange.toString(), occurrence: occurrenceFor(lastRange) };
  if (!pending.quote) return;
  promptLabel.textContent = kind === "replace" ? "Replace with" : "Comment";
  promptText.value = "";
  promptForm.hidden = false;
  promptText.focus();
  hideToolbar();
}

toolbar.addEventListener("mousedown", (event) => {
  // Preserve the text selection.
  event.preventDefault();
});

toolbar.addEventListener("click", (event) => {
  const kind = event.target.dataset?.kind;
  if (!kind) return;
  if (kind === "delete") {
    if (!lastRange) return;
    const quote = lastRange.toString();
    if (!quote) return;
    addComment("delete", quote, "", occurrenceFor(lastRange));
    lastRange = null;
    window.getSelection()?.removeAllRanges();
    hideToolbar();
    return;
  }
  askForText(kind);
});

document.addEventListener("selectionchange", () => {
  if (!promptForm.hidden) return;
  showToolbar();
});

page.addEventListener("change", () => {
  updateBar();
  if (comments.length === 0) say("Choice changed. Select Send to Agent when you are ready.");
});

page.addEventListener("click", (event) => {
  const mark = event.target.closest?.("mark[data-comment]");
  selectedId = mark ? mark.dataset.comment : null;
  if (selectedId) {
    const found = comments.find((item) => item.id === selectedId);
    say(found ? `${found.kind}: ${found.text || found.quote}` : "");
  }
  updateBar();
});

removeButton.addEventListener("click", () => {
  comments = comments.filter((item) => item.id !== selectedId);
  selectedId = null;
  paintComments();
  say("Comment removed.");
});

/* ---------- Save ---------- */

saveButton.addEventListener("click", async () => {
  if (!writable) {
    say("This file is outside the mod and cannot be changed.");
    return;
  }
  const controls = readControls();
  if (comments.length === 0 && sameControls(controls, baseline)) {
    say("Add a comment or change a choice before sending.");
    return;
  }
  saveButton.disabled = true;
  say("Sending…");
  const next = withBlock(source, comments, controls);
  const result = await request("editor:save", { data: next, baseRevision: revision });
  if (result?.type === "editor:saved") {
    revision = result.revision;
    source = next;
    baseline = readControls();
    savedSinceLoad = true;
    say("Saved to the page. Notifying the agent…");
    const text = pagePath ? `/page-annotated ${JSON.stringify(pagePath)}` : "/page-annotated";
    const sent = await request("editor:sendPrompt", { text });
    if (sent?.type === "editor:sent") {
      say("Sent to the agent. It will read the feedback and decide what to update.");
    } else {
      const code = sent?.code ?? "NO_REPLY";
      say(SEND_ERROR_TEXT[code] ?? `Saved to the page. Notification failed (${code}). Send /page-annotated yourself.`);
    }
  } else {
    const code = result?.code ?? "SAVE_FAILED";
    say(SAVE_ERROR_TEXT[code] ?? `Save failed: ${code}`);
  }
  saveButton.disabled = !writable;
});

/* ---------- Host bridge ---------- */

/** Apply the host theme and font stack. */
function setTheme(data) {
  if (data.theme) document.body.dataset.theme = data.theme;
  if (typeof data.fontFamily === "string" && data.fontFamily) {
    document.documentElement.style.setProperty("--app-font", data.fontFamily);
  }
}

window.addEventListener("message", (event) => {
  const data = event.data ?? {};
  if (data.type === "editor:init") {
    writable = data.writable === true;
    pagePath = typeof data.file?.path === "string" ? data.file.path : "";
    setTheme(data);
    if (!writable) saveButton.title = "This file is outside the mod and cannot be changed.";
    post({ type: "editor:readFile", requestId: `r${++seq}` });
    return;
  }
  if (data.type === "editor:theme") {
    setTheme(data);
    return;
  }
  if (data.type === "editor:fileContent") {
    const reload = pendingReload;
    pendingReload = null;
    const incoming = data.revision ?? null;
    // Ignore an unchanged notification caused by our own save.
    if (reload === "changed" && incoming !== null && incoming === revision) return;
    const dropped = comments.length > 0 && !savedSinceLoad;
    revision = incoming;
    source = typeof data.data === "string" ? data.data : "";
    const block = readBlock(source);
    comments = block.comments;
    renderPage(source);
    applyControls(block.controls);
    baseline = readControls();
    savedSinceLoad = false;
    paintComments();
    if (reload) {
      const head = reload === "changed" ? "The page was rewritten" : "Page reloaded";
      say(dropped ? `${head}. Unsent comments were discarded.` : `${head}. It is current.`);
    } else {
      say(comments.length ? "Previous comments are shown." : "Select text to add a comment.");
    }
    return;
  }
  if (data.type === "editor:fileChanged") {
    // Reload after an external rewrite and discard old comments.
    reloadFromDisk("changed");
    return;
  }
  if (data.type === "editor:saved" || data.type === "editor:sent" || data.type === "editor:error") {
    settle(data.requestId, data);
  }
});
