## Runtime update toast

Use `RitsuLibFramework.RegisterModUpdateCheck(...)` when a mod should periodically check a small mirrored or self-hosted JSON file after the first main menu loads. Do not point `ManifestUri` at GitHub, GitHub API, or raw GitHub content; use a CDN, your own site, or another mirror. The release page can still be whichever page you want users to open.

Automatic checks are serialized by RitsuLib and use the global RitsuLib update-check interval. Players can also configure automatic checks to pause while the run is in a combat room and resume after leaving it. Update toasts from automatic checks are deferred until the main menu is active.

```csharp
RitsuLibFramework.RegisterModUpdateCheck(new()
{
    ModId = MyModConst.ModId,
    DisplayName = MyModConst.Name,
    CurrentVersion = MyModConst.Version,
    ManifestUri = new("https://example.com/my-mod/update.json"),
    ReleasePageUri = new("https://example.com/my-mod/releases"),
});
```

For mods that are also distributed through Steam Workshop, wrap the options with `SkipModUpdateCheckWhenLoadedFromSteamWorkshop` and pass the mod's Workshop item id. This keeps local/manual installs on the external update source, while that exact Workshop item is left to Steam's Workshop update flow.

```csharp
RitsuLibFramework.RegisterModUpdateCheck(
    RitsuLibFramework.SkipModUpdateCheckWhenLoadedFromSteamWorkshop(new()
    {
        ModId = MyModConst.ModId,
        DisplayName = MyModConst.Name,
        CurrentVersion = MyModConst.Version,
        ManifestUri = new("https://example.com/my-mod/update.json"),
        ReleasePageUri = new("https://example.com/my-mod/releases"),
    }, typeof(MyModPlugin).Assembly, 1234567890));
```

If the manifest version is newer, RitsuLib shows a normal non-persistent info toast. Clicking the toast opens `release_page_url` from the manifest, or `ReleasePageUri` from options when the manifest omits it.

```json
{
  "schema": "ritsulib.update.v1",
  "latest_version": "1.2.3",
  "release_page_url": "https://example.com/my-mod/releases",
  "title": "My Mod update available",
  "message": "Version 1.2.3 of My Mod is available. Click to open the release page."
}
```
