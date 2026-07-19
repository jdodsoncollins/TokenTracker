# Design system — TokenTracker

TokenTracker adapts chrome and surfaces per platform using official guidance from Apple and Google, while keeping a single React Native codebase.

## Sources of truth

### Apple

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass) (iOS / iPadOS / macOS 26+)
- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- WWDC25: *Meet Liquid Glass*, *Get to know the new design system*

**Principles we apply**

| Principle | In this app |
|-----------|-------------|
| Content in focus | Dense data (charts, lists) stays opaque; glass is reserved for **navigation chrome** and **elevated cards** |
| Hierarchy through depth | Translucent layers + soft rim light; ambient gradient behind glass |
| Judicious color on chrome | Accent used for active tabs, CTAs, and privacy emphasis — not full-surface fills |
| Familiar navigation | Bottom tabs; floating glass bar on Apple platforms |
| Legibility | High-contrast text on dark canvas; blur only behind UI, not under body copy alone |

### Google

- [Material Design 3](https://m3.material.io/)
- [M3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) — vibrant color, motion physics, shape scale, adaptive components
- [Material 3 in Compose](https://developer.android.com/develop/ui/compose/designsystems/material3) (role mapping)

**Principles we apply**

| Principle | In this app |
|-----------|-------------|
| Tonal surfaces | `surface` / `surface-container` equivalents: `bg`, `bgElevated`, `bgCard` |
| Expressive shape | Larger corner radii on primary actions; pill nav indicator |
| Vibrant hierarchy | Slightly brighter primary on Android (`#B4A7FF`) for key actions |
| Navigation bar | Edge-to-edge bottom bar with **active indicator pill** (M3 pattern) |
| Touch feedback | Android ripples on buttons and cards |

## Implementation map

| Concern | iOS / web (Liquid Glass lean) | Android (M3 Expressive) |
|---------|-------------------------------|-------------------------|
| Theme | `src/theme/tokens.ts` → liquid glass palette | same file → material3 palette |
| Surfaces | `Surface` + `expo-blur` + specular gradient | Tonal fill + soft elevation |
| Screen canvas | Soft brand glow + depth gradient | Surface canvas + subtle primary glow |
| Tab bar | Floating blurred capsule | Docked nav bar + indicator |
| Buttons | Capsule (`radius.full`) | Expressive large radius + ripple |
| Cards | Glass border / blur | `surface-container` border |

## What we intentionally do *not* do

- **Do not** put Liquid Glass behind every list row (Apple: avoid glass fatigue / readability issues).
- **Do not** invent a third “cross-platform glass” that ignores Material guidance on Android.
- **Do not** claim pixel-perfect system Liquid Glass optics — true refraction is a platform material. We approximate with blur, translucency, and rim light so Expo apps feel at home until full native glass APIs are available in managed workflow.
- **Do not** sacrifice privacy UI clarity for decoration — contrast on privacy messaging stays high (HIG + WCAG spirit).

## Components

- `src/components/ui/Surface.tsx` — platform surface
- `src/components/ui/Screen.tsx` — edge-to-edge content host
- `src/components/ui/PrimaryButton.tsx` — filled / tonal / outline / danger
- `src/app/RootShell.tsx` — tab chrome

## Extending

1. Add new semantic colors only in `tokens.ts` for both palettes.
2. Prefer `Surface` over ad-hoc `backgroundColor` on cards.
3. Prefer `PrimaryButton` for actions so platform shape/ripple stay consistent.
4. When Expo or React Native ships official Liquid Glass / M3 wrappers, swap implementations inside `Surface` and `RootShell` first — screens should not hardcode blur.
