# vendor/baselib: the BaseLib that ships with this repository

This is **BaseLib 3.4.7**. The upstream project is [Alchyr/BaseLib-StS2](https://github.com/Alchyr/BaseLib-StS2) and the license is MIT. The license text is in `LICENSE.txt` in this directory.
This repository does not change one line of it. It carries the files as they are, so that the player can run a content mod after a clone.

## What is in this directory

| File | Purpose |
|---|---|
| `BaseLib.dll` | The dependency library itself. The mod loader of the game loads it. |
| `BaseLib.pck` | A Godot resource pack. **The localization tables are here.** If only the DLL is present, the game cannot read the strings that BaseLib provides. |
| `BaseLib.json` | The mod manifest of the game. The upstream file has a UTF-8 BOM and this copy does not, because Node `JSON.parse` rejects a BOM. All other bytes are the same. |
| `LICENSE.txt` | The upstream MIT text. It does **not** go into the mod install directory. |

## When `install_mod` installs it on the player machine

There is one case only. `install_mod` checks the mods directory and the Workshop directory. It installs the copy only when **the player has no copy at all** in either one.

If a copy already exists, `install_mod` does **not** touch it. The reason is item 9 in `docs/traps.md`. The loader gives priority to `mods_directory`. A local copy then **overrides** the copy from the Workshop. Then an update from a subscription never arrives and the log has one WARN line only.

The rule that decides this case is in `.pi/lib/mod-deps.ts`. The test is `scripts/test-mod-install-deps.mjs`.

## How to upgrade

1. Get `BaseLib.dll`, `BaseLib.pck`, and `BaseLib.json` from the upstream release.
2. Delete the BOM from `BaseLib.json`. Then use Python to check that the file still parses as JSON:

   ```sh
   python3 -c "
   import pathlib, json
   p = pathlib.Path('vendor/baselib/BaseLib.json')
   b = p.read_bytes()
   if b.startswith(b'\xef\xbb\xbf'): b = b[3:]
   json.loads(b)
   p.write_bytes(b)"
   ```

3. Check that `sha256(BaseLib.dll)` matches the upstream release.
4. Change all three places at the same time. If you change one only, the three places name different versions.
   - The version column in `THIRD_PARTY_LICENSES.md`.
   - `dependencies[].min_version` in each content mod manifest. If the mod does not use a new API, you do **not** have to raise it.
   - The version number at the top of this file.

## Why it does not follow the Workshop

A subscription in the Workshop is an action of the player. We cannot control the version. We also cannot make a mod run when the player has no subscription.
We ship one copy and we only fill an empty gap. Both goals then hold at the same time. The cost is that we must follow the upstream upgrades. That cost buys a first install with zero steps.
