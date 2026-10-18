# 这份快照从哪来

**不得手改这个目录里的任何文件。** 它们是从上游逐字复制的；改了之后下次 diff 就全是噪音，
快照也就不再是「上游怎么说」的证据。

| 项 | 值 |
|---|---|
| 上游 | [`Alchyr/BaseLib-Wiki`](https://github.com/Alchyr/BaseLib-Wiki)（MIT） |
| 分支 | `main` |
| commit | `5834ad4b8c77e5204347a2426e8434fbb246a554` |
| 抓取时间 | 2026-10-18 |
| 上游提交时间 | 2026-09-11T09:59:00Z |
| 页面数 | 35 |

## 过没过期怎么判断

上游的 wiki 跟着 BaseLib 的 release 走。所以：

1. 看 `vendor/baselib/BaseLib.json` 里的 `version`。
2. 如果它比这份快照对应的版本新，就跑一次同步，再看有无改动：

```sh
node scripts/sync-base-lib-wiki.mjs --check   # 只比对，不写盘
node scripts/sync-base-lib-wiki.mjs           # 真的抓一遍
```

## 哪些页可能没有内容

上游有些页只有标题（例如 `scenes/creature-visuals.md` 的 Spine 一节、`models/custom-card.md`
的 `CardModel Documentation`）。**空着就是上游还没写**，不是我们漏抓 —— 遇到这种情况只能反编译。

## 索引

自己写的导读在 [`INDEX.md`](INDEX.md)。先读它，别一页页翻。
