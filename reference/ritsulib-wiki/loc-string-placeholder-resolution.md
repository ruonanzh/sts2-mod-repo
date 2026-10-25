## Use The Game Pipeline When You Can

Model titles, descriptions, event options, hover tips, and most game UI text should use the game's `LocString` pipeline. RitsuLib's `I18N` is useful for mod UI and custom text, but content that the base game already localizes should stay in the matching game table.

```json
{
  "MY_MOD_CARD_MY_STRIKE.title": "Measured Strike",
  "MY_MOD_CARD_MY_STRIKE.description": "Deal {damage} damage."
}
```

For values that come from `DynamicVars`, keep the placeholder name in the description and expose the variable from the card.


## Placeholder Sources

Common placeholder sources:

| Placeholder kind | Where to define it |
| --- | --- |
| Card numeric value | `DynamicVarSet` on the card |
| Keyword title / description | `card_keywords` or `static_hover_tips` key |
| Event option text | Event or ancient localization entry built from `InitialOptionKey(...)` / `ModOptionKey(...)` |
| Settings UI text | `ModSettingsText.I18N(...)`, `ModSettingsText.LocString(...)`, or literal text |
| Custom formatter | `RitsuLibFramework.GetSmartFormatRegistry(modId)` or `.SmartFormatter<T>()` in a content pack |

Keep placeholder names lowercase and descriptive in author-facing JSON. Avoid encoding implementation names into user text.


## SmartFormat Extensions

Register SmartFormat extensions when a placeholder needs custom formatting behavior.

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .SmartFormatter<MyFormatter>()
    .SmartFormatSource<MySource>()
    .Apply();
```

Use this for reusable formatting rules. For a single card value, a dynamic variable is simpler and easier for other authors to read.


## Checklist

- Keep localization keys based on stable public entries.
- Keep user-facing text free of class names, method names, and patch names.
- Add fallbacks for mod settings text.
- Test `eng` and `zhs` at minimum when the mod ships both.
- Register keywords and SmartFormat extensions before model text is first resolved.
