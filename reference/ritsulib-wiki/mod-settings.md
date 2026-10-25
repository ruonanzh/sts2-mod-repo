## Register A Page

Register settings pages from your mod initializer after the backing data is registered.

```csharp
RitsuLibFramework.RegisterModSettings("MyMod", page => page
    .WithTitle(ModSettingsText.Literal("My Mod"))
    .WithModDisplayName(ModSettingsText.Literal("My Mod"))
    .AddSection("general", section => section
        .WithTitle(ModSettingsText.Literal("General"))
        .AddToggle(
            "enabled",
            ModSettingsText.Literal("Enabled"),
            new ModSettingsValueBinding<MySettings, bool>(
                "MyMod",
                "settings",
                SaveScope.Global,
                s => s.Enabled,
                (s, value) => s.Enabled = value))
        .AddIntSlider(
            "volume",
            ModSettingsText.Literal("Volume"),
            new ModSettingsValueBinding<MySettings, int>(
                "MyMod",
                "settings",
                SaveScope.Global,
                s => s.Volume,
                (s, value) => s.Volume = value),
            minValue: 0,
            maxValue: 100)));
```

Use `ModSettingsText.Literal(...)` for fixed text. Use `ModSettingsText.I18N(...)` or `ModSettingsText.LocString(...)` when the UI should localize.


## Open Pages In Game

RitsuLib surfaces registered settings pages from multiple built-in entry points:

- Main menu patch notes area: the framework can show a dedicated RitsuLib settings shortcut under the vanilla patch-notes button
- Pause and settings surfaces: existing RitsuLib settings integrations still expose the same registered pages there

The main-menu shortcut is controlled by RitsuLib's own global setting `main_menu_mod_settings_button_enabled`.

When documenting your mod for players, mention both the main menu and pause-menu paths if the setting matters during a run.


## Controls

| Control | Builder method |
| --- | --- |
| Toggle | `AddToggle` |
| Integer slider | `AddIntSlider` |
| Floating slider | `AddSlider` |
| Choice / enum | `AddChoice`, `AddDynamicChoice`, `AddEnumChoice` |
| Color | `AddColor` |
| Single-line text | `AddString` |
| Multiline text | `AddMultilineString` |
| Key binding | `AddKeyBinding`, `AddMultiKeyBinding` |
| Button | `AddButton` |
| Editable list | `AddList` |
| Read-only content | `AddHeader`, `AddParagraph`, `AddInfoCard`, `AddImage`, `AddRuntimeHotkeySummary` |
| Nested page | `AddSubpage` |
| Custom Godot control | `AddCustom` |

Every interactive control should have a stable entry id. Changing ids after release breaks clipboard and saved UI metadata expectations.

Use `AddDynamicChoice` when the available values depend on runtime state or another setting. Its provider is re-evaluated when the settings UI refreshes and immediately before a dropdown opens. Returning no options temporarily disables the control without changing the bound value.


## Bindings

Use `ModSettingsValueBinding<TModel,TValue>` for fields stored in `ModDataStore`. For temporary UI, use `InMemoryModSettingsValueBinding<TValue>`.

When a control edits part of a larger value, wrap the parent binding with `ProjectedModSettingsValueBinding<TSource,TValue>`.

```csharp
var settingsBinding = new ModSettingsValueBinding<MySettings, MySettings>(
    "MyMod", "settings", SaveScope.Global, s => s, (_, value) => value);

var volumeBinding = new ProjectedModSettingsValueBinding<MySettings, int>(
    settingsBinding,
    "volume",
    s => s.Volume,
    (s, value) => { s.Volume = value; return s; });
```


## Visibility And Host Surfaces

Use visibility and read-only gates for settings that only make sense in certain places:

```csharp
page
    .WithVisibleOnHostSurfaces(ModSettingsHostSurface.MainMenu | ModSettingsHostSurface.RunPause)
    .WithReadOnlyOnHostSurfaces(ModSettingsHostSurface.CombatPause);

section.WithEntryReadOnlyOnHostSurfaces("dangerous_option", ModSettingsHostSurface.CombatPause);
```

Use `WithVisibleWhen` and `WithEnabledWhen` for page or section runtime conditions.
Use `WithEntryVisibleWhen` and `WithEntryEnabledWhen` for any entry kind:

```csharp
section.WithEntryVisibleWhen("advanced_option", () => MyRuntime.ShowAdvancedOptions);
section.WithEntryEnabledWhen("dangerous_option", () => MyRuntime.CanEditDangerousOption);
```
