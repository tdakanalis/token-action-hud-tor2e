# HUD Utility Expansion

**Status:** Living document. Updated at the end of every task.
**Started:** 2026-11-21
**Owner:** tdakanalis
**Planning doc:** Research and scope approved in the project conversation.
**Companion docs:** An as-built architecture document will accompany the completed implementation.

## 1. Phase / Task tracker

| Phase | Task | Title | Size | Status | Notes |
|------:|-----:|-------|:----:|--------|-------|
| 1 | 1.1 | Establish an isolated local Foundry test instance | M | 🟢 done | Foundry 14.367 on loopback port 30001, synthetic world, separate data. Final matrix uses TOR2E 6.3.0; an earlier partial 6.1.0 diagnostic is archived. |
| 1 | 1.2 | Audit every existing HUD group and interaction | M | 🟢 done | Group-by-group audit and delegation boundaries recorded in HudArchitecture.md. |
| 1 | 1.3 | Fix existing actor selection and system delegation defects | M | 🟢 done | Native dialog tests cover all actor types, proficiency, skills, Protection, Valour and isolated rest context. |
| 1 | 1.4 | Fix equipment, effects and multi-token defects | M | 🟢 done | Equipment, shield display, Shadow Taint, linked actors, macro permissions, zero values, delimiter-safe armour ids and modifier handling repaired and covered. |
| 1 | 1.5 | Guard the native Hope recovery permission failure | M | 🟢 done | User cancelled the upstream system fix. HUD recovery and both rest paths check Character and active Community ownership before opening native recovery. Unit regressions and four real player checks pass on Foundry 14.367 / TOR2E 6.3.0; receipt: testing/results/foundry14-tor2e63-player.json. No system changes or tracking issue will be made. |
| 2 | 2.1 | Establish compact visual hierarchy and accessible action states | M | 🟢 done | Revised per user feedback: no added enclosing panel fill or shadow, no filled stat badges, flatter controls and restrained state accents. Appearance approval remains task 5.3. |
| 2 | 2.2 | Add discoverable secondary-action menus | M | 🟢 done | Right-click and Shift+F10 open native menus. The user requested removal of all dots. Real mouse test verifies right-click does not roll and source HUD remains visible/opaque. |
| 2 | 2.3 | Make resources actionable and expose system condition warnings | M | 🟢 done | Native input focus checks pass for attributes, resources and advancement. Condition warnings use actor methods. Recovery/rest permission safeguard remains HUD-only. |
| 2 | 2.4 | Add explicit apply and remove controls for mixed conditions | M | 🟢 done | Native mixed-group apply/remove, eligible types, ownership and linked actor deduplication tested; Player owned-condition change passes. |
| 2 | 2.5 | Expose trait sharing and applicable active effects | M | 🟢 done | Native chat cards and effect enable/disable pass; details and editing commands respect the player visibility setting. |
| 2 | 2.6 | Add discoverable skill rank increase and decrease controls | M | 🟢 done | Native common skill, proficiency and NPC Item rank changes pass. Diamonds receive pointer events; named menu commands remain available. |
| 3 | 3.1 | Add combat-task actions filtered by stance | M | 🟢 done | Accessible task Items, native card and native associated skill roll implemented and tested. Consequence interpretation remains manual. |
| 3 | 3.2 | Expose engagements and target shortcuts | M | 🟢 done | Native engagement, stance, attack and visible foe target/clear checks pass in a temporary encounter. |
| 3 | 3.3 | Expose fell-ability state and system resource controls | M | 🟢 done | Cost and state shown; actual active flag toggle/restore passes. Hate/Resolve opens the native resource control. |
| 4 | 4.1 | Add journey-role rolls | S | 🟢 done | Native role dialog passes; player sees own role action and solo-mode gating is unit-tested. |
| 4 | 4.2 | Build a useful Community-token HUD and company overview | M | 🟢 done | Company, member, role and song controls implemented; native song toggle and Player Eye privacy/Observer edit restrictions tested. |
| 4 | 4.3 | Expose journey logs, mounts and system event rolls | M | 🟢 done | Native sheets and event dialog pass. Recording remains in the native log sheet. |
| 4 | 4.4 | Add optional Game Control launchers | M | 🟢 done | Installed 2.1.1 council, manoeuvre, synthesis and XP dialogs plus all three native chat reports tested. GM permission and capability gates covered. |
| 4 | 4.5 | Expose undertakings, standings and permitted contacts | M | 🟢 done | Populated native document navigation passes; contact visibility uses document permission checks. |
| 5 | 5.1 | Complete player and Loremaster regression testing in Foundry | M | 🟢 done | Final no-dots design: 47 GM, 8 Player and 1 real right-click checks pass on Foundry 14.367 / TOR2E 6.3.0 / Core 2.1.1; 52 unit tests pass. Older matrix remains unverified. |
| 5 | 5.2 | Prepare the final branch as a reviewable pull request | S | 🟡 working | Preparing a draft with test evidence and compatibility limits. No merge or release. |
| 5 | 5.3 | Obtain approval for completed functionality and appearance | S | ⚪ not started | Required before the user-guide update. |
| 5 | 5.4 | Update the user guide after approval | M | ⚪ not started | Update the source and PDF to match approved behavior before release. |
| 5 | 5.5 | Record the as-built architecture and final release checks | S | 🟡 working | HudArchitecture.md and testing/README.md record boundaries and reproduction. Final release checks follow approval and guide update. |

**Legend:** ⚪ not started · 🟡 working · 🟢 done · 🔴 blocked / needs decision
**Size:** XS · S · M · L · XL.

## 2. Goal

Audit and repair the existing HUD, implement the twelve researched additions, and substantially improve appearance and usability for players and the Loremaster. The result must be a compact, polished HUD with clearly named actions and contextual menus, tested in local Foundry and submitted from `feat/hud-utility-expansion` as a pull request. The user has authorized the full implementation; final functionality and visual approval precede the user-guide update and any release.

## 3. Architecture / approach

Keep the existing HUD Core system-module architecture. HUD code builds contextual actions and delegates game behavior to TOR2E or an installed integration. If the system offers an operation through a sheet, dialog, document method or macro, trigger that operation; do not copy its rules or simulate its DOM handlers when an operation is available. Separate display-only information from actions with a clear outcome.

Use synthetic characters, NPCs, adversaries, communities, items, tokens and encounters in a separate Foundry data directory. Use the cached licensed Foundry application without exposing license contents. No tests operate on campaign worlds. Unit tests verify dispatch, document identity and permission boundaries; browser checks verify actual rendered actions and system interactions.

Keep custom styles scoped to this module's HUD actions. Preserve Core scaling, expansion direction, customization and theme choices. Use explicit labels, visible current state, keyboard focus and adequate contrast. Context menus supplement discoverability rather than making shortcuts the only route to an operation.

Audit and repair existing features before building additions. Validate each coherent change before expanding its scope. No system migrations or upstream system changes are part of this branch.

## 4. Future work / out-of-scope

| Item | Status | Why |
|------|--------|-----|
| Reimplementing TOR2E rules, rolls, recovery or combat resolution | Out of scope | User explicitly requires triggering existing system functionality. |
| Replacing Game Control's council or endeavour engine | Out of scope | Integrate with the installed module instead. |
| Automatically interpreting ability descriptions as executable rules | Out of scope | Item prose is not an execution contract. |
| Updating the user guide before approval | Out of scope | User explicitly placed this after approval and before release. |
| Merging, publishing or releasing without final approval | Out of scope | Development ends in a reviewable pull request. |

## 5. Decision log

### 2026-11-21 — Sleeker styling and real pointer interaction

**Decision:** Remove the added enclosing menu background and shadows and filled metadata badges. Keep Core's theme on individual controls, lighter dividers and compact spacing. Following the user's final direction, remove the dots everywhere and open context menus by right-click or the standard keyboard shortcut.

**Why:** The user rejected the heavier backgrounds and reported that the promised click on the dots did not work. Core's inner button content has pointer events disabled; programmatic click tests had missed that hit-target behavior.

**Validation:** Skill diamonds explicitly receive pointer events. The regression uses an actual Orca right mouse move/down/up sequence, checks that the menu opens without rolling, asserts there are no dots, and verifies that the source HUD stays visible after moving into the menu.

### 2026-11-21 — HUD safeguard for native Hope recovery (supersedes upstream repair)

**Decision:** The user withdrew the separate system fix and requested HUD-only protection. Block direct recovery and both native rest entry points when the Character or active Community is not owned; explain that the Loremaster must perform the action.

**Why:** A real Player session reproduced Hope rising from 8 to 9 while Fellowship Points remained 3 when the Community update failed on ownership. The HUD must not implement independent recovery rules to compensate.

**Tradeoff:** Both native rest operations open the same recovery dialog, so the HUD blocks the entire rest action for insufficient Community permissions. Authorized actions still delegate unchanged to TOR2E. Native sheet recovery remains affected. No permission grants, system patch, copied rest rules, or upstream tracking issue are included.

### 2026-11-21 — Preserve context while a secondary menu is open

**Decision:** Keep the originating HUD group visible and fully opaque while Foundry's context target is active.

**Why:** User testing showed that the fixed menu lives outside the HUD, so pointer leave removes Core's hover state and fades the source action.

**Alternatives considered:** Inline secondary controls remain an option if the repaired native menu still feels awkward in review.

### 2026-11-21 — Compact visual direction

**Decision:** Use a compact, polished HUD with clearly named actions and contextual menus.

**Why:** User selected this direction and explicitly included a substantial appearance and usability improvement in the release.

**Alternatives considered:** A larger dashboard; retaining the current visual style with only label improvements.

### 2026-11-21 — Audit first and delegate system operations

**Decision:** Audit all existing functionality first, fix defects, then implement the approved additions by triggering system or integration operations wherever available.

**Why:** User's explicit release requirements. Existing research exposed no-op actions, identity risks and incomplete displays.

**Alternatives considered:** Feature-first implementation would leave existing defects in the expanded HUD; independent rules implementations would violate the user's requirement.

### 2026-11-21 — Isolated branch and local validation

**Decision:** Work on `feat/hud-utility-expansion`, test in isolated local Foundry, and finish with a pull request.

**Why:** User requires a separate branch, local Foundry testing and approval before documentation and release.

**Alternatives considered:** The existing development compose file mounts the full personal Foundry data directory; use a separate test data directory to preserve campaign data.

## 6. Open questions

- The existing manifest range is retained with capability gates. Full older-version validation remains a release limitation; no support range is widened or presented as newly verified.
- Native sheet recovery remains affected by the system bug. The user explicitly excluded a system fix; the tested HUD safeguard does not change the native sheet.

## 7. Lessons learned

The existing compose setup is not an isolated test fixture: it mounts the user's entire Foundry data directory. Foundry 14 needs Node 24; the isolated instance uses the cached licensed distribution inside the available Node 24 container. Native engagement dispatch starts asynchronous document updates without awaiting them, so tests observe the update event rather than treating method return as persistence confirmation. Core can discard numeric zero metadata, so display metadata is normalized to strings before action creation. Foundry 14 has no User.updateTokenTargets method; target clearing delegates to each Token's setTarget method.
