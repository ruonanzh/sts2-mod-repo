## Two Text Systems

Use the game's localization tables for game content. Use `I18N` for your own UI strings.

| Need | Use |
| --- | --- |
| Card, relic, potion, power, character, event, ancient, epoch text | Game loc tables such as `cards`, `relics`, `events`, `ancients`, `epochs` |
| Keyword title / description | `card_keywords` for card keywords, or `static_hover_tips` for general hover tips |
| Settings UI, debug panels, small mod UI | `I18N` through `CreateModLocalization(...)` |
| A game API that requires `LocString`, backed by your own JSON | Register an `I18N` virtual loc table |

File names use game language codes such as `eng.json`, `zhs.json`, and `jpn.json`.


## Entry Keys

For RitsuLib-registered pool content, the public entry is the localization stem:

```text
MY_MOD_CARD_MY_STRIKE
```

The key goes into the table used by the model type:

| Model | Table | Common keys |
| --- | --- | --- |
| Card | `cards` | `{ENTRY}.title`, `{ENTRY}.description`, `{ENTRY}.selectionScreenPrompt` |
| Relic | `relics` | `{ENTRY}.title`, `{ENTRY}.description`, `{ENTRY}.flavor`, `{ENTRY}.selectionScreenPrompt` |
| Potion | `potions` | `{ENTRY}.title`, `{ENTRY}.description`, `{ENTRY}.selectionScreenPrompt` |
| Power | `powers` | `{ENTRY}.title`, `{ENTRY}.description` |
| Character | `characters` | `{ENTRY}.title`, pronoun keys, card modifier keys, unlock text |
| Act | `acts` | `{ENTRY}.title` |
| Encounter | `encounters` | `{ENTRY}.title`, `{ENTRY}.loss`, `{ENTRY}.customRewardDescription` |
| Event | `events` | `{ENTRY}.pages.<PAGE>.description`, `{ENTRY}.pages.<PAGE>.options.<OPTION>` |
| Ancient event | `ancients` | event page keys plus `talk` dialogue keys |
| Epoch | `epochs` | `{ID}.title`, `{ID}.description`, `{ID}.unlockInfo`, `{ID}.unlockText` |
| Card pile / top-bar button / shared tooltip | `static_hover_tips` | `{ID}.title`, `{ID}.description`; card piles also use `{ID}.empty` |

Card example in `cards/eng.json`:

```json
{
  "MY_MOD_CARD_MY_STRIKE.title": "Measured Strike",
  "MY_MOD_CARD_MY_STRIKE.description": "Deal {Damage} damage."
}
```

The same keys must exist in every language you support:

```json
{
  "MY_MOD_CARD_MY_STRIKE.title": "精准打击",
  "MY_MOD_CARD_MY_STRIKE.description": "造成 {Damage} 点伤害。"
}
```


## Event Keys

`ModEventTemplate` and `ModAncientEventTemplate` build option keys from the event entry, page name, and option name.

```csharp
protected string ModOptionKey(string pageName, string optionName);
protected string InitialOptionKey(string optionName);
protected LocString PageDescription(string pageName);
```

For event entry `MY_MOD_EVENT_QUIET_DOOR`, this convention uses:

```json
{
  "MY_MOD_EVENT_QUIET_DOOR.pages.INITIAL.description": "A quiet door waits in the wall.",
  "MY_MOD_EVENT_QUIET_DOOR.pages.INITIAL.options.OPEN": "[Open] Step through.",
  "MY_MOD_EVENT_QUIET_DOOR.pages.DONE.description": "The room is quiet again."
}
```

Keep page and option names stable after release. They are part of the player's localization and event-choice history.


## Ancient Dialogue

Ancient dialogue lives in the `ancients` table. Keys use:

```text
<ANCIENT_ENTRY>.talk.<CHARACTER_ENTRY>.<DIALOGUE_INDEX>-<LINE_INDEX>.<speaker>
```

`speaker` is `ancient` or `char`. Add `r` after the line index for a repeating dialogue. Every line in the same dialogue
must either use `r` or not use it.

Example for a mod ancient talking to a mod character:

```json
{
  "MY_MOD_ANCIENT_MIRROR.talk.MY_MOD_CHARACTER_SEER.0-0.ancient": "You brought a future with you.",
  "MY_MOD_ANCIENT_MIRROR.talk.MY_MOD_CHARACTER_SEER.0-0.next": "Continue",
  "MY_MOD_ANCIENT_MIRROR.talk.MY_MOD_CHARACTER_SEER.0-1.char": "Then I should spend it carefully.",

  "MY_MOD_ANCIENT_MIRROR.talk.ANY.0-0r.ancient": "Again, a face in the glass.",
  "MY_MOD_ANCIENT_MIRROR.talk.ANY.0-1r.char": "Again, a choice."
}
```

`ModAncientEventTemplate` reads:

- `{ancient}.talk.firstVisitEver.*` for the first visit ever
- `{ancient}.talk.<CHARACTER_ENTRY>.*` for a specific character
- `{ancient}.talk.ANY.*` for character-agnostic fallback dialogue

The Architect uses the same `ancients` table. To add dialogue for a mod character, write keys under
`THE_ARCHITECT.talk.<CHARACTER_ENTRY>.*`:

```json
{
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.0-0.char": "The exit is yours, but the cost is mine.",
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.0-1.ancient": "Then pay precisely.",
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.0-attack": "Both"
}
```

For Architect dialogue, optional `-attack` values are `None`, `Player`, `Architect`, or `Both`. Optional `-visit` keys
can override the visit index:

Explicit `-startattack` and `-endattack` keys are also supported. `-startattack` sets `StartAttackers`,
and `-endattack` sets `EndAttackers`.

```json
{
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.1-startattack": "Player",
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.1-endattack": "Both",
  "THE_ARCHITECT.talk.MY_MOD_CHARACTER_SEER.1-visit": "3"
}
```

Use `.sfx` beside a line key when a line should play a specific FMOD event:

```json
{
  "MY_MOD_ANCIENT_MIRROR.talk.ANY.0-0r.ancient.sfx": "event:/sfx/ui/enchant_simple"
}
```


## Keywords

Prefer owned keyword ids. Attribute style:

```csharp
[RegisterOwnedCardKeyword(
    "bleeding",
    IconPath = "res://MyMod/images/keywords/bleeding.png")]
public sealed class MyKeywordRegistrations
{
}
```

Content pack style:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .CardKeywordOwnedByLocNamespace(
        localKeywordStem: "bleeding",
        iconPath: "res://MyMod/images/keywords/bleeding.png")
    .Apply();
```

Both create:

```text
MY_MOD_KEYWORD_BLEEDING
```

Card keyword text goes in `card_keywords`:

```json
{
  "MY_MOD_KEYWORD_BLEEDING.title": "Bleeding",
  "MY_MOD_KEYWORD_BLEEDING.description": "Loses HP at the end of turn."
}
```

Keyword descriptions can use the standard current-character energy icon syntax:

```json
{
  "MY_MOD_KEYWORD_BLEEDING.description": "The next card costs 0{energyPrefix:energyIcons(1)}."
}
```

This supplies the energy icon prefix only. Card dynamic variables such as `{Damage}` or `{Block}` are not available in
keyword descriptions because a keyword hover tip is not tied to one card instance.

Use the keyword on a `ModCardTemplate`:

```csharp
protected override IEnumerable<string> RegisteredKeywordIds =>
[
    "MY_MOD_KEYWORD_BLEEDING"
];
```

At runtime:

```csharp
card.AddModKeyword("MY_MOD_KEYWORD_BLEEDING");
if (card.HasModKeyword("MY_MOD_KEYWORD_BLEEDING"))
{
    // ...
}
```

Relic, potion, and power template keyword lists are display-only hover tips. Implement gameplay behavior in the model
logic.


## I18N

Create an `I18N` instance when you want simple key-value JSON files outside the game's model tables.

```csharp
var i18n = RitsuLibFramework.CreateModLocalization(
    modId: "MyMod",
    instanceName: "settings",
    pckFolders: ["res://MyMod/localization/settings"]);

var label = i18n.Get("settings.enabled", "Enabled");
```

`I18N` follows the game's fallback behavior by default: a non-English current language loads that language first, then
fills missing keys from `eng.json`. Use `CreateModLocalizationWithFallback(...)` to choose a different fallback
language.

Example `eng.json`:

```json
{
  "settings.enabled": "Enabled"
}
```

When an API requires `LocString`, register the instance as a virtual table:

```csharp
var loc = RitsuLibFramework.CreateModLocalization("MyMod", "ui");
RitsuLibFramework.RegisterI18NLocTableBridge("MyMod", loc);

var tableId = RitsuLibFramework.GetI18NLocTableId("MyMod");
var title = new LocString(tableId, "settings.enabled");
```

Pass a custom stem to `RegisterI18NLocTableBridge(...)` and `GetI18NLocTableId(...)` when you need multiple virtual
tables.

The bridge does not insert entries into the game's localization-table collection. RitsuLib refreshes its own table
snapshot when `I18N.Changed` fires and unregisters it automatically when the `I18N` instance is disposed.
