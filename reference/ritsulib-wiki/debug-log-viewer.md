## What It Is

RitsuLib can start a browser-based live log viewer for the current game session. It is meant for development, compatibility checks, and fast inspection while the game is still running.

Use it when a normal `godot.log` tail is too slow, when you want to inspect the latest records from another screen, or when a tester needs a browser URL instead of a local file path.


## Enable And Open

The viewer is configured from the built-in RitsuLib settings pages. After startup you can open the current viewer from the settings page, or from the dev console:

```text
openlogviewer
```

When auto-open is enabled, RitsuLib waits briefly after startup. If no browser page is already connected, it opens the viewer in the system browser.


## LAN Access And Token

By default the viewer listens on loopback only. Enable LAN access only when another device on the same network really needs to connect.

LAN mode exposes the viewer on all network interfaces and uses a tokenized browser URL. Treat that URL as a local secret for the session: share it only with the people or devices that actually need access.

Port and LAN binding changes apply on the next game launch.


## What Shows Up

The viewer keeps a recent in-memory ring buffer and streams new records live. It can also mirror game logger callbacks, so it is useful for checking both framework messages and ordinary runtime diagnostics in one place.

If you are debugging a noisy issue, keep the browser viewer for the live stream and still preserve normal log files for later attachments or release reports.


## Practical Notes

- Use loopback mode for normal solo development.
- Use LAN mode only for short-lived debugging with a second device or remote tester on the same network.
- Keep the port stable once a team starts bookmarking the viewer URL.
- If the viewer is unavailable, fall back to the normal file logs and check whether the session started the viewer at all.
