# Contributing to TokenTracker

Thanks for helping keep a privacy-first tracker honest and useful.

## Ground rules

1. **No telemetry** — do not add analytics, crash uploaders, or “phone home” without an explicit, opt-in, documented design that preserves the zero-recording promise for default installs.
2. **No secrets in the repo** — never commit API keys, `.env` files with secrets, or screenshots that show full keys.
3. **Keys only in SecureStore** — never put credentials in AsyncStorage, logs, or Redux-style dumps.
4. **MIT** — by contributing you agree your changes are licensed under the MIT License.

## Dev setup

```bash
npm install
npm start
npm test
npm run typecheck
```

## Pull requests

- Keep diffs focused.
- Prefer provider adapters under `src/services/providers/`.
- Add or update unit tests for pure logic.
- Update `PRIVACY.md` if storage or network behavior changes.
