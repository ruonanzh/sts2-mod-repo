# 第三方组件与许可

这个仓库入库（git 跟踪）的第三方二进制。**全部为 MIT。**

游戏自带的 DLL（`sts2.dll`、`0Harmony.dll`）**不在本表**：它们是编译期引用（`<Private>false</Private>`），既不随仓也不随 mod 分发，玩家机器上本来就有。

## 清单一览

| 文件 | 组件 | 版本 | 许可 | 用途 | 随 mod 分发 |
|---|---|---|---|---|---|
| `tools/api-probe/lib/ICSharpCode.Decompiler.dll` | [ICSharpCode.Decompiler](https://github.com/icsharpcode/ILSpy)（ILSpy） | **11.1.0.9782** | MIT | 反编译 C#：`inspect_api` 的 `search` / `members` / `source` 全部由它读程序集，`docs/` 里的结论也来自它 | 否（维护者工具） |
| `tools/api-probe/lib/System.Reflection.Metadata.dll` | System.Reflection.Metadata | **9.0.0.0** | MIT | 上者的依赖 | 否 |
| `tools/api-probe/lib/System.Collections.Immutable.dll` | System.Collections.Immutable | **9.0.0.0** | MIT | 上者的依赖 | 否 |
| `vendor/baselib/BaseLib.dll` | [BaseLib](https://github.com/Alchyr/BaseLib-StS2)（Alchyr） | **3.4.7** | MIT | 内容 mod 的运行时依赖。`install_mod` 在玩家**一份都没有**时才把它放进游戏的 mods 目录 | **是**（运行时加载） |
| `vendor/baselib/BaseLib.pck` | 同上 | **3.4.7** | MIT | 同上（本地化表在 pck 里，DLL 单独放不带文案） | **是** |
| `vendor/baselib/BaseLib.json` | 同上 | **3.4.7** | MIT | 游戏的 mod manifest。上游原文件带 UTF-8 BOM，入库那份**去掉了 BOM**（Node 的 `JSON.parse` 不收 BOM），其余字节相同 | **是** |

`vendor/baselib/` 的三个文件来自上游 release `v3.4.7`。`BaseLib.dll` 与 `BaseLib.pck` 与上游**字节相同**（`sha256(BaseLib.dll)` 前 16 位 `55863ca6adc30a61`）。另附 `LICENSE.txt`（上游原文），只随仓库、不进 mod 安装目录。

**这一组与上面三个的区别**：上面是维护者工具，这一组会被**玩家机器加载**。所以它的版本直接决定 mod 能不能跑，升级时必须同时看 `docs/traps.md` 第 9 条（本地副本会盖掉 Workshop 订阅）。

三个文件与上游（`escape-from-duckov-mod`，工具维护方）**字节相同**。`tools/api-probe/` 的代码也是原样复制，见该目录 `README.md` 末尾的偏离记录。

## 升级与核对

升级任何一个 DLL 时**连版本一起改本表**。版本读法（**不执行**被读的代码），两条路任选：

**FileVersion**（`strings` 直接能读，跨平台）：

```bash
strings -a tools/api-probe/lib/System.Reflection.Metadata.dll \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort -u
# 4.0.0.0  9.0.24.52809
```

**AssemblyVersion**（本表记录的是这个；在程序集元数据里以 UTF-16 存放，`strings` 默认读不到）：

```bash
python3 -c "
import re,sys
d=open(sys.argv[1],'rb').read().decode('utf-16-le',errors='ignore')
print(sorted(set(re.findall(r'\b\d+\.\d+\.\d+\.\d+\b', d)))[:4])
" tools/api-probe/lib/System.Reflection.Metadata.dll
# ['9.0.0.0', '9.0.24.52809']
```

读数时的两个坑：

- `ICSharpCode.Decompiler.dll` 里同时存在多个数字串（`2.0.0.0`、`4.0.0.0` 等是它的依赖版本）。代表本组件的是 **`11.1.0.9782`**。
- `System.*` 两个是 AssemblyVersion `9.0.0.0`、FileVersion `9.0.24.52809`。**两个都别写成 `8.x`**——这里踩过一次。

## 已知注意

- 这个仓库**没有自己的 LICENSE 文件**（默认保留所有权利）。下面的第三方许可只覆盖上表那些文件本身。
- **不得**把 LGPL 或其它传染性许可的库直接编进 mod：本仓库的 mod 产物是一个 DLL，混入之后整个产物都要按该许可分发。
- `tools/api-probe/lib/` 下的 DLL 只在**构建 `tools/api-probe`** 时被链接，从不被游戏加载，也从不进入 mod 安装目录。
- `vendor/baselib/` 下的文件**会**进入玩家的 mod 安装目录，但只在玩家没有任何一份 BaseLib 时。已经有一份时 `install_mod` 不动它。

## MIT 许可全文

以下适用于上表所有组件。

```
MIT license

Copyright (c) 2011-2025 AlphaSierraPapa for the ILSpy team

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

组件各自的版权行：

| 组件 | 版权 |
|---|---|
| ICSharpCode.Decompiler | `Copyright (c) 2011-2025 AlphaSierraPapa for the ILSpy team`（取自 <https://github.com/icsharpcode/ILSpy>/LICENSE，2026-10-18 抓取） |
| System.Reflection.Metadata / System.Collections.Immutable | `Copyright (c) .NET Foundation and Contributors`（<https://github.com/dotnet/runtime>） |
