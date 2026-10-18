# Where this snapshot comes from

**Do not edit any file in this directory.** The upstream pages are copied verbatim. An edit makes
the next diff noise, and the snapshot stops being evidence of what upstream says.

|item|value|
|---|---|
|upstream|[`Alchyr/BaseLib-Wiki`](https://github.com/Alchyr/BaseLib-Wiki) (MIT)|
|branch|`main`|
|commit|`5834ad4b8c77e5204347a2426e8434fbb246a554`|
|fetched|2026-10-18|
|upstream commit date|2026-09-11T09:59:00Z|
|pages|35|

## How to tell whether this snapshot is stale

The upstream wiki follows the BaseLib releases. Use this procedure:

1. Read the `version` field in `vendor/baselib/BaseLib.json`.
2. If that version is newer than the one this snapshot matches, compare against upstream:

```sh
node scripts/sync-base-lib-wiki.mjs --check
```

The command exits with code 1 when upstream and this snapshot differ. Run the same command without
`--check` to fetch the new pages.

## Pages that may be empty upstream

Some pages have a heading and no text below it. Two examples are the Spine section in
`scenes/creature-visuals.md` and the `CardModel Documentation` section in
`models/custom-card.md`. An empty section means upstream has not written it yet. It is not a
missing file. For those topics, read the decompiled assembly instead.

## Index

The hand-written index is [`INDEX.md`](INDEX.md). Read it first. Do not page through the
snapshot.
