# TokenTracker

**Local-first LLM API usage tracker** for OpenAI, Anthropic, xAI (Grok), OpenRouter, Google Gemini, and custom OpenAI-compatible endpoints.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Privacy: zero telemetry](https://img.shields.io/badge/privacy-zero%20telemetry-brightgreen.svg)](./PRIVACY.md)

<p align="center">
  <strong>Simple · Attractive · Offline encrypted credentials · Radically transparent</strong>
</p>

## Why

Cloud dashboards are scattered. You want one place on your phone to see spend and tokens — without creating yet another account that harvests your usage.

TokenTracker runs entirely on your device.

## Privacy promise

> **Zero usage is ever recorded by TokenTracker.**

- No TokenTracker backend  
- No analytics SDK  
- No accounts  
- API keys stay in the OS secure enclave (`expo-secure-store`)  
- Network traffic goes **only** to the providers you add  

Full details: [PRIVACY.md](./PRIVACY.md)

## Features

- **Multi-provider** — OpenAI, Anthropic, xAI/Grok, OpenRouter, Gemini, custom bases  
- **Encrypted credentials** — Keychain / Keystore; never committed to git  
- **Auto usage** where the provider allows (e.g. OpenRouter key usage, OpenAI org costs with admin keys)  
- **Manual snapshots** when auto-usage isn’t available  
- **Clean dark UI** — dashboard, provider management, privacy tab  
- **Wipe everything** — one control to erase local keys + history  

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
2. It is written with `SecureStore` (native) — not AsyncStorage, not env files.  
3. On refresh, the key is read in memory and sent **only** to that provider over HTTPS.  
4. Usage numbers are cached locally for the dashboard.

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
  app/           # shell + context
  components/    # UI pieces
  screens/       # Home, Providers, Detail, Privacy
  services/      # secure store, local cache, provider adapters
  theme/         # colors / spacing
  types/         # shared types
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run ios` / `android` / `web` | Platform targets |
| `npm run typecheck` | TypeScript |
| `npm test` | Unit tests (vitest) |

## Security hygiene

- Do not put real API keys in issues, PRs, or screenshots  
- Prefer least-privilege / read-only or admin keys scoped only as needed  
- Rotate keys if a device is lost  
- Use **Wipe all local data** before handing a phone off  

## Contributing

Issues and PRs welcome. Please keep the privacy bar high: no analytics “just for debugging,” no mandatory accounts, no secret-exfiltrating sample code.

## License

[MIT](./LICENSE) © 2026 Jeremy Collins
