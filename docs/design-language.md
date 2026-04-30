# LearnAI Design Language

> One source of truth for the visuals. If you change a value here, change it in the codebase too — and vice versa.

LearnAI runs a single, opinionated dark theme — it's a builder's tool, not an editorial site. Color, type, and motion are tuned for **focus, calm, and a hint of fun**. Everything earns its place; nothing sparkles for sparkle's sake.

This doc covers tokens, primitives, voice, and the rules that keep the surface coherent. New components reference these; ad-hoc Tailwind values should be a smell.

---

## 1. Color tokens

Defined in [`app/tailwind.config.js`](../app/tailwind.config.js); used through Tailwind class names (`bg-accent`, `text-bad`, etc.).

| Token | Hex | Where it shows up |
|---|---|---|
| `ink` | `#0b1020` | Page base; body gradient anchor (top) |
| `ink2` | `#121833` | Card surfaces (with `/70` opacity) |
| `accent` | `#7c5cff` | Primary action, focus rings, current-node, brand mark gradient (start) |
| `accent2` | `#28e0b3` | Progress bars (end), brand mark gradient (end) |
| `good` | `#28e0b3` | Success state (alias of `accent2`) |
| `warn` | `#ffb547` | Warnings, caution chips |
| `bad` | `#ff5d8f` | Errors, danger zone, destructive actions |
| `soft` | `#1b2348` | Skill-tree node base, neutral surfaces |

**Usage rules**

- Text on dark surfaces uses `text-white` with explicit `/N` opacity for hierarchy: `white` (primary), `white/70` (body), `white/60` (muted), `white/50` (label), `white/40` (auxiliary). Never use a separate gray token — the opacity ladder is the typography color scale.
- `accent` and `accent2` only co-occur as a gradient (`from-accent to-accent2`) — they're the brand pair. Don't pair them at full saturation in two adjacent solid blocks.
- `bad` is reserved for destructive intent. Don't use it for "wrong answer" feedback unless that answer is also irreversible.

---

## 2. Typography

Two faces, both via Google Fonts (preconnected in `app/index.html`):

- **Inter** — body, UI, prose. Set as `font-sans` and the default in `:root`.
- **Space Grotesk** — display + headings. Set as `font-display`.

| Class | Maps to | Use |
|---|---|---|
| `.h1` | `text-3xl sm:text-4xl font-display font-bold tracking-tight text-white` | Page or modal title. One per screen. |
| `.h2` | `text-xl sm:text-2xl font-display font-semibold tracking-tight text-white` | Section title inside a card. |
| `.label` | `text-xs uppercase tracking-wider text-white/50 font-semibold` | Field labels, table headers. |
| `.muted` | `text-white/60` | Secondary prose. |

Inter for almost everything. Space Grotesk earns its weight on hero numbers (XP, streak count, level number) and the few headlines that anchor a screen.

---

## 3. Component primitives

Defined in [`app/src/index.css`](../app/src/index.css) under `@layer components`. Use these instead of re-rolling the same Tailwind chain across files.

| Class | Composition (current) | When to use |
|---|---|---|
| `.card` | `bg-ink2/70 border border-white/5 rounded-2xl shadow-card backdrop-blur-md` | The default container for a logical grouping. Don't nest two `.card`s deep — flatten or use a divider. |
| `.btn` | flex, `rounded-xl`, `px-4 py-2.5`, `font-semibold`, active-press scale, disabled state | Base for every button. Almost never used directly; pick a variant. |
| `.btn-primary` | `.btn bg-accent text-white shadow-glow hover:brightness-110` | The single most important action on a screen. Only one per visual context. |
| `.btn-ghost` | `.btn bg-white/5 text-white hover:bg-white/10 border border-white/10` | Secondary action. Plays well alongside `btn-primary`. |
| `.btn-good` / `.btn-bad` | tonal fills | Confirm-success / destructive-confirm. Pair with a confirmation prompt. |
| `.chip` | small pill, `bg-white/5`, border `white/10` | Status, tag, count. |
| `.pill` | larger pill | Inline action context (e.g. tier display). |
| `.input` | `bg-white/5 border border-white/10 rounded-xl`, focus ring `accent/60` | All text inputs; `input` element. |
| `.progress` + child `> div` | bar in `white/5`, fill is `accent → accent2` gradient | XP, level progress, completion. |
| `.node` (+ states) | skill-tree pip with `unlocked / completed / current / locked` modifiers | Constellation map only. |
| `.dot` | 1.5 × 1.5 accent-coloured dot | Inline "live" / unread indicator. |

**Rules of thumb**

- If the same five-class Tailwind chain appears more than twice, it should be a primitive. Add it here and to `index.css`.
- Don't introduce shadows beyond `shadow-card` and `shadow-glow`. Two shadows is a noise budget.
- Border radius scale: `rounded-xl` (interactive controls) and `rounded-2xl` (containers). Keep it boring.

---

## 4. Surfaces and motion

Backgrounds are not flat. The body uses two soft radial glows + a vertical gradient (see `body` rule in `index.css`). New surfaces should either inherit that mood or, for mascot/hero, lift to `bg-gradient-to-br from-accent to-accent2` with `shadow-glow`.

Motion library (Tailwind animations): `pop` (220ms entry), `float` (4s loop, mascot), `wiggle` (400ms emphasis). All else uses CSS `transition` defaults — keep the motion vocabulary tight.

---

## 5. Mascot, illustrations, and emoji

- **EmDash** is the mascot — see `app/src/visuals/Mascot.tsx`. Use it on empty states, first-time screens, and nudges, not as decoration on every card. The display name is `adminCfg.branding.mascotName` so a fork can rename it; never hardcode "EmDash" in UI strings — read it from the admin config.
- **Illustrations** (`Illustrations.tsx`) are abstract gradient shapes — `rocket`, `neural`, `embed`, etc. Tag a screen with at most one. They live at low opacity (`/50` or below) so they don't fight the content.
- **Emoji** are first-class typography. Use them in Spark titles, badges, and CTAs where they earn the slot. Keep them out of code, commit messages, and PR descriptions.

---

## 6. Third-party UI we have to host

Some auth and integration widgets ship their own visuals (Google Identity Services, Stripe, etc.). When a vendor's stock UI doesn't match this language:

- **Prefer to host the click target ourselves.** Render the vendor button invisibly as an overlay and stack our own design-system button on top. See `app/src/views/SignIn.tsx` — Google's `renderButton` is mounted with `opacity: 0` over a `.btn-primary`, so the auth flow runs unchanged but the user sees our button.
- **Never re-skin a vendor's button via DOM hacks.** If the overlay trick can't work for a particular vendor (e.g. they use shadow DOM that intercepts clicks), wrap their stock UI in a card that absorbs it gracefully — don't try to recolour it.
- **One exception**: vendor logos in attribution lockups stay on-brand for them, not us. A Google "G" mark is multi-colour by trademark; if we strip it to single-tone we use the simplified flat mark, never a redrawn one.

---

## 7. Voice

Visual language and copy live together. The tone rules are in [`CLAUDE.md`](../CLAUDE.md#default-tone-for-content-sparks-docs-ui-strings) — the short version:

- Plain English, smart-friend tone.
- Concrete > abstract. Example > definition.
- Short > long. *60 words is a luxury.*
- Real names where the level supports it (Claude, GPT, Cursor, pgvector, Claude Code).

This applies to UI strings as much as to Sparks.

---

## 8. Updating this doc

If you ship a change that touches the surface — adds a colour, a shadow, a new primitive, a new motion — update this doc in the same PR. The values in `index.css` and `tailwind.config.js` are the runtime; this file is the contract.

Cross-references:
- Runtime tokens: [`app/tailwind.config.js`](../app/tailwind.config.js)
- Primitives: [`app/src/index.css`](../app/src/index.css)
- Mascot + illustrations: [`app/src/visuals/`](../app/src/visuals/)
- Voice + copy rules: [`CLAUDE.md`](../CLAUDE.md)
