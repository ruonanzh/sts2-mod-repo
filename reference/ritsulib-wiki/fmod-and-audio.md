## Play Audio

Use `GameAudioService.Shared` for new code. It accepts event paths, GUIDs, loose sound files, streaming music files, and snapshots through `AudioSource`.

```csharp
using STS2RitsuLib.Audio;

GameAudioService.Shared.PlayOneShot(
    AudioSource.Event("event:/MyMod/ui/click"),
    new AudioPlaybackOptions
    {
        Volume = 0.8f,
        Parameters = FmodParameterMap.Set(("intensity", 1f)),
        Scope = AudioLifecycleScope.Room,
    });
```

For quick compatibility with existing path-based calls, `GameFmod.Studio` and `Sts2SfxAlignedFmod` remain available.


## Loops And Music

Keep the returned handle when you need to stop or adjust playback later.

```csharp
var loop = GameAudioService.Shared.PlayLoop(
    AudioSource.Event("event:/MyMod/ambience/engine"),
    new AudioPlaybackOptions
    {
        Routing = new AudioRoutingOptions(Channel: "my_mod_ambience"),
        Scope = AudioLifecycleScope.Run,
    });

loop?.TrySetParameter("danger", 0.5f);
loop?.TryStop();
```

Use `PlayMusic(...)` for music handles and `FollowAdaptiveMusic(...)` for room / combat / victory plans.


## Audio Files

`AudioSource.File(...)` and `AudioSource.StreamingMusic(...)` take an absolute path, a `user://` path, or a raw `res://` file. Set the file's import mode to "Keep File (No Import)" so it is packed as-is. `AudioSource.ResourceFile(...)` and `AudioSource.StreamingResourceMusic(...)` also accept imported audio: WAV, MP3, and Ogg Vorbis data is extracted into a private cache. Imported IMA ADPCM and QOA WAV resources are decoded to PCM WAV.

The cache uses ASCII virtual paths, so non-ASCII user names and resource names do not prevent playback. Loose files with non-ASCII paths are localized or copied into the cache before loading. Each source file and cached result is limited to 256 MiB. Compressed WAV decoding is limited to 600 seconds. Dynamic and interactive streams are not supported by these file APIs.


## Banks And GUID Mappings

Load banks before using their events:

```csharp
FmodStudioDeferredBankRegistration.RegisterBank("res://MyMod/audio/MyMod.bank");
FmodStudioDeferredBankRegistration.RegisterStudioGuidMappings("res://MyMod/audio/guid_map.json");
```

If a bank is optional, use the lower-level `FmodStudioServer.TryLoadBank(...)` and handle failure gracefully.


## Lifecycle And Routing

| Option | Use |
| --- | --- |
| `Scope` | Stops audio automatically with room, combat, run, or manual lifetime. |
| `ScopeToken` | Groups handles under a manual scope. |
| `Routing.Channel` | Allows one active handle per channel, optionally replacing the old one. |
| `Routing.Tag` | Groups several handles for `StopTag(...)`. |
| `CooldownMs` | Prevents rapid repeated playback. |
| `UseVanillaRouting` | Lets one-shot and music event paths route through vanilla where applicable. |

Use routing for UI and looping ambience. Avoid global stop calls unless the mod owns all audio in that group.
