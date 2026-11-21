# HUD architecture and audit

This describes the implemented branch. User approval, the player guide/PDF update and release remain separate steps.

## Ownership of behavior

`action-handler.js` builds Core actions and preserves zero-valued metadata. `features.js` adds permission-aware navigation, combat tasks, company actions and optional integrations. `roll-handler.js` dispatches actions to TOR2E. `interaction.js` registers Core's context commands, resource summaries and refresh hooks. Styles are scoped to this HUD and keep the selected Core theme, scale and layout.

| Area audited | Dispatch and repairs | Validation |
|---|---|---|
| Attributes, resources and advancement | Open the native sheet, reveal the containing tab and focus its existing input. Show Shadow including Taint and native Load/Endurance/Hope values. | All five actor builds; native focus checks; zero-value and Taint regressions. |
| Skills, stature and proficiencies | Pass the explicit HUD actor to native macro methods. Preserve same-name NPC skills through Item ids. Use native processors for favoured, magical and rank controls; retain derived Brawling as read-only. Shift bypasses roll customization. | Native character/NPC skill, Valour, proficiency dialogs; rank and flag changes; modifier unit checks. |
| Weapons, armour, Protection and Parry | Use actor attacks, native Protection rolls and native sheet controls. Item ids survive names containing a delimiter. Inactive weapons open their sheet. Shield displays use the system's equipped-shield lookup. | Missing-proficiency regressions; native attack/Protection dialogs; equipment and effect state checks. |
| Equipment changes | Explicit equip, unequip and drop commands persist both flags together, then call the system's Item Active Effect operation with actual equipped state. | Unit dispatch and actual equip/drop checks. |
| Traits, occupation, miscellaneous and fell abilities | Use native chat cards or sheets. Fell abilities display cost and active state; the secondary command edits the native active flag. Hate/Resolve opens its native control. No ability prose is executed. | Native trait/task cards and actual fell-ability flag changes; five actor builds. |
| Rest and Hope | Call native rest/recovery only after checking ownership of the affected Character and active Community. Recheck when clicked, including stale recovery actions. No independent recovery arithmetic. | Unit permission changes; actual GM recovery/rest dialogs; real Player refusal with unchanged resources. |
| Health, generic effects and Active Effects | Use native status methods and effect document operations. Mixed selection deduplicates linked actors and skips unowned/ineligible actors. Explicit apply/remove accompanies existing toggles. Respect player settings for details and commands. | Native group apply/remove, effect enable/disable and Player condition tests; setting and mixed-type unit cases. |
| Combat membership, stances and targeting | Add missing combatants in mixed selections instead of removing existing ones. Resolve the token's actual Combatant and use native stance and engagement operations. Target only visible foes. | Native temporary encounter, engagement, stance, attack and target clearing; permission/unit checks. |
| Combat tasks | Accessible owned/world Items are filtered by current native stance. Announce the task's native card, then call its associated skill. No consequence automation. | Native task card and roll; dispatch and access checks. |
| Community, travel and songs | Use selected Community or the character's active membership. Expose member summaries and own assigned-role rolls. Avoid duplicate character role launchers; hide group roles in solo mode. Song use and performance remain native. | Community builds/sheet, role dialog, native song used toggle, membership/solo tests and Player restrictions. |
| Journey, Fellowship phase and contacts | Open native journey logs, mounts, undertakings, standings and permitted actor sheets. Use the system's journey-event dialog when available. Recording remains native. | Populated document navigation; native journey-event dialog; visibility checks. |
| Macros and optional Game Control | Show executable Macros only. Capability-gate integration calls and reserve LM methods for the GM. Hide manoeuvre launchers when Game Control would resolve a different assigned Character. | Actual Macro execution; native integration dialogs/reports; permission and capability unit checks. |
| Menus, header and refresh | Native context menus work by right-click or Shift+F10, with no dots in the final design. Opt skill diamonds into pointer events. Keep the originating group visible and opaque during a menu. Refresh for system/document changes without reacting to Core's own layout flags. | Actual mouse right-click, no-dots assertion, menu pointer-leave regression, native rank changes and rendered header. |

## Appearance

The user requested a compact HUD and subsequently rejected added menu backgrounds. Panels have no added enclosing fill or shadow; stat badges have no fill. Controls use the current Core theme with lighter borders, restrained state accents, smaller icons, keyboard focus and reduced-motion support. The original Core theme remains responsible for its own backgrounds, including deliberately chosen light/high-contrast styles.

## Known boundaries

- Final browser evidence targets Foundry 14.367 / TOR2E 6.3.0 / Core 2.1.1 and optional Game Control 2.1.1. Complete older-version compatibility is unverified; the manifest's existing support range has not been widened.
- Core 2.0 does not expose the newer context menu hook. Existing modifier controls remain available; new menu enhancements are capability-gated.
- The upstream Hope bug remains on the native sheet. HUD users without Community ownership must ask the Loremaster to rest/recover through the HUD; changing that system behavior was explicitly excluded.
- Active flags, document fields and display summaries do not constitute automation of descriptive abilities, combat task consequences or journey-log recording.
- The user guide is unchanged pending approval. This branch must not be merged to `main` before that step: the existing main-branch workflow publishes releases automatically.

See [developer validation](../testing/README.md) and `testing/results` for commands and individual results. No licensed Foundry files or campaign data are included.
