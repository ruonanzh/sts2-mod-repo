# vendor/baselib —— 随仓分发的 BaseLib

这是 **BaseLib 3.4.7**，上游是 [Alchyr/BaseLib-StS2](https://github.com/Alchyr/BaseLib-StS2)（MIT，见同目录 `LICENSE.txt`）。
本仓库不改它一行，只是原样带着，让玩家克隆完就能跑内容 mod。

## 里面是什么

| 文件 | 作用 |
|---|---|
| `BaseLib.dll` | 依赖库本体，游戏的 mod 加载器加载 |
| `BaseLib.pck` | Godot 资源包，**本地化表在这里**。只有 DLL 的话，BaseLib 提供的文案读不到 |
| `BaseLib.json` | 游戏的 mod manifest。上游那份带 UTF-8 BOM，这里去掉了（Node 的 `JSON.parse` 不收 BOM），其余字节相同 |
| `LICENSE.txt` | 上游 MIT 原文。**不**进 mod 安装目录 |

## 什么时候会被装到玩家机器上

只有一种情况：`install_mod` 检查到**玩家一份都没有**（mods 目录、Steam Workshop 都没有）。

已经有一份时它**不动**。原因见 `docs/traps.md` 第 9 条：加载器优先 `mods_directory`，
本地一份会**盖掉** Workshop 那份，于是订阅更新永远到不了，日志只有一行 WARN。

判据的实现在 `.pi/lib/mod-deps.ts`，测试是 `scripts/test-mod-install-deps.mjs`。

## 怎么升级

1. 从上游 release 取 `BaseLib.dll` / `BaseLib.pck` / `BaseLib.json`。
2. 去掉 `BaseLib.json` 的 BOM，用 Python 校一遍它仍是合法 JSON：

   ```sh
   python3 -c "
   import pathlib, json
   p = pathlib.Path('vendor/baselib/BaseLib.json')
   b = p.read_bytes()
   if b.startswith(b'\xef\xbb\xbf'): b = b[3:]
   json.loads(b)
   p.write_bytes(b)"
   ```

3. 核对 `sha256(BaseLib.dll)` 与上游 release 一致。
4. **同时**改三处，否则三处说的是不同的版本：
   - `THIRD_PARTY_LICENSES.md` 的版本列
   - 各内容 mod manifest 的 `dependencies[].min_version`（没用到新 API 时**不必**跟着抬高）
   - 本文件顶部的版本号

## 为什么不跟着 Workshop 走

Workshop 订阅是玩家的动作，我们控制不了版本，也没法在玩家没订阅时让 mod 跑起来。
带一份 + 只填空，两个目标同时成立，代价是我们得跟上游升级。这个代价换的是首次安装零步骤。
