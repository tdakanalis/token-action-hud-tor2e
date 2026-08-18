# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Foundry VTT module that bridges the **TOR2E** (The One Ring 2nd Edition) game system with **Token Action HUD Core**. It contributes a `SystemManager` that Core consumes; it does not render UI itself. All of it is plain ESM under `scripts/` — no framework, no bundler dependency at runtime.

## Commands

```bash
npm install
npm run build      # rollup -c  → dist/ (see "The build is not shipped" below)
npm run dev        # rollup -wcm (watch)
./start.sh         # Foundry in Docker on :30000 (mounts repo root as the module)
./stop.sh
```

No test suite and no linter are configured. The only devDependencies are the rollup build chain and semantic-release.

`start.sh` reads `.env` for `FOUNDRY_USERNAME`, `FOUNDRY_PASSWORD`, `FOUNDRY_ADMIN_KEY`, `FOUNDRY_VERSION`. `deployment/docker-compose.yml` bind-mounts the repo root into `/data/Data/modules/token-action-hud-tor2e`, so **editing `scripts/` and reloading Foundry (F5) is the dev loop** — no build step needed.

## The build is not shipped

`module.json` declares `esmodules: ["scripts/module.js"]`, and the semantic-release `prepareCmd` zips `scripts/ styles/ languages/ module.json CHANGELOG.md`. `dist/token-action-hud-tor2e.min.js` is never referenced or packaged; `npm run build` is effectively a CI syntax check. Don't "fix" this by pointing users at `dist/`.

## Release

Push to `main` triggers `.github/workflows/release.yml` → semantic-release. **Conventional commits drive the version**; `substitute-module-json.sh` rewrites `version`/`url`/`manifest`/`download` in `module.json`, and CI commits `module.json` + `CHANGELOG.md` back. Never bump the version by hand.

## Architecture

### Runtime class definition inside hooks

`TOR2ESystemManager`, `TOR2EActionHandler`, and `TOR2ERollHandler` are exported as `let` bindings that stay `null` until the `tokenActionHudCoreApiReady` hook fires — the base classes live on `coreModule.api.*` and only exist then. Every new handler class must follow this pattern; a top-level `class X extends coreModule.api.Y` will throw at load.

`scripts/module.js` is the entry: it defines the SystemManager (layout + settings registration), attaches it to `game.modules.get(MODULE_ID).api`, and calls `Hooks.call('tokenActionHudSystemReady', module)`.

### The three moving parts

- **`constants.js`** — `getGroup(coreModule)` is the single source of truth for group ids/names/icons; `getSettings(coreModule)` for world settings; `SKILLS` and `STATS` are the TOR2E taxonomy (which skill belongs to strength/heart/wits, which resources exist).
- **`action-handler.js`** (~760 lines, the bulk) — `buildSystemActions()` populates the HUD by calling `_load*()` methods, each pushing `addActions([...], group)`.
- **`roll-handler.js`** — `handleActionClick(event, encodedValue)` dispatches what was clicked.

### The encodedValue contract

Action handler builds: `[actionType, actorType, macroType, macroSubType].join(this.delimiter)`.
Roll handler splits on `"|"` (hardcoded, matching Core's delimiter) and switches on `actionType`, then usually branches again on `actorType`.

**Adding an action means editing both files**: emit the `encodedValue` in a `_load*` method, and add the matching `case` to the `switch` in `handleActionClick`. An unmatched `actionType` fails silently.

### Two HUD modes

`buildSystemActions()` forks on whether a single actor is selected:
- `this.actor` set → the full per-actor tree (stats, skills, combat, traits, misc, community).
- otherwise → multi-token mode using `this.actors`: GM combat utilities plus group effects/health, all emitted with `actionType`/`actorType` of `'multiple'` and routed through `_handleMultipleTokens`. The two multi-token sections are gated by the `displayPlayerHealthEvents` / `displayPlayerEffects` settings for non-GMs.

Macros are loaded in both modes and grouped dynamically by Foundry folder name via `addGroup(...)`.

### Modifier clicks

Handled up front in `handleActionClick` before the dispatch switch: right-click opens the item sheet; on character weapons/armour Ctrl = equip, Alt = unequip, Shift = drop (`_setItemStatus` toggles `system.equipped.value` / `system.dropped.value`).

### Actor types

`character`, `adversary`, `npc`, `lore`. Almost every `_load*` and roll method branches on these, and most features are character-only. When adding anything, decide explicitly which types it applies to — the existing code guards with `if (this.actor.type === ...)` or `['character','adversary','lore','npc'].includes(...)`.

### Coupling to the TOR2E system

The module reaches directly into the game system in two ways:

1. **Static imports of absolute Foundry paths** — `/systems/tor2e/modules/utilities.js`, `.../hud/Tor2eTokenHudExtension.js`, `.../combat/Tor2eStance.js`. These are listed in `rollup.config.js` under `external`; **any new system import must be added there** or the build breaks.
2. **Globals** — `game.tor2e.macro.utility.*` for rolls (`rollSkillMacro`, `_executeSkillMacro`, `rollItemMacro`, `setPlayerStance`, …) and `actor.extendedData?.getX()` / `actor.system.*` for derived values.

This is why `module.json` pins `tor2e` system compatibility (min 4, verified 6) alongside Foundry (min 12, verified 14) and `token-action-hud-core` (≥2.0.13). System-internal APIs change between TOR2E majors.

Deliberately **no `compatibility.maximum`**: Foundry's `testAvailability()` treats a `maximum` below the running core as `REQUIRES_CORE_DOWNGRADE`, which hard-blocks the module from being enabled. With only `verified` set, a newer core marks it “unverified” and still loads. Don't reintroduce `maximum` unless a core version is known broken.

### i18n

Two namespaces in play: `tokenActionHud.tor2e.*` comes from this module's `languages/en.json`; bare `tor2e.*` keys resolve against the game system's own translations. Always localize through `coreModule.api.Utils.i18n(...)` and never hardcode English — group names and skill lookups are matched by localized string in places (e.g. `_rollProficiency`).

### Styling

`styles/token-action-hud-tor2e.css` only overrides Core's `.tah-info1/2/3` colors (amber / green / blue) and adds `.hud-info`. Action `info1`/`info2` fields are how numbers (TN, current/max) reach the HUD.
