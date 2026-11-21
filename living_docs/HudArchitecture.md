# HUD architecture and audit

This describes the release, including the current online user guide.

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
| Macros and optional Game Control | Show executable Macros only. Offer the optional Game Control manoeuvres launcher only when it resolves the selected character. | Native Macro and manoeuvres execution. |
| Menus, header and refresh | Native context menus work by right-click or Shift+F10, with no dots in the final design. Opt skill diamonds into pointer events. Keep the originating group visible and opaque during a menu. Refresh for system/document changes without reacting to Core's own layout flags. | Actual mouse right-click, no-dots assertion, menu pointer-leave regression, native rank changes and rendered header. |

## Player visibility and permissions

| HUD area | Player access |
| --- | --- |
| Character actions | Players can roll on actors they own. The HUD skill-edit setting controls rank changes and Favoured and Magical toggles. Foundry document visibility governs sheet links and summaries. |
| Company | Players need Observer access or ownership and the selected hero must belong to the company. Members and contacts require permission to view the linked actor. Players see exact Endurance and Hope for owned characters, with optional sharing for other visible members. |
| Health statuses | The HUD world setting controls menu actions, context commands, condition warnings and header badges. Status changes require actor ownership. |
| Effects | The HUD world setting controls token effects and active-effect actions. Effect changes require ownership. The overlay setting changes token presentation. |
| Bulk conditions | Bulk health and token effect actions are Loremaster only. |
| Eye Awareness | Players need a visible company, the HUD setting enabled and TOR2E’s Loremaster-only setting disabled when available. |
| Combat and journey administration | Combat membership, engagement management and journey-event rolling are Loremaster controls. |
| Hope recovery and songs | Direct recovery requires ownership of the hero and company. If company ownership blocks native rest, the button tells the player to ask the Loremaster. Song use toggles require company ownership. Player performances use the assigned, owned company member. |
| Macros | Foundry’s macro execution permission determines visibility and execution. |

## Appearance

The user requested a compact HUD and subsequently rejected added menu backgrounds. Panels have no added enclosing fill or shadow; stat badges have no fill. Default dark/docked controls use charcoal, neutral light text and a unified gold accent in place of beige metadata and bronze accents. Active actions use a subtle gold-tinted dark fill, one thin gold outline and a gold checkmark, with no extra bottom border or inset shadow. This treatment remains visible on hover. Explicit light/high-contrast/custom choices keep their Core palette. A render-time palette attribute follows Core's current style setting, since Core can retain old theme classes while switching.

The final direction is independent of the character sheet. The user cancelled the proposed global vertical-footprint reduction; row padding and icon slot sizes retain their prior dimensions. A later focused request tightens section-heading margins and removes duplicate padding between headings and their actions. Existing category hover behavior is unchanged; the attempted click-to-open change was reverted. Travel assignments wrap in narrow panels instead of clipping character names.

Group images are actual image elements and use fixed slots with `object-fit: contain`; action background images use contained sizing. This preserves the Stats portrait's 300×450 proportions instead of stretching it into a square. Active toggles have a checkmark and `aria-pressed`, disabled labels keep readable opacity, map-area headings have a dark text shadow, and focus indicators have a contrasting surround. The appearance receipt records rendered color samples and Python-calculated contrast checks for text, active marks, menus and focus. See testing/README.md for scope and reproduction.

The final polish pass separates medium-weight action labels from regular-weight gold metadata, aligns labels consistently after their icons, and gives header resource values their own gold spans. Category and section headings remain white and retain the requested tighter heading spacing. Company member names occupy a full line above their resource values to avoid narrow-column clipping. Existing icon sizes, row padding, Core layout preferences and hover behavior are preserved.

Floating Community opens rightward from Core’s anchor with a maximum width of 360 pixels. Its actions wrap to one column when space is limited. It uses the standard thin neutral scrollbar.

## Known boundaries

- Final browser evidence targets Foundry 14.367 / TOR2E 6.3.0 / Core 2.1.1 and optional Game Control 2.1.1. Complete older-version compatibility is unverified; the manifest's existing support range has not been widened.
- Core 2.0 does not expose the newer context menu hook. Existing modifier controls remain available; new menu enhancements are capability-gated.
- The upstream Hope bug remains on the native sheet. HUD users without Community ownership must ask the Loremaster to rest/recover through the HUD; changing that system behavior was explicitly excluded.
- Active flags, document fields and display summaries do not constitute automation of descriptive abilities, combat task consequences or journey-log recording.
- The online user guide covers this release. The original illustrated PDF is preserved as the version 1.6 manual.

See [developer validation](../testing/README.md) and `testing/results` for commands and individual results. No licensed Foundry files or campaign data are included.
