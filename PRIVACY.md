# Privacy Policy: TokenTracker

**Last updated:** 2026-07-23

TokenTracker is a **local-first** mobile app. This document is intentionally short and literal.

## TokenTracker receives no usage

**TokenTracker does not operate servers that receive your usage data.**

- No analytics, product telemetry, or TokenTracker backend
- No crash reporting
- No user accounts
- No built-in cloud sync
- No advertising identifiers

The app records usage snapshots on your device. TokenTracker receives none of that usage, and it receives no prompts or provider response bodies.

## What is stored on your device

| Data | Storage | Notes |
|------|---------|--------|
| Native API keys | OS secure storage (Keychain / Keystore) through `expo-secure-store` | Persisted by the platform; no biometric authentication; not necessarily stored in secure enclave hardware |
| Provider labels and usage snapshots | AsyncStorage | Usage metadata stored on the device |
| Web API keys | Process memory | Disappear when the page reloads |

Android backup is disabled for TokenTracker. iOS and other platform-managed device backups may include AsyncStorage usage metadata, so a platform backup can create a cloud copy of that metadata.

## What leaves the device

**Save and validate** and **Refresh** send your key directly to the selected provider. TokenTracker sends no request through a TokenTracker server. Custom endpoints require HTTPS, except `http://localhost` and `http://127.0.0.1` during local development.

- OpenAI (`api.openai.com`)
- Anthropic (`api.anthropic.com`)
- xAI (`api.x.ai`)
- OpenRouter (`openrouter.ai`)
- Google AI (`generativelanguage.googleapis.com`)
- A custom base URL you enter

Those providers receive the API requests and apply their own privacy policies. TokenTracker has no proxy. The app processes provider response bodies locally and does not send them, or your prompts, to TokenTracker.

## How usage is measured

TokenTracker stores each provider result or manual entry as a local snapshot. Cumulative readings carry forward and produce deltas only against compatible cumulative readings. Period and point readings appear only on the day observed. TokenTracker does not combine readings with different measurement windows.

Provider-reported cost takes precedence. If a snapshot contains tokens but no cost, TokenTracker estimates cost only when you explicitly select a model. The estimate uses that model's configured rates and remains labelled as an estimate.

## What we never collect

- Prompts and completions
- API keys
- Provider response bodies
- Device advertising IDs
- Location

## Deleting data

Use **Privacy → Wipe all local data** to remove local keys and snapshots. Uninstalling removes app data, but OS secure storage retention varies by platform.

## Open source

Source: [github.com/jdodsoncollins/TokenTracker](https://github.com/jdodsoncollins/TokenTracker)  
License: MIT

Audit the code paths under `src/services/` if you want to verify network and storage behavior yourself.
