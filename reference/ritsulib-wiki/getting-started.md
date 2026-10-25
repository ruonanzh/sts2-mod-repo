## Install

Add the package to your mod project:

```xml
<PackageReference Include="STS2.RitsuLib" />
```

Declare the runtime dependency in `mod_manifest.json`. For game API 0.105.x and newer, use the object form:

```json
{
  "dependencies": [
    { "id": "STS2-RitsuLib" }
  ]
}
```

For older game API branches, use the legacy string form because older manifest parsers may fail on dependency objects:

```json
{
  "dependencies": [
    "STS2-RitsuLib"
  ]
}
```

If you do not use Central Package Management, choose the current package version through your package manager or IDE.
Use `STS2.RitsuLib.Compat.<api-version>` only when the mod targets an older Slay the Spire 2 API branch.


## Initialize

Register your assembly for RitsuLib discovery from the mod initializer. This is required for CLR attribute registration.

```csharp
using System.Reflection;
using MegaCrit.Sts2.Core.Logging;
using MegaCrit.Sts2.Core.Modding;
using STS2RitsuLib;
using STS2RitsuLib.Interop;
using STS2RitsuLib.Patching.Core;

[ModInitializer(nameof(Initialize))]
public static class MyModEntry
{
    public const string ModId = "MyMod";
    public static Logger Logger { get; private set; } = null!;

    public static void Initialize()
    {
        var assembly = Assembly.GetExecutingAssembly();

        Logger = RitsuLibFramework.CreateLogger(ModId);
        ModTypeDiscoveryHub.RegisterModAssembly(ModId, assembly);
        RitsuLibFramework.EnsureGodotScriptsRegistered(assembly, Logger);

        var patcher = RitsuLibFramework.CreatePatcher(ModId, "main");
        patcher.RegisterPatches<MyModPatches>();
        RitsuLibFramework.ApplyRequiredPatcher(patcher, DisableMod);
    }

    private static void DisableMod()
    {
        // Mark your own mod disabled when a required patch cannot apply.
    }
}
```

Call `EnsureGodotScriptsRegistered(...)` only when your mod contains C# scripts attached to `.tscn` scenes. Pure model or
patch mods can omit it.


## Register Content

For most content, put registration attributes on the model class. The registration point stays next to the class that is
being registered.

```csharp
using Godot;
using MegaCrit.Sts2.Core.Entities.Cards;
using MegaCrit.Sts2.Core.Models;
using STS2RitsuLib.Interop.AutoRegistration;
using STS2RitsuLib.Scaffolding.Content;

public sealed class MyCardPool : TypeListCardPoolModel
{
    public override string Title => "My Cards";
    public override string EnergyColorName => "orange";
    public override string CardFrameMaterialPath => "card_frame_orange";
    public override Color DeckEntryCardColor => new("d58b2f");
    public override bool IsColorless => false;
}

[RegisterCard(typeof(MyCardPool))]
public sealed class MyStrike
    : ModCardTemplate(1, CardType.Attack, CardRarity.Common, TargetType.SingleEnemy)
{
    public override void Use(ICombatContext ctx, ICreatureState user, ICreatureState? target)
    {
        ctx.DealDamage(user, target, Damage);
    }
}
```

Write the display text in the matching localization table:

```json
{
  "MY_MOD_CARD_MY_STRIKE.title": "Measured Strike",
  "MY_MOD_CARD_MY_STRIKE.description": "Deal {Damage} damage."
}
```

Use a content pack instead when the registration is easier to read as a batch:

```csharp
RitsuLibFramework.CreateContentPack("MyMod")
    .Card<MyCardPool, MyStrike>()
    .Relic<MyRelicPool, MyStarterRelic>()
    .Apply();
```


## Next Steps

- Registration APIs: [Content authoring](content-authoring-toolkit.md)
- Localization keys: [Localization and keywords](localization-and-keywords.md)
- Characters: [Character and unlock scaffolding](character-and-unlock-scaffolding.md)
- Saves: [Persistence](persistence-guide.md)
- Settings: [Mod settings](mod-settings.md)
