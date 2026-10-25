# Third-party components and licenses

Third-party binaries that this repository tracks in git. **All of them are MIT.**

The DLL files that the game ships are `sts2.dll` and `0Harmony.dll`. They are **not in this table**. They are compile-time references (`<Private>false</Private>`). This repository does not ship them and the mod does not ship them. The player machine already has them.

## The list

| File | Component | Version | License | Purpose | Shipped with the mod |
|---|---|---|---|---|---|
| `tools/api-probe/lib/ICSharpCode.Decompiler.dll` | [ICSharpCode.Decompiler](https://github.com/icsharpcode/ILSpy) (ILSpy) | **11.1.0.9782** | MIT | Decompiles C#. All the `search`, `members`, and `source` actions of `inspect_game_api` read the assembly through it. The conclusions in `docs/` also come from it. | No (maintainer tool) |
| `tools/api-probe/lib/System.Reflection.Metadata.dll` | System.Reflection.Metadata | **9.0.0.0** | MIT | A dependency of the component above | No |
| `tools/api-probe/lib/System.Collections.Immutable.dll` | System.Collections.Immutable | **9.0.0.0** | MIT | A dependency of the component above | No |
| `vendor/ritsulib/**` | [RitsuLib](https://github.com/BAKAOLC/STS2-RitsuLib) (OLC) | **0.6.10**, game API **0.107.1** | MIT | The complete runtime: loader, shared modules, compatibility modules, assets, and manifest. `install_mod` installs it only when no copy exists. | **Yes** (loaded at runtime) |

The RitsuLib files come from `STS2.RitsuLib.Compat.0.107.1.0.6.10.github.zip`, SHA-256 `3c7dafb8a8d36d66891abd6c601aec6f43de9890693d1b583e67e2c6d71ebfb5`. The runtime files are byte for byte the same as upstream. `mod_manifest.json` keeps its official name. The `shared/` and `compat/` directory trees stay intact. `LICENSE.txt` and `README.md` are repository-only files and are not installed.

The upstream for the tools is `unity-mono-mod`, which duckov maintains, and `tools/api-probe/README.md` records the four local deviations at its end.

## Upgrade and check

When you upgrade a DLL, **change the version in this table too**. To read the version, do **not** run the code. There are two ways and you can use either one.

**FileVersion** (`strings` reads it directly and it works on both platforms):

```bash
strings -a tools/api-probe/lib/System.Reflection.Metadata.dll \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | sort -u
# 4.0.0.0  9.0.24.52809
```

**AssemblyVersion** (this table records this value. The assembly metadata stores it as UTF-16 and `strings` does not read it by default):

```bash
python3 -c "
import re,sys
d=open(sys.argv[1],'rb').read().decode('utf-16-le',errors='ignore')
print(sorted(set(re.findall(r'\b\d+\.\d+\.\d+\.\d+\b', d)))[:4])
" tools/api-probe/lib/System.Reflection.Metadata.dll
# ['9.0.0.0', '9.0.24.52809']
```

Two traps when you read the value:

- `ICSharpCode.Decompiler.dll` holds more than one number string. For example, `2.0.0.0` and `4.0.0.0` are versions of its dependencies. The value for this component is **`11.1.0.9782`**.
- The two `System.*` files have AssemblyVersion `9.0.0.0` and FileVersion `9.0.24.52809`. **Do not write `8.x` for either one.** We made that mistake here once.

## Known cautions

- This repository **has no `LICENSE` file of its own**, so the default is that all rights are reserved. The third-party licenses below cover the files in the table above only.
- Do **not** compile a library that has the LGPL or another copyleft license into the mod. The mod output of this repository is one DLL. If you mix such a library in, the whole output must ship under that license.
- The linker uses the DLL files in `tools/api-probe/lib/` only when it **builds `tools/api-probe`**. The game never loads them and they never go into the mod install directory.
- The files in `vendor/ritsulib/` follow the same fill-only rule. The installer also verifies the vendor version before copying it.
- `tools/pck-pack/PckFileWriter.cs` comes from `Sts2SkinManager` under MIT. Its license is beside the source file.

## The full MIT license text

This text applies to all the components in the table above.

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

The copyright line of each component:

| Component | Copyright |
|---|---|
| ICSharpCode.Decompiler | `Copyright (c) 2011-2025 AlphaSierraPapa for the ILSpy team`. Taken from <https://github.com/icsharpcode/ILSpy>/LICENSE on 2026-10-18. |
| System.Reflection.Metadata / System.Collections.Immutable | `Copyright (c) .NET Foundation and Contributors` (<https://github.com/dotnet/runtime>) |
| RitsuLib | `Copyright (c) 2026 OLC` (<https://github.com/BAKAOLC/STS2-RitsuLib/blob/v0.6.10/LICENSE>) |
| Sts2SkinManager `PckFileWriter.cs` | `Copyright (c) 2026 inggom` (<https://github.com/ing-gom/Sts2SkinManager>) |
