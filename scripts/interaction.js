import {MODULE_ID} from './constants.js';
import {canView, communityFor, label, openSystemSheet, shareSystemItem} from './features.js';
import {canSeeEyeAwareness, getSetting, isAllowedForUser} from './utils.js';

const enhancedButtons = new WeakSet();
const sizedCommunityGroups = new WeakSet();

function actionContext(target, manager) {
    const element = target?.[0] ?? target;
    const button = element?.closest?.('.tah-action-button') ?? element;
    const [type, actorType, key, itemId] = (button.value ?? '').split('|');
    const actor = manager.actor;
    const community = type === 'song' ? communityFor(actor) : null;
    const item = type === 'song' ? community?.items.get(key)
        : ['weapon', 'armour', 'traits', 'miscellaneous'].includes(type) ? actor?.items.get(itemId)
        : type === 'skill' && actorType === 'npc' ? actor?.items.get(itemId) : null;
    return {type, actorType, key, itemId, actor, community, item};
}

export function registerInteractions() {
    Hooks.on('tokenActionHudCoreActionContextMenu', (items, manager) => {
        const menu = (name, predicate, run, icon = 'fa-solid fa-arrow-right') => items.push({
            label: 'tokenActionHud.tor2e.actions.' + name,
            icon: `<i class="${icon}"></i>`,
            visible: target => predicate(actionContext(target, manager)),
            onClick: async (event, target) => {
                const context = actionContext(target, manager);
                if (!predicate(context)) return;
                try {
                    await run(context, event);
                } catch (error) {
                    console.error('Token Action HUD TOR2E | Context action failed', error);
                    ui.notifications.error(label('actions.failed'));
                } finally {
                    Hooks.callAll('forceUpdateTokenActionHud');
                }
            }
        });
        menu('openItem', c => canView(c.item), c => openSystemSheet(c.item), 'fa-solid fa-book-open');
        menu('share', c => canView(c.item), c => shareSystemItem(c.item.parent, c.item), 'fa-solid fa-comment');
        for (const [command, equipped, dropped] of [['equip', true, false], ['unequip', false, false], ['drop', false, true]]) {
            menu(command, c => ['weapon', 'armour'].includes(c.type) && c.actor?.type === 'character' && c.item?.isOwner,
                c => manager.rollHandler._setItemStatus(c.item.id, 'system.equipped.value', equipped, 'system.dropped.value', dropped));
        }
        menu('toggleFavoured', c => c.type === 'skill' && c.actor?.isOwner,
            c => manager.rollHandler._toggleFavouredSkill(c.actorType, c.itemId), 'fa-solid fa-star');
        menu('toggleMagical', c => c.type === 'skill' && c.actor?.type === 'character' && c.actor.isOwner,
            c => manager.rollHandler._toggleMagicalSkill(c.itemId), 'fa-solid fa-wand-magic-sparkles');
        for (const [name, direction] of [['increaseRank', 1], ['decreaseRank', -1]]) {
            menu(name, c => c.actor?.isOwner && (c.type === 'skill' || (c.type === 'proficiency' && c.key !== 'brawling')),
                c => manager.rollHandler._changeSkillRank(c.actorType, c.type === 'skill' ? c.itemId : c.key, direction, c.type),
                direction > 0 ? 'fa-solid fa-plus' : 'fa-solid fa-minus');
        }
        menu('toggleUsed', c => c.type === 'song' && c.community?.isOwner,
            c => manager.rollHandler._toggleSongUsed(c.key), 'fa-solid fa-check');
        menu('toggleAbility', c => c.item?.type === 'fell-ability' && c.item.isOwner,
            c => c.item.update({'system.active.value': !c.item.system.active?.value}), 'fa-solid fa-bolt');
        menu('abilityResource', c => c.item?.type === 'fell-ability' && c.actor?.isOwner,
            c => openSystemSheet(c.actor, null, 'system.hate.value'));
        for (const [name, active] of [['apply', true], ['remove', false]]) {
            menu(name, c => c.type === 'health' && c.actor?.isOwner && isAllowedForUser('displayPlayerHealthEvents'),
                c => active ? c.actor.addStatusEffectById(c.key) : c.actor.deleteStatusEffectById(c.key));
            menu(name, c => c.type === 'effect' && c.actor?.isOwner && isAllowedForUser('displayPlayerEffects'),
                c => c.actor.toggleStatusEffect(c.key, {active, overlay: getSetting('addOverlayOnEffects')}));
        }
        menu('openItem', c => c.type === 'hud' && ['sheet', 'task', 'roleRoll'].includes(c.actorType),
            async c => openSystemSheet(await fromUuid(c.key)), 'fa-solid fa-book-open');
        menu('share', c => c.type === 'hud' && c.actorType === 'task',
            async c => shareSystemItem(c.actor, await fromUuid(c.key)), 'fa-solid fa-comment');
        menu('toggleEffect', c => c.type === 'hud' && c.actorType === 'sheet' && c.actor?.isOwner
            && Boolean(c.actor.effects?.find(effect => effect.uuid === c.key)) && isAllowedForUser('displayPlayerEffects'),
            c => {
                const effect = c.actor.effects.find(effect => effect.uuid === c.key);
                return effect.update({disabled: !effect.disabled});
            }, 'fa-solid fa-toggle-on');
    });

    // Ignore Core's layout-only actor flag updates to avoid rebuilding in response to
    // saving the HUD itself. Document changes still refresh community-derived actions.
    Hooks.on('updateActor', (actor, changes) => {
        if (['system', 'ownership', 'name', 'img', 'type'].some(key => Object.hasOwn(changes, key))) {
            Hooks.callAll('forceUpdateTokenActionHud');
        }
    });
    for (const hook of ['updateItem', 'createItem', 'deleteItem', 'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'updateCombatant', 'updateCombat']) {
        Hooks.on(hook, () => Hooks.callAll('forceUpdateTokenActionHud'));
    }
    Hooks.on('updateSetting', setting => {
        if (setting.key?.startsWith('tor2e.') || setting.key?.startsWith(`${MODULE_ID}.`)) {
            Hooks.callAll('forceUpdateTokenActionHud');
        }
    });
    Hooks.on('renderTokenActionHud', app => {
        const root = app.element instanceof HTMLElement ? app.element : app.element?.[0];
        root?.classList.add('tor2e-hud');
        // Core can retain previous theme classes when switching styles. Use its
        // current setting so our default palette never overrides an explicit theme.
        if (root) {
            const style = app.setting?.style ?? game.settings.get('token-action-hud-core', 'style');
            root.dataset.tor2ePalette = ['foundryVTT', 'compact', 'dockedLeft', 'dockedRight', 'dockedCenterRight'].includes(style)
                ? 'earth' : 'core';
        }
        const communityButton = root?.querySelector('.tah-group-button[value="community"]');
        const communityGroup = communityButton?.closest('.tah-tab-group');
        if (communityGroup && !sizedCommunityGroups.has(communityGroup)) {
            sizedCommunityGroups.add(communityGroup);
            const sizeCommunity = () => {
                communityGroup.classList.toggle('tor2e-community-wide', !app.isDocked);
                if (app.isDocked) return;
                const rect = communityButton.getBoundingClientRect();
                const scale = rect.width / communityButton.offsetWidth || 1;
                const available = (document.documentElement.clientWidth - rect.left - 16) / scale;
                communityGroup.style.setProperty('--tor2e-community-width', `${Math.max(0, available)}px`);
            };
            sizeCommunity();
            communityGroup.addEventListener('pointerenter', sizeCommunity, {capture: true});
            communityGroup.addEventListener('focusin', sizeCommunity);
        }
        for (const button of root?.querySelectorAll('.tor2e-action.toggle') ?? []) {
            button.setAttribute('aria-pressed', String(button.classList.contains('active')));
        }
        for (const button of root?.querySelectorAll('.tor2e-action[data-has-context-menu="true"]') ?? []) {
            if (enhancedButtons.has(button)) continue;
            enhancedButtons.add(button);
            button.setAttribute('aria-haspopup', 'menu');
            const openMenu = event => {
                if (app.isUnlocked) return;
                event.preventDefault();
                event.stopPropagation();
                const rect = button.getBoundingClientRect();
                button.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2,
                    clientX: rect.right - 12, clientY: rect.top + rect.height / 2}));
            };
            // Keep one keyboard stop per action; the standard menu key opens its
            // secondary commands without embedding a second button inside it.
            button.addEventListener('keydown', event => {
                if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) openMenu(event);
            });
        }
        const header = root?.querySelector('[data-part="characterName"]');
        const actor = app.hudManager?.actor;
        if (!header) return;
        header.querySelector('.tor2e-resource-summary')?.remove();
        if (!canView(actor)) return;
        const summary = document.createElement('span');
        summary.className = 'tor2e-resource-summary';
        const addResource = (name, value, max, field) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'tor2e-summary-resource';
            const caption = document.createElement('span');
            caption.className = 'tor2e-summary-label';
            caption.textContent = name;
            const amount = document.createElement('span');
            amount.className = 'tor2e-summary-value';
            amount.textContent = `${value ?? 0}${max === undefined ? '' : '/' + max}`;
            button.append(caption, document.createTextNode(' '), amount);
            button.title = label('actions.resourceHint');
            button.addEventListener('click', event => {
                event.stopPropagation();
                openSystemSheet(actor, actor.type === 'character' ? 'combat' : undefined, field)
                    .catch(error => {console.error(error); ui.notifications.error(label('actions.failed'));});
            });
            summary.append(button);
        };
        const endurance = actor.type === 'character' ? actor.system.resources?.endurance : actor.system.endurance;
        if (endurance) addResource(game.i18n.localize(endurance.label ?? 'tor2e.actors.stats.endurance'),
            actor.extendedData?.getEndurance?.() ?? endurance.value, endurance.max,
            actor.type === 'character' ? 'system.resources.endurance.value' : 'system.endurance.value');
        if (actor.type === 'character') {
            const hope = actor.system.resources?.hope;
            if (hope) addResource(game.i18n.localize(hope.label ?? 'tor2e.actors.stats.hope'), actor.extendedData?.getHopePoint?.() ?? hope.value,
                hope.max, 'system.resources.hope.value');
            const conditions = isAllowedForUser('displayPlayerHealthEvents') ? ['weary', 'miserable', 'wounded', 'poisoned'] : [];
            for (const status of conditions) {
                if (!actor.hasStatusEffectById?.(status)) continue;
                const badge = document.createElement('span');
                badge.className = 'tor2e-summary-condition';
                const definition = CONFIG.statusEffects.find(effect => effect.id === status);
                badge.textContent = game.i18n.localize(definition?.label ?? `tor2e.actors.stateOfHealth.${status}`);
                summary.append(badge);
            }
        } else if (actor.type === 'adversary') {
            const mental = actor.system.hate;
            addResource(game.i18n.localize(actor.system.isHateMode?.value === false ? 'tor2e.actors.stats.resolve' : 'tor2e.actors.stats.hate'),
                mental?.value, mental?.max, 'system.hate.value');
        } else if (actor.type === 'community') {
            const fellowship = actor.system.fellowshipPoints;
            if (fellowship) addResource(game.i18n.localize(fellowship.label ?? 'tor2e.actors.stats.fellowshipPoints'), fellowship.value,
                fellowship.max, 'system.fellowshipPoints.value');
            if (canSeeEyeAwareness()) {
                const eye = actor.system.eyeAwareness;
                if (eye) addResource(game.i18n.localize(eye.label ?? 'tor2e.actors.stats.eyeAwareness'), eye.value, eye.max, 'system.eyeAwareness.value');
            }
        }
        if (summary.children.length) header.append(summary);
    });
}
