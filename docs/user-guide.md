# Token Action HUD for TOR2E

User guide for players and Loremasters

Token Action HUD brings frequently used actions for The One Ring 2nd Edition into a movable toolbar on the Foundry canvas. The available menus depend on the selected token, your Foundry permissions, and the world settings.

## Install and set up

1. In Foundry Setup, install **The One Ring 2nd Edition** from Game Systems.
2. Install **socketlib**, **Token Action HUD Core**, and **Token Action HUD for TOR2E** from Add-on Modules. To install this module by manifest, use the [latest release manifest](https://github.com/tdakanalis/token-action-hud-tor2e/releases/latest/download/module.json).
3. Launch your TOR2E world. The Loremaster enables the modules in **Game Settings → Manage Modules** and reloads the world.
4. Select a token you own. Use Core's HUD settings to adjust the layout, scale, style, and opening direction. Unlock the HUD to move it or customize its groups, then lock it for play.

This release was tested in Foundry 14.367 with TOR2E 6.3.0 and HUD Core 2.1.1. The manifest retains the previous minimum versions. The full browser suite has not been run on older combinations. The HUD context menu requires Core 2.1, and the native journey-event shortcut requires TOR2E 6.

## At the table

| Menu | What you can do |
| --- | --- |
| **Stats** | Check attributes, resources, Valour, Wisdom, and advancement. Click a resource to find its field on the native sheet. The HUD header also shows key resource totals and permitted conditions. |
| **Skills** | Roll common skills on a hero or the skill items on an NPC. Right-click a skill for editing commands when you have permission. |
| **Combat** | Roll attacks, Protection, and combat proficiencies. Manage equipment, choose a stance during combat, and select a visible engaged foe. Combat tasks show those that fit the active stance and use the appropriate TOR2E skill roll when one is associated. |
| **Traits** | Read or share traits, rewards, virtues, and applicable abilities. Adversaries can show a fell ability's cost and active state. |
| **Miscellaneous** | Open equipment, rest, manage permitted health and token effects, and view active effects. Loremasters get group condition controls with multiple eligible actors selected. |
| **Community** | Check travel roles, Fellowship Points, songs, company members, journey logs, mounts, and available Fellowship-phase entries. |
| **Macros** | Run macros you are allowed to execute. They appear in their Foundry folders. |

Use **left-click** for the main action, **Shift-click** for a quick roll where offered, and **right-click** or **Shift+F10** on a focused button for secondary commands. The context menu stays open alongside its source group. On Core 2.0, context commands are unavailable and supported modifier shortcuts still work.

| Where | Shortcut |
| --- | --- |
| Weapon or armour | **Ctrl-click** equips, **Alt-click** unequips, and **Shift-click** drops it. |
| Skill or proficiency rank diamonds | **Alt-click** increases the rank. **Alt+Shift-click** decreases it. You can also choose the named commands from the context menu. |
| Skill | **Alt-click** toggles Favoured. **Ctrl-click** toggles Magical for heroes. |
| Song | **Alt-click** toggles Used when you own the company. |

## Combat and group actions

During combat, select your hero to see their stance and available combat tasks. Selecting a foe from **Engagements** targets it, and **Clear targets** clears your current targets. Loremasters can manage combat membership and engagements. Select several eligible tokens for bulk health and token effect controls. The explicit **Apply** and **Remove** commands let you set a condition across a mixed selection. Combat tasks share the system's item card and open the associated roll. Apply the task's consequences at the table.

## Company, travel, and rest

- **Travel** shows the four roles and their assignments. Click your assigned role to roll its skill. Other role buttons open the company sheet. Group roles are hidden in solo mode.
- **Fellowship Points** shows current and maximum points. Click it to open the company sheet. **Recover Hope from Fellowship** opens TOR2E's recovery dialog when you own the hero and company.
- **Short** and **Prolonged** use TOR2E's rest actions. If the native flow requires company ownership you lack, the button says **Ask the Loremaster**. Ask the Loremaster to run the rest or recovery for you.
- **Songs** lists each song with its type on the button. Players perform with their assigned company character. Loremasters can choose the performer.
- **Company** links to visible member sheets. By default, players see exact Endurance and Hope for owned characters. Loremasters can share those totals for other visible members.
- **Journeys & Mounts** opens the associated sheets. Loremasters can open the native journey-event roll on TOR2E 6. Record the outcome in the journey log.
- **Fellowship Phase** links to your available undertakings and standings and to visible company contacts.

## World settings and permissions

Loremasters can find these options under **Game Settings → Configure Settings → Token Action HUD TOR2e**.

| Setting | Default and effect |
| --- | --- |
| **Allow players to apply health statuses** | On. Shows player health controls, warning indicators, and header badges. Changes require ownership of the actor. |
| **Allow players to apply effects** | On. Shows player token effects and visible active effects. Changes require ownership. |
| **Allow players to see Eye Awareness** | Off. Players need company access, this option enabled, and TOR2E's **Loremaster-only Eye Awareness** option disabled when available. |
| **Enable token overlay for effect statuses** | On. Uses a token overlay when applying an effect from the HUD. |
| **Share company resource totals** | Off. When enabled, players can see Endurance and Hope for other members whose sheets they can view. |
| **Allow player skill edits from the HUD** | On. Controls rank edits and Favoured and Magical toggles for owned actors. Skill and proficiency rolls remain available when edits are off. |

Bulk condition changes, combat administration, and journey-event rolls are Loremaster controls. The HUD respects Foundry ownership and Observer access for sheets and company members. HUD settings govern this toolbar; the TOR2E sheets and Foundry document permissions have their own controls.

## Troubleshooting

- **No HUD:** Check that the required modules are active, the world uses TOR2E, and you have selected an owned token. Check the Core HUD settings.
- **Missing action:** Check the actor type, combat stance, ownership, and the relevant world setting. Some actions appear only when there is a matching item or document.
- **Missing company or travel actions:** Check the current company, the selected hero's membership, and solo mode.
- **Rest or recovery is unavailable:** Ask the Loremaster to run it. Observer access to the company lets you see its details; spending its Fellowship Points requires ownership.
- **Something still fails:** Include your Foundry, TOR2E, HUD Core, and HUD module versions, actor type, action, and any console error in a [GitHub issue](https://github.com/tdakanalis/token-action-hud-tor2e/issues).
