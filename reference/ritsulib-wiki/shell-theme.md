## Settings Shell Theme

RitsuLib settings pages use shell theme tokens for colors, typography, spacing, and component defaults. Most mods should rely on the active theme. Add a custom theme only when your settings UI needs a coherent visual identity across several custom controls.

Theme JSON files belong in your mod resources and are registered through the shell theme APIs. Keep token names semantic: describe the role, not the color.


## Toasts

Use toast messages for short runtime feedback that should not interrupt play.

```csharp
RitsuToastService.ShowInfo("Settings saved.", "My Mod");
RitsuToastService.ShowWarning("Optional bank failed to load.", "My Mod");
RitsuToastService.ShowError("Required setup failed.", "My Mod");
```

For custom placement, image, duration, or click behavior, build a `RitsuToastRequest`.
Non-persistent toasts show a small remaining-time progress bar; persistent toasts omit it.

Use `ShowTracked` when later code needs to update or close the same toast.

```csharp
var toast = RitsuToastService.ShowTracked(
    RitsuToastRequest.Info("Loading...", "My Mod")
        .Persistent());

toast.UpdateBody("Loaded.");
toast.ResetDuration(2.0d);

// Or close it from a cancellation path:
toast.Close();
```


## Runtime Hotkeys

Register hotkeys when the action must be available outside a settings page.

```csharp
var handle = RuntimeHotkeyService.Register(
    "Ctrl+Shift+M",
    callback: ToggleMyOverlay,
    id: "my_mod.toggle_overlay",
    title: "Toggle overlay");
```

Expose hotkeys in settings with `AddKeyBinding`, `AddMultiKeyBinding`, or `AddRuntimeHotkeySummary`.


## Top-Bar Buttons

Register top-bar buttons through the content pack:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .TopBarButtonOwned("my_panel", new ModTopBarButtonSpec(
        IconPath: "res://MyMod/images/ui/my_panel.png",
        Handler: new MyTopBarButtonHandler()))
    .Apply();
```

Owned button ids use `MY_MOD_TOPBARBUTTON_MY_PANEL` and read hover text from `static_hover_tips`.


## Card Piles

Custom piles are useful for extra hand-like or discard-like collections. An `ExtraHand` pile uses interactive
vanilla card holders, including hover enlargement, keyword tips, controller focus, playable glow, and optional
manual play through the normal targeting, resource-spend, hook, queue, and result-pile pipeline. Its default
`VanillaHand` layout uses the same dynamic fan, scale, rotation, hover lift, and neighboring-card displacement as
the player hand. Select `Horizontal` or `Vertical` to use the configurable linear spacing and scale instead.

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .CardPileOwned("archive", new ModCardPileSpec
    {
        Style = ModCardPileUiStyle.ExtraHand,
        Anchor = ModCardPileAnchor.AtCenter(new Vector2(260f, 520f)),
        CardShouldBeVisible = true,
        ExtraHand = new ModCardPileExtraHandSpec
        {
            Direction = ModExtraHandLayoutDirection.Vertical,
            Spacing = 86f,
            CardScale = Vector2.One * 0.55f,
            HoverScale = Vector2.One,
            ShowPlayableGlow = true,
            AllowCardPlay = true,
        },
    })
    .Apply();
```

Use `LayoutResolver` for per-card transforms and `OnCardVisualCreated` / `OnCardArrived` for custom presentation
animations. `FlightTargetPositionResolver` and `FlightStartPositionResolver` customize the vanilla flight endpoints.

When an extra-hand card is manually played, RitsuLib temporarily bridges it through the backend vanilla hand so
the sealed vanilla `PlayCardAction` accepts it. A canceled target selection or queued action restores the card to
its source pile. Consequently, vanilla logic that inspects `PileType.Hand` during targeting sees the card as a hand
card, which is normally the desired semantics for a playable extra hand.

Use stable local stems. Pile ids are part of UI text, persistence state, and localization keys. Add the generated
pile id's `.title`, `.description`, and `.empty` entries to `static_hover_tips.json`.
