# Privacy Policy — TokenTracker

**Last updated:** 2026-07-18

TokenTracker is a **local-first** mobile app. This document is intentionally short and literal.

## Zero usage recorded by the project

**TokenTracker does not operate servers that receive your usage data.**

- No analytics or product telemetry
- No crash-reporting that uploads prompts or API keys
- No user accounts
- No cloud sync
- No advertising identifiers

If you never install third-party forks that change this behavior, **zero usage is ever recorded** by TokenTracker itself.

## What is stored on your device

| Data | Storage | Notes |
|------|---------|--------|
| API keys | OS secure store (Keychain / Keystore) via `expo-secure-store` | Encrypted by the platform; not in git |
| Provider labels & usage snapshots | AsyncStorage (on device) | Non-secret metadata only |
| Web (dev) keys | AES-GCM with a local master key | For browser development only |

## What leaves the device

Only **HTTPS requests you initiate** to the LLM providers you configure:

- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- xAI (`api.x.ai`)
- OpenRouter (`openrouter.ai`)
- Google AI (`generativelanguage.googleapis.com`)
- Any custom base URL you enter

Those providers have their own privacy policies. TokenTracker is not a proxy and does not sit in the middle.

## What we never collect

- Prompts and completions (the app is not a chat client)
- API keys (never transmitted to us — we have nowhere to send them)
- Device advertising IDs
- Location

## Deleting data

Use **Privacy → Wipe all local data** in the app, or uninstall the app. That removes local keys and snapshots from that device.

## Open source

Source: [github.com/jdodsoncollins/TokenTracker](https://github.com/jdodsoncollins/TokenTracker)  
License: MIT

Audit the code paths under `src/services/` if you want to verify network and storage behavior yourself.
