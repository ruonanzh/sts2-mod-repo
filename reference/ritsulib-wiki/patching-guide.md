## Create A Patcher

Use one patcher per logical area. Apply required patchers through `ApplyRequiredPatcher` so the mod can disable itself on critical failure.

```csharp
var patcher = RitsuLibFramework.CreatePatcher("MyMod", "combat");
patcher.RegisterPatches<MyCombatPatch>();
RitsuLibFramework.ApplyRequiredPatcher(patcher, DisableMod);
```

Use separate patchers when one optional feature can fail without disabling the whole mod.


## Write Patch Classes

Implement `IPatchMethod` for strongly typed target declarations.

```csharp
public sealed class MyCombatPatch : IPatchMethod
{
    public static string PatchId => "my_mod_combat_patch";
    public static string Description => "Adjust combat start behavior";
    public static bool IsCritical => true;

    public static ModPatchTarget[] GetTargets() =>
    [
        new(typeof(CombatRoom), "OnEnter"),
    ];

    public static void Postfix(CombatRoom __instance)
    {
        // Harmony postfix body.
    }
}
```

Use `new ModPatchTarget(type, methodName, parameterTypes)` when overloads need disambiguation. Use `ignoreIfMissing: true` only for optional compatibility targets.

For common targets, use `PatchTarget` factory helpers to make the intent explicit:

```csharp
public static ModPatchTarget[] GetTargets() =>
[
    PatchTarget.Method<CombatRoom>("OnEnter"),
    PatchTarget.Method<SaveManager>(nameof(SaveManager.SaveRun), typeof(AbstractRoom), typeof(bool)),
    PatchTarget.Getter<Player>(nameof(Player.Piles)),
    PatchTarget.OptionalGetter<PowerModel>("PackedIconPath"),
];
```


## Private Member Access

Use `PrivateAccess` when a patch must call private game methods or read private fields. It wraps `AccessTools` with required-member checks, so missing members fail with clearer errors during patch initialization.

```csharp
private static readonly AccessTools.FieldRef<NCombatUi, CombatState> StateRef =
    PrivateAccess.FieldRef<NCombatUi, CombatState>("_state");

private static readonly Func<NCardPlay, CardModel?> GetCard =
    PrivateAccess.DeclaredGetterDelegate<NCardPlay, Func<NCardPlay, CardModel?>>("Card");

private static readonly Action<NCardPlay, bool> Cleanup =
    PrivateAccess.DeclaredMethodDelegate<NCardPlay, Action<NCardPlay, bool>>(
        "Cleanup",
        typeof(bool));
```

Prefer declared-member helpers when the target is a known private implementation detail on that exact type. Use inherited-member helpers only when the patch intentionally accepts members from a base type.


## Dynamic Patches

Use dynamic patches when the target method is discovered at runtime.

```csharp
patcher.RegisterDynamicPatch(new DynamicPatchInfo(
    id: "my_mod_dynamic_target",
    originalMethod: resolvedMethod,
    patchType: typeof(MyDynamicPatch),
    isCritical: false,
    description: "Optional runtime target"));

patcher.PatchAll();
```

For ordinary game methods, static `IPatchMethod` classes are easier to read and review.


## Transpiler Wrappers

Use `HarmonyIl`, `HarmonyIlPattern`, and `HarmonyIlRewriter` for transpilers that must edit IL.
Do not directly build long ad hoc `CodeInstruction` chains in patch bodies.

```csharp
var rewriter = HarmonyIlRewriter.From(instructions);
var pattern = HarmonyIlPattern.Sequence(
    HarmonyIl.IsLdstr("prefix"),
    HarmonyIl.IsLdloc(),
    HarmonyIl.IsCall(concatMethod),
    HarmonyIl.IsStloc());

var report = rewriter.TryInsertAfterFirst(
    "MyPatch insert override",
    pattern,
    [
        HarmonyIl.Ldarg(0),
        HarmonyIl.Call(overrideMethod),
    ],
    code => code.Any(instruction => HarmonyIl.IsCallTo(instruction, overrideMethod)));

report.RequireSucceeded();
if (report.Applied > 0)
    report.RequireExactly(1);

return rewriter.InstructionsChecked("MyPatch insert override");
```

Use report expectations to prove the rewrite happened, or that equivalent IL was already present.
Use `InstructionsChecked` to validate common structural errors such as missing branch labels or invalid reflection operands.
For methods that another mod may have already modified, pass an `alreadySatisfied` predicate and use anchor searches such as `TryFindAfter` / `TryFindBefore` instead of replacing wide instruction spans.


## Async Patch Helpers

For async methods that can be composed at the method boundary, prefer a normal Harmony postfix that replaces
`ref Task __result` / `ref Task<T> __result` with `HarmonyAsyncTaskBridge.After(...)`.

For async state-machine transpilers, use `HarmonyAsyncIl` to recognize compiler-generated await sites before
rewriting them. `RedirectAwaitedCalls` is the narrowest option: it only redirects calls that are directly awaited
by the state machine and requires the replacement method to preserve the stack shape and exact awaitable return
type. Use `ReplaceAwaitedCalls` when the replacement must load extra state-machine fields or emit a short custom
instruction payload before returning the same awaitable type.

```csharp
var rewriter = HarmonyIlRewriter.From(instructions);
var report = HarmonyAsyncIl.RedirectAwaitedCalls(
    rewriter,
    "Redirect awaited OnPlay",
    originalOnPlayMethod,
    wrapperMethod,
    code => code.Any(instruction => HarmonyIl.IsCallTo(instruction, wrapperMethod)));

report.RequireSucceeded();
report.RequireExactly(1);
return rewriter.InstructionsChecked("Redirect awaited OnPlay");
```

This helper does not create new async states. If a patch needs an additional independent await point, prefer a
task-wrapper design or a narrower awaited-call wrapper first.


## Original IL Inspection Helpers

Submods that need to classify method behavior can inspect original IL without creating a transpiler.
`GetOriginalIl()` resolves an async method to its generated `MoveNext` body by default and exposes both the
instruction snapshot and its ordered call targets:

```csharp
var body = onPlayMethod.GetOriginalIl();
var directlyCallsTarget = body.HasCall(IsTargetMethod);
```

For explicitly bounded helper-method traversal, use `HasOriginalIlCall()` or
`FindOriginalIlCallPath()`:

```csharp
var path = onPlayMethod.FindOriginalIlCallPath(
    isTarget: IsTargetMethod,
    shouldTraverse: called => called.DeclaringType == cardType);
```

Traversal is opt-in and returns the shortest matching path. Supply a narrow `shouldTraverse` predicate; the helper
does not infer virtual dispatch, delegate targets, reflection calls, or arbitrary transitive behavior.
These APIs inspect original method IL. They do not include Harmony transpiler output and do not cache
domain-specific classifications.

This inspection layer and `HarmonyAsyncIl` serve different purposes. Inspection resolves an async method body and
queries ordinary calls. `HarmonyAsyncIl` recognizes compiler-generated await-site structure when a transpiler must
safely redirect or replace a directly awaited call.


## Release Checklist

- Give every patch a stable `PatchId`.
- Set `IsCritical = false` for compatibility patches that can safely be skipped.
- Add `parameterTypes` for overloaded targets.
- Use `HarmonyIlRewriter` / `HarmonyIlPattern` wrappers, report expectations, and `InstructionsChecked` for fragile transpilers.
- Prefer lifecycle events and registries when they cover the use case.
