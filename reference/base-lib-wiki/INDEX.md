# BaseLib wiki 快照 · 索引

上游：[`Alchyr/BaseLib-Wiki`](https://github.com/Alchyr/BaseLib-Wiki)（MIT）。
本目录里的页是**逐字快照**，出处与版本见 [`SOURCE.md`](SOURCE.md)。**不得手改。**

## 怎么用这一页

**两步，别跳第一步。**

1. **按玩家的需求找页。** 看下面「按想做什么找」那张表。命中就读那一页 —— 只读命中那几页，不要整套翻。
2. **再查真名。** wiki 里写的类名、方法名、参数可能与本机这个版本不一致。
   动手前一定用 `inspect_api` 查一遍：`action=search` 出场类型名，`action=members` 看签名，`action=source` 读实现。

**为什么不能只信 wiki**：它是给「想学 modding 的人」写的，会省略版本差异，也有些页只有代码片段没有前提。
本仓的原则是「不猜类名」——wiki 给方向，`inspect_api` 给事实。

**wiki 没写的地方不要编。** 见下面「空白清单」，那几处只能反编译。

## 按想做什么找

| 玩家想做的事 | 先读这几页 |
|---|---|
| 加一张卡 | [`models/custom-card.md`](models/custom-card.md) → [`models/index.md`](models/index.md)（模型总则、ID 前缀） |
| 改一张已有卡 | 同上；还要看 [`mechanics.md`](mechanics.md)（动态变量、目标类型） |
| 加一个遗物 | [`models/custom-relic.md`](models/custom-relic.md) |
| 加一个药水 | **wiki 没有这一页。** 看 [`models/index.md`](models/index.md) 的总则，然后反编译 `BaseLib.Abstracts.CustomPotionModel` |
| 加一个能力 / buff | [`models/custom-temporary-power.md`](models/custom-temporary-power.md) |
| 加一个事件 | [`models/custom-event.md`](models/custom-event.md) |
| 加一个遭遇（敌人组合） | [`models/custom-encounter.md`](models/custom-encounter.md) |
| 加一个角色 | [`models/custom-character.md`](models/custom-character.md)（**大半是 stub**）→ [`scenes/creature-visuals.md`](scenes/creature-visuals.md) |
| 改角色 / 敌人的贴图与动画 | [`scenes/creature-visuals.md`](scenes/creature-visuals.md) |
| 让文案支持中英双语 | [`localization/code-loc.md`](localization/code-loc.md) · [`localization/simplified-loc.md`](localization/simplified-loc.md) · [`localization/var-loc.md`](localization/var-loc.md) |
| 卡面上显示一个自己算的数 | [`utilities/custom-calc-vars.md`](utilities/custom-calc-vars.md) · [`localization/display-var.md`](localization/display-var.md) |
| 加关键词 / 自定义枚举 | [`utilities/enums.md`](utilities/enums.md) |
| 给 mod 加设置界面 | [`utilities/config.md`](utilities/config.md) → [`utilities/config-advanced.md`](utilities/config-advanced.md) |
| 加音效 | [`utilities/mod-audio.md`](utilities/mod-audio.md) |
| 让另一个 mod 能用我的接口 | [`utilities/mod-interop.md`](utilities/mod-interop.md) |
| 给别人的类加一个字段 | [`utilities/spirefield.md`](utilities/spirefield.md) |
| 往原版场景里插节点 | [`scenes/add-nodes.md`](scenes/add-nodes.md) |
| 改能量计数器外观 | [`scenes/energy-counter.md`](scenes/energy-counter.md) |
| 看 BaseLib 总共有哪些能力 | [`Features.md`](Features.md)（含「还没写文档」的清单） |

## 全部页面

| 页面 | 讲什么 | 状态 |
|---|---|---|
| [`Features.md`](Features.md) | 功能总表：值得一看的能力 + 还没写文档的东西 + 小功能（遗物图覆盖、描述修改钩子等） | 完整 |
| [`mechanics.md`](mechanics.md) | BaseLib 加的钩子接口、关键词、动态变量（Persist/Exhaustive/Refund）、自定义目标类型 | 完整 |
| [`models/index.md`](models/index.md) | 自定义模型总则：ModelDb 自动加载、**ID 自动加前缀**、何时必须用 `Custom*Model` | 完整 |
| [`models/custom-card.md`](models/custom-card.md) | 卡：`[Pool]` 必需且可继承、`ConstructedCardModel` 替代写法、frame/banner 覆盖 | **`CardModel` 一节是 TODO** |
| [`models/custom-relic.md`](models/custom-relic.md) | 遗物：`[Pool]`、`GetUpgradeReplacement`、三个图标路径及其默认位置 | 完整 |
| [`models/custom-character.md`](models/custom-character.md) | 角色：池子与视觉两节都是 stub，只有 `Extra` 有内容 | **stub** |
| [`models/custom-ancient.md`](models/custom-ancient.md) | 远古（Ancient）：遗物池、生成、本地化、资源 | 完整 |
| [`models/custom-encounter.md`](models/custom-encounter.md) | 遭遇：一场战斗里放哪些怪、怎么排 | 完整 |
| [`models/custom-event.md`](models/custom-event.md) | 事件：触发条件、选项、结果 | 完整 |
| [`models/custom-orbs.md`](models/custom-orbs.md) | 充能球：图标与精灵、音效、随机生成池、`OrbModel` 要点 | 完整 |
| [`models/custom-temporary-power.md`](models/custom-temporary-power.md) | 临时能力（回合结束会掉的 buff）及其 wrapper | 完整 |
| [`models/custom-singleton.md`](models/custom-singleton.md) | 单例模型：被动接收战斗/跑局钩子，用来实现机制或记账 | 完整（短） |
| [`models/custom-act.md`](models/custom-act.md) | 幕（Act）：只有一段注释和一个指向源码的链接 | **stub** |
| [`scenes/creature-visuals.md`](scenes/creature-visuals.md) | 生物视觉：必需节点表、静态图直接变生物、Godot 动画自动播放 | **Spine 一节空白** |
| [`scenes/add-nodes.md`](scenes/add-nodes.md) | 往原版场景里加节点（`AddedNode` / `SpireField` 的变体） | 完整 |
| [`scenes/energy-counter.md`](scenes/energy-counter.md) | 自定义能量计数器：`NEnergyCounter` 的场景要求 | 完整 |
| [`scenes/merchant-character.md`](scenes/merchant-character.md) | 商人角色的视觉（Spine） | 完整（短） |
| [`scenes/index.md`](scenes/index.md) | 场景类工具的总则：为什么需要这些工具 | 导读 |
| [`localization/index.md`](localization/index.md) | 本地化总则：`DefaultLoc.Set` 设回退语言 | 导读 |
| [`localization/code-loc.md`](localization/code-loc.md) | 文案写在 C# 里：`ILocalizationProvider`、`CardLoc` 等 record、按语言分支 | 完整 |
| [`localization/simplified-loc.md`](localization/simplified-loc.md) | 简化语法：`!D!`、`*gold*`、`(plural)`、`-旧-+新+`、`[E?]` | 完整 |
| [`localization/var-loc.md`](localization/var-loc.md) | 给动态变量配提示文案 | 完整 |
| [`localization/display-var.md`](localization/display-var.md) | `DisplayVar`：往描述里塞任意加工过的文字 | 完整（短） |
| [`localization/ancient-dialogue.md`](localization/ancient-dialogue.md) | 远古的对话文本格式 | 完整 |
| [`utilities/config.md`](utilities/config.md) | mod 设置界面：声明式，各控件写法 | 完整 |
| [`utilities/config-advanced.md`](utilities/config-advanced.md) | 设置进阶：手动存取、按钮、条件显示、折叠分组 | 完整 |
| [`utilities/custom-calc-vars.md`](utilities/custom-calc-vars.md) | 自定义计算变量：绕开原版「名字固定、只能用在卡上」的限制 | 完整 |
| [`utilities/enums.md`](utilities/enums.md) | 自定义枚举与关键词、静态提示、卡牌堆 | 完整 |
| [`utilities/pooling.md`](utilities/pooling.md) | `GeneratedNodePool`：把代码生成的节点纳入对象池 | 完整（短） |
| [`utilities/spirefield.md`](utilities/spirefield.md) | `SpireField`：给已有类加字段；`SavedSpireField` 会存盘 | 完整 |
| [`utilities/mod-audio.md`](utilities/mod-audio.md) | 音频工具 | 完整（短） |
| [`utilities/mod-interop.md`](utilities/mod-interop.md) | 让别的 mod 调用你的接口 | 完整 |
| [`utilities/ancient-upgrades.md`](utilities/ancient-upgrades.md) | 远古升级相关 | 完整（短） |
| [`utilities/index.md`](utilities/index.md) | 空的 | **空** |
| [`extras/index.md`](extras/index.md) | 空的 | **空** |

## 空白清单（这些只能反编译）

上游明确没写、或者只写了一半的地方。**遇到它们不要试图从 wiki 推，直接 `inspect_api action=source`。**

| 缺口 | 现状 | 去哪查 |
|---|---|---|
| 卡图（portrait）怎么换 | `models/custom-card.md` 只有 frame / banner，`CardModel` 一节是 TODO | 反编译 `MegaCrit.Sts2.Core.Models.CardModel`，找 `PortraitPath` |
| Spine 生物动画怎么替换 | `scenes/creature-visuals.md` 的 `## Spine` 下面是空的 | 反编译 `NCreatureVisuals` 与原版生物的 `.tscn` |
| 药水 | **没有这一页** | 反编译 `BaseLib.Abstracts.CustomPotionModel`（含 `Image` / `LargeImagePatch` / `OutlinePatch` 内嵌补丁） |
| 自定义角色 | `models/custom-character.md` 的池子与视觉都是 stub | 反编译 `BaseLib.Abstracts.CustomCharacterModel` |

## 出处与同步

- 快照对应哪个 commit、哪个 BaseLib 版本：[`SOURCE.md`](SOURCE.md)
- 上游更新了要重抓：`node scripts/sync-base-lib-wiki.mjs`（只比对用 `--check`）
- **不要手改本目录下的任何 wiki 页。** 要补我们的结论，写进 `docs/game.md` 或对应的 SKILL。
