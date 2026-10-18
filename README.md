# Slay the Spire 2 mod 工作区

在这个环境里就能直接做 Slay the Spire 2 的 mod：读 `docs/` 了解格式，在 `your_mods/<mod名>/` 下产出 mod，用 `validate_mod` 校验、`install_mod` 装进游戏。

- 结构说明与环境事实见 `AGENTS.md`。
- 游戏机制、清单格式、加载开关见 `docs/game.md`。
- **踩坑清单见 `docs/traps.md`** —— 出错时先看这一页，这里的失败几乎都不报错。

## 这是什么类型的 mod

`modType: godot-csharp`。游戏是 Godot 4.5.1 + C# (`net9.0`)，mod 产物是：

```
<id>.json   清单（文件名必须等于 id）
<id>.dll    程序集（文件名必须等于 id）
```

v1 **不带资源包**（`compile.pck: false`）。要加 `.pck` 需要先打通 Godot 导出链。

## 工具

| 工具 | 用途 |
|---|---|
| `check_runtime` | .NET 9 SDK 是否就绪 |
| `try_set_game_dir` / `set_game_dir` / `check_game_paths` | 发现、记录、校验三条路径 |
| `validate_mod` | 校验清单 + 编译 + 检查产物 |
| `inspect_api` | 按名字查游戏类型，并反编译读源码（不猜类名） |
| `install_mod` | 复制到游戏的 mods 目录，并报告加载总开关的状态 |

路径与判据都在 `.pi/lib/`；`mod-repo.json` 只放常量。

## 第三方组件

`tools/` 下有入库的第三方二进制（随仓的反编译器）。清单、版本与 MIT 许可全文见
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)。这三个文件与上游字节相同，不得改动。

`vendor/baselib/` 是另一类：**BaseLib**，玩家机器上要被游戏加载的内容 mod 依赖（MIT，见
[`vendor/baselib/README.md`](vendor/baselib/README.md)）。它只在玩家**一份都没有**时由
`install_mod` 放进去；已经有一份就不动，否则会盖掉 Workshop 订阅并静默钉死版本
（[`docs/traps.md`](docs/traps.md) 第 9 条）。
