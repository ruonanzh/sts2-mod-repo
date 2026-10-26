import { deflateSync, inflateSync } from "node:zlib";

export interface PngImage {
  width: number;
  height: number;
  rgba: Buffer;
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const MAX_IMAGE_PIXELS = 16_777_216;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function checkDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > MAX_IMAGE_PIXELS)
    throw new Error(`invalid or excessive PNG dimensions ${width}x${height}`);
}

export function decodePng(buf: Buffer): PngImage {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error("not a PNG");
  let at = 8;
  let ihdr: { width: number; height: number; bitDepth: number; colorType: number; interlace: number } | null = null;
  const idat: Buffer[] = [];
  while (at + 12 <= buf.length) {
    const len = buf.readUInt32BE(at);
    if (at + 12 + len > buf.length) throw new Error("truncated PNG chunk");
    const type = buf.toString("ascii", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      if (data.length !== 13) throw new Error("invalid IHDR");
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  if (!ihdr) throw new Error("no IHDR");
  checkDimensions(ihdr.width, ihdr.height);
  if (ihdr.bitDepth !== 8) throw new Error(`only 8-bit PNG is supported, got ${ihdr.bitDepth}`);
  if (ihdr.interlace) throw new Error("interlaced PNG is not supported");
  if (ihdr.colorType !== 6 && ihdr.colorType !== 2) throw new Error(`only RGB and RGBA are supported, got colorType ${ihdr.colorType}`);
  if (idat.length === 0) throw new Error("no IDAT");

  const bpp = ihdr.colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * bpp;
  if (raw.length !== ihdr.height * (stride + 1)) throw new Error("unexpected PNG data length");
  const out = Buffer.alloc(ihdr.height * stride);
  let pos = 0;
  for (let y = 0; y < ihdr.height; y += 1) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let value = row[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) value += paeth(a, b, c);
      else if (filter !== 0) throw new Error(`unknown row filter ${filter}`);
      cur[x] = value & 0xff;
    }
  }

  const rgba = Buffer.alloc(ihdr.width * ihdr.height * 4);
  for (let i = 0, j = 0; i < out.length; i += bpp, j += 4) {
    rgba[j] = out[i];
    rgba[j + 1] = out[i + 1];
    rgba[j + 2] = out[i + 2];
    rgba[j + 3] = bpp === 4 ? out[i + 3] : 255;
  }
  return { width: ihdr.width, height: ihdr.height, rgba };
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const body = Buffer.concat([head.subarray(4), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, data, tail]);
}

export function parseBackground(hex = "#000000"): [number, number, number] {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`background must be a six-digit hex color, got ${hex}`);
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}

export function encodePng({ width, height, rgba }: PngImage, options: { opaque?: boolean; background?: string } = {}): Buffer {
  checkDimensions(width, height);
  if (rgba.length !== width * height * 4) throw new Error("RGBA buffer length does not match dimensions");
  const opaque = options.opaque ?? false;
  const background = opaque ? parseBackground(options.background) : [0, 0, 0];
  const bpp = opaque ? 3 : 4;
  const stride = width * bpp;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = row + 1 + x * bpp;
      const alpha = rgba[source + 3] / 255;
      for (let channel = 0; channel < 3; channel += 1) {
        raw[target + channel] = opaque
          ? Math.round(rgba[source + channel] * alpha + background[channel] * (1 - alpha))
          : rgba[source + channel];
      }
      if (!opaque) raw[target + 3] = rgba[source + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Center-crop to the target aspect, then box-downsample to the exact size. */
export function cropCover(img: PngImage, targetWidth: number, targetHeight: number): PngImage {
  checkDimensions(targetWidth, targetHeight);
  const targetAspect = targetWidth / targetHeight;
  const sourceAspect = img.width / img.height;
  let cropWidth = img.width;
  let cropHeight = img.height;
  if (sourceAspect > targetAspect) cropWidth = Math.max(1, Math.round(img.height * targetAspect));
  else cropHeight = Math.max(1, Math.round(img.width / targetAspect));
  const cx = Math.floor((img.width - cropWidth) / 2);
  const cy = Math.floor((img.height - cropHeight) / 2);
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  const xRatio = cropWidth / targetWidth;
  const yRatio = cropHeight / targetHeight;
  for (let ty = 0; ty < targetHeight; ty += 1) {
    const y0 = cy + Math.floor(ty * yRatio);
    const y1 = Math.min(cy + cropHeight, cy + Math.max(Math.floor((ty + 1) * yRatio), Math.floor(ty * yRatio) + 1));
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const x0 = cx + Math.floor(tx * xRatio);
      const x1 = Math.min(cx + cropWidth, cx + Math.max(Math.floor((tx + 1) * xRatio), Math.floor(tx * xRatio) + 1));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * img.width + sx) * 4;
          const alpha = img.rgba[index + 3];
          r += img.rgba[index] * alpha;
          g += img.rgba[index + 1] * alpha;
          b += img.rgba[index + 2] * alpha;
          a += alpha;
          count += 1;
        }
      }
      const target = (ty * targetWidth + tx) * 4;
      if (count === 0) continue;
      if (a > 0) {
        out[target] = Math.round(r / a);
        out[target + 1] = Math.round(g / a);
        out[target + 2] = Math.round(b / a);
      }
      out[target + 3] = Math.round(a / count);
    }
  }
  return { width: targetWidth, height: targetHeight, rgba: out };
}

/** Keep the whole image and add transparent bands. */
export function letterbox(img: PngImage, targetWidth: number, targetHeight: number): PngImage {
  checkDimensions(targetWidth, targetHeight);
  const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const ox = Math.floor((targetWidth - width) / 2);
  const oy = Math.floor((targetHeight - height) / 2);
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor((y * img.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * img.height) / height));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor((x * img.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * img.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const index = (sy * img.width + sx) * 4;
          const alpha = img.rgba[index + 3];
          r += img.rgba[index] * alpha;
          g += img.rgba[index + 1] * alpha;
          b += img.rgba[index + 2] * alpha;
          a += alpha;
          count += 1;
        }
      }
      const target = ((oy + y) * targetWidth + ox + x) * 4;
      if (a > 0) {
        out[target] = Math.round(r / a);
        out[target + 1] = Math.round(g / a);
        out[target + 2] = Math.round(b / a);
      }
      out[target + 3] = Math.round(a / count);
    }
  }
  return { width: targetWidth, height: targetHeight, rgba: out };
}
