## Use Warnings As Release Signals

RitsuLib tries to log one clear warning for common authoring problems:

| Warning area | Usually means |
| --- | --- |
| Content registration | A model was registered too late, twice, or with a conflicting id. |
| Asset paths | A profile points at a missing resource. |
| Localization | A key is missing from a game table or I18N source. |
| Unlocks | A rule references an epoch or character that cannot resolve. |
| Patching | A required target method is missing or a patch class has no Harmony method. |
| Audio | A bank, event path, GUID mapping, bus, or loose audio file could not be resolved. |

Treat character asset warnings, required patch failures, and model-id conflicts as release blockers.


## Debug Compatibility Mode

RitsuLib's own debug compatibility mode is on by default. The RitsuLib settings page exposes fallback toggles for development and compatibility testing, and you can turn the mode off there when you need strict vanilla behavior.

Use it to investigate missing localization, invalid unlock epochs, and missing Architect dialogue. Do not rely on debug fallbacks as the normal release path for your mod.


## Browser Debug Log Viewer

For interactive debugging, RitsuLib can also host a browser-based live log viewer for the current session. It is useful when a tester needs a URL, when you want a second-screen log view, or when you need to inspect fresh warnings without leaving the running game.

Use loopback mode for normal development. Enable LAN access only when another device on the same network needs the viewer, and treat the tokenized URL as session-local access data.

See [Debug log viewer](/guide/debug-log-viewer) for setup and usage details.


## Missing Character Saves

If a continue-run save references a character that is no longer registered, RitsuLib now blocks the resume attempt before vanilla run restoration starts.

Expected behavior:

- The run save stays on disk
- The player gets the normal load-failure UI
- RitsuLib logs a warning explaining that the save references an unregistered character

Treat this as a dependency or load-order problem, not as a signal to delete the save immediately.


## Game Source Notes

When checking decompiled or reference game source, keep these rules in mind:

- Match the game API branch used by your package (`STS2.RitsuLib` or `STS2.RitsuLib.Compat.<api-version>`).
- Confirm method overloads before writing a `ModPatchTarget`; use `parameterTypes` when there is any ambiguity.
- Some lifecycle hooks differ by host API. Prefer RitsuLib events such as `CardsFlushedEvent` when they already bridge those differences.
- If a behavior depends on a private field or compiler-generated state machine, isolate it behind a small compatibility helper and add diagnostics.


## Release Checklist

- Build against the intended game API branch.
- Start a new run and load an existing run.
- Switch profiles if the mod uses `SaveScope.Profile`.
- Verify both installed languages you ship.
- Open all settings pages from main menu and pause menu.
- Check logs for RitsuLib warnings after content registration and after first combat.
- Test optional compatibility patches with their target feature absent.
