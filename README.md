# TokenTracker

**Local-first LLM API usage tracker** for OpenAI, Anthropic, xAI (Grok), OpenRouter, Google Gemini, and custom OpenAI-compatible endpoints.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Privacy: zero telemetry](https://img.shields.io/badge/privacy-zero%20telemetry-brightgreen.svg)](./PRIVACY.md)

<p align="center">
  <strong>Simple · Attractive · Local-first · Open source</strong>
</p>

## Why

Cloud dashboards are scattered. TokenTracker gives you one place to see spend and tokens without another account.

TokenTracker runs entirely on your device.

## Privacy promise

> **TokenTracker receives no usage.**

- No TokenTracker backend or telemetry
- No accounts  
- Native credentials persist in OS secure storage through `expo-secure-store`. TokenTracker does not require biometric authentication or claim secure enclave storage.
- Web credentials stay in memory and disappear on reload.
- **Save and validate** and **Refresh** send keys directly to the selected provider. TokenTracker receives no prompts or provider response bodies.
- Usage metadata stays in AsyncStorage. Android backup is disabled, but iOS or platform-managed device backups may include it.

Full details: [PRIVACY.md](./PRIVACY.md)

## Features

- **Multi-provider**: OpenAI, Anthropic, xAI/Grok, OpenRouter, Gemini, and custom bases
- **Native secure storage**: Keychain / Keystore through `expo-secure-store`
- **Auto usage** where the provider allows, such as OpenRouter key usage and OpenAI organization costs with admin keys
- **Manual snapshots** when auto usage is unavailable
- **Usage charts**: 7 / 14 / 30 day timelines from local history
- **Cost estimates**: provider-reported costs take precedence; token-based estimates require an explicit model and use its configured rates
- **Platform-native chrome**: Liquid Glass-inspired surfaces and a floating tab bar on iOS; Material 3 Expressive tonal surfaces and navigation indicators on Android ([DESIGN.md](./DESIGN.md))
- **Clean dark UI**: dashboard, provider management, privacy tab
- **Wipe everything**: one control erases local keys and history

## Screenshots

Run the app to explore the Home, Providers, and Privacy tabs. (PRs with screenshots welcome.)

## Quick start

```bash
git clone https://github.com/jdodsoncollins/TokenTracker.git
cd TokenTracker   # or your local folder, e.g. dev/tokentracker
npm install
npx expo start
```

Then open in Expo Go, an iOS simulator, Android emulator, or web.

## How credentials work

1. You paste an API key in the app.  
2. Native apps persist it with `SecureStore`, without biometric authentication. Web builds keep it in memory until reload.
3. **Save and validate** and **Refresh** send it directly to the selected provider. Custom endpoints require HTTPS except `http://localhost` and `http://127.0.0.1` during local development.
4. TokenTracker stores provider labels and usage snapshots in AsyncStorage. It does not send prompts or provider response bodies to TokenTracker infrastructure because no such infrastructure exists.

Cumulative readings carry forward and produce deltas only against a compatible cumulative reading. Period and point readings appear only on the day observed. TokenTracker keeps readings separate when their measurement windows differ. A token-based cost estimate requires you to select a model explicitly; TokenTracker labels the result as an estimate.

**Never commit keys.** `.gitignore` blocks `.env`, secrets, and key material. Use the in-app form only.

## Provider notes

| Provider | Auto usage | Notes |
|----------|------------|--------|
| OpenAI | Org costs with **admin** key | Project keys validate; use manual spend if needed |
| Anthropic | Usage report with **admin** access | Standard keys validate; manual otherwise |
| xAI (Grok) | Key validation | Manual cost snapshots supported |
| OpenRouter | Lifetime USD on key endpoint | Best out-of-the-box auto usage |
| Google Gemini | Key validation | Billing in Google Cloud; manual snapshots |
| Custom | Optional `/v1/models` check | OpenAI-compatible base URL |

## Project layout

```
src/
  app/           # shell + context (platform tab chrome)
  components/    # UI pieces + ui/ Surface, Screen, buttons
  screens/       # Home, Providers, Detail, Privacy
  services/      # secure store, local cache, provider adapters
  theme/         # Liquid Glass + Material 3 tokens
  types/         # shared types
```

Design notes and HIG / M3 citations: [DESIGN.md](./DESIGN.md).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run ios` / `android` / `web` | Platform targets |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (vitest) |
| `npm run test:coverage` | Unit tests + v8 coverage (domain logic ≥80%) |
| `npm run smoke` | Offline manual gate: typecheck + coverage |

## Security hygiene

- Do not put real API keys in issues, PRs, or screenshots  
- Prefer least-privilege / read-only or admin keys scoped only as needed  
- Rotate keys if a device is lost  
- Use **Wipe all local data** before handing a phone off  

## Contributing

Issues and PRs welcome. Please keep the privacy bar high: no analytics “just for debugging,” no mandatory accounts, no secret-exfiltrating sample code.

## License

[MIT](./LICENSE) © 2026 Jeremy Collins
