import {canSeeEyeAwareness, getActiveStatusIds, getCurrentCommunity, isAllowedForUser} from './utils.js';

const PREFIX = 'tokenActionHud.tor2e.';
export const label = key => game.i18n.localize(PREFIX + key);
const roleSkills = {guide: 'travel', scouts: 'explore', lookouts: 'awareness', hunters: 'hunting'};

export function canView(document) {
    return Boolean(document && (document.isOwner || document.testUserPermission?.(game.user, 'OBSERVER')));
}

export function communityFor(actor) {
    if (actor?.type === 'community') return canView(actor) ? actor : null;
    const community = getCurrentCommunity();
    return canView(community) && (!actor || community.system.members.some(member => member.id === actor.id))
        ? community : null;
}

// Native rest also opens Hope recovery. Check both documents before entering
// that flow; the system currently updates Hope before spending Fellowship.
export function canRecoverHope(actor, community) {
    return Boolean(actor?.isOwner && (!community || community.isOwner));
}

export function checkHopeRecoveryPermission(actor, community) {
    if (canRecoverHope(actor, community)) return true;
    ui.notifications.warn(label('actions.hopeRecoveryPermission'));
    return false;
}

export async function openSystemSheet(document, tab, field) {
    if (!canView(document)) return;
    if (document.documentName === 'ActiveEffect'
        && (!isAllowedForUser('displayPlayerEffects') || (!document.isOwner && !document.visible))) return;
    if (field === 'system.eyeAwareness.value' && !canSeeEyeAwareness()) return;
    const sheet = document.sheet;
    await sheet.render(true);
    if (tab) {
        if (sheet.tabGroups?.primary !== undefined && sheet.changeTab) {
            if (sheet.constructor.TABS?.primary?.tabs?.some(entry => entry.id === tab)) sheet.changeTab(tab, 'primary');
        }
        else sheet.activateTab?.(tab);
    }
    const root = sheet.element instanceof HTMLElement ? sheet.element : sheet.element?.[0];
    const input = field && root?.querySelector(`[name="${CSS.escape(field)}"]`);
    const containingTab = input?.closest('[data-tab][data-group]');
    if (containingTab && sheet.changeTab) sheet.changeTab(containingTab.dataset.tab, containingTab.dataset.group);
    input?.scrollIntoView({block: 'center'});
    input?.focus();
}

// These are navigation and dispatch controls. TOR2E retains ownership of game rules.
export async function loadFeatures(handler) {
    const actor = handler.actor;
    const community = communityFor(actor);
    const groups = handler.GROUP;
    const addGroup = (id, parent) => {
        const group = {id: 'tor2e_' + id, name: label('groups.' + id)};
        handler.addGroup(group, {id: groups[parent].id}, true);
        return group;
    };
    const add = (group, id, name, command, args = [], extra = {}) => handler.addActions([{
        id: 'tor2e_' + id, name, cssClass: 'tor2e-action',
        encodedValue: ['hud', command, ...args].join(handler.delimiter), ...extra
    }], group);

    if (actor && canView(actor)) {
        add(groups.resources, 'openActor', label('actions.openActor'), 'sheet', [actor.uuid], {img: actor.img});
        if (actor.type === 'character' && isAllowedForUser('displayPlayerHealthEvents')) {
            const warnings = [
                ['weary', actor.shouldBeWeary?.()], ['miserable', actor.shouldBeMiserable?.()]
            ];
            for (const [status, warn] of warnings) if (warn && !actor.hasStatusEffectById?.(status)) {
                add(groups.resources, 'check_' + status, label('actions.check.' + status), 'sheet', [actor.uuid, 'combat'],
                    {cssClass: 'tor2e-action tor2e-warning', tooltip: label('actions.conditionWarning')});
            }
        }
        if (isAllowedForUser('displayPlayerEffects') && (actor.effects?.size || actor.effects?.length)) {
            const group = addGroup('activeEffects', 'misc');
            for (const effect of actor.effects) {
                if (!effect.visible && !actor.isOwner) continue;
                add(group, effect.id, effect.name, 'sheet', [effect.uuid], {
                    img: effect.img ?? effect.icon, hasContextMenu: true,
                    cssClass: `tor2e-action toggle ${effect.disabled || effect.isSuppressed ? '' : 'active'}`,
                    info1: {text: label(effect.disabled ? 'states.disabled' : effect.isSuppressed ? 'states.suppressed' : 'states.active')}
                });
            }
        }
        if (actor.type === 'character' && actor.isOwner) {
            const group = addGroup('combatTasks', 'combat');
            const combatant = handler.token?.document?.findCombat?.()?.combatant ?? handler.token?.combatant;
            const stance = combatant?.getStance?.()?.class;
            const tasks = [...actor.items, ...game.items].filter(item => item.type === 'combat-task' && canView(item));
            const seen = new Set();
            for (const task of tasks) {
                if (seen.has(task.uuid)) continue;
                seen.add(task.uuid);
                const associated = task.system.associatedStance?.value;
                if (stance && associated && associated !== 'all' && !stance.toLowerCase().includes(associated.toLowerCase())) continue;
                add(group, task.id, task.name, 'task', [task.uuid], {
                    img: task.img, tooltip: task.isOwner ? task.system.description?.value : undefined, hasContextMenu: true,
                    info1: {text: task.system.associatedSkill?.value === 'none' ? ''
                        : game.i18n.localize('tor2e.commonSkills.' + task.system.associatedSkill?.value)}
                });
            }
            if ((!game.user.character || game.user.character.id === actor.id)
                && game.modules.get('tor-2e-gamecontrol')?.active && typeof game.Tor2eGameControl?.macro_combat_manoeuvres === 'function') {
                add(group, 'manoeuvres', label('actions.combatTasks'), 'integration', ['macro_combat_manoeuvres']);
            }
        }
        const combatant = handler.token?.document?.findCombat?.()?.combatant ?? handler.token?.combatant;
        if (combatant) {
            const group = addGroup('engagements', 'combat');
            const combat = combatant.parent;
            for (const foe of combatant.getCombatData?.()?.engagedWith ?? []) {
                const opponent = combat.combatants.get(foe.tokenId)?.token;
                if (!opponent?.object?.visible) continue;
                add(group, 'target_' + opponent.id, opponent.name, 'target', [opponent.id], {img: opponent.texture?.src});
            }
            add(group, 'clearTargets', label('actions.clearTargets'), 'clearTargets');
            if (game.user.isGM && typeof combat.engagementAction === 'function') {
                add(group, 'engage', label('actions.engageSelected'), 'engage', [combat.uuid]);
            }
        }
    }

    const actors = [...new Set(handler.actors ?? (actor ? [actor] : []))]
        .filter(a => a.isOwner && ['character', 'adversary', 'npc', 'lore'].includes(a.type));
    if (actors.length > 1 && game.user.isGM) {
        const group = addGroup('groupConditions', 'misc');
        for (const status of handler._getHealthStatuses(actors)) {
            const eligible = actors.filter(a => a.type === 'character' || !['miserable', 'daunted'].includes(status));
            const active = eligible.filter(a => getActiveStatusIds(a).includes(status)).length;
            const definition = CONFIG.statusEffects.find(effect => effect.id === status);
            const name = game.i18n.localize(definition?.label ?? definition?.name ?? 'tor2e.actors.stateOfHealth.' + status);
            for (const apply of [true, false]) add(group, `${status}_${apply}`, `${label(apply ? 'actions.apply' : 'actions.remove')} ${name}`,
                'condition', [status, String(apply)], {info1: {text: `${active}/${eligible.length}`}});
        }
    }

    if (community) {
        if (actor?.type === 'character' && actor.isOwner && community.isOwner) {
            add(groups.fellowship, 'recoverHope', label('actions.recoverHope'), 'recoverHope', [actor.uuid, community.uuid], {
                img: 'systems/tor2e/assets/images/icons/fellowship.webp'
            });
        }
        const membersGroup = addGroup('members', 'community');
        for (const member of community.system.members ?? []) {
            const character = game.actors.get(member.id);
            if (!canView(character)) continue;
            const totals = character.isOwner || isAllowedForUser('shareCompanyResourceTotals') ? {
                info1: {text: `${character.extendedData?.getEndurance?.() ?? ''}/${character.system.resources?.endurance?.max ?? ''}`},
                info2: {text: `${character.extendedData?.getHopePoint?.() ?? ''}/${character.system.resources?.hope?.max ?? ''}`}
            } : {};
            add(membersGroup, member.id, character.name, 'sheet', [character.uuid], {img: character.img, ...totals});
        }
        // Characters already have the assigned-role controls in the Travel group.
        if (actor?.type === 'community' && !game.settings.get('tor2e', 'soloMode')) {
            for (const [role, skill] of Object.entries(roleSkills)) {
                const assigned = role === 'guide' ? [community.system.travel?.guide] : community.system.travel?.[role] ?? [];
                for (const member of assigned) {
                    const character = game.actors.get(member?.id);
                    if (!character?.isOwner || (actor?.type === 'character' && actor.id !== character.id && !game.user.isGM)) continue;
                    add(groups.travel, `${role}_${character.id}`, `${game.i18n.localize('tor2e.travel.roles.' + role + '.label')} · ${character.name}`,
                        'roleRoll', [character.uuid, skill], {img: character.img});
                }
            }
        }
        const journeyGroup = addGroup('journeys', 'community');
        for (const item of community.items.filter(item => ['journey-log', 'mount'].includes(item.type))) {
            add(journeyGroup, item.id, item.name, 'sheet', [item.uuid], {
                img: item.img, hasContextMenu: true,
                info1: {text: item.type === 'mount' ? String(item.system.vigour?.value ?? 0) : item.system.log?.from?.value ?? ''},
                info2: {text: item.type === 'journey-log' ? item.system.log?.to?.value ?? '' : ''}
            });
            if (item.type === 'journey-log' && game.user.isGM && Number(game.system.version.split('.')[0]) >= 6) {
                add(journeyGroup, 'event_' + item.id, label('actions.journeyEvent'), 'journeyEvent', [item.uuid],
                    {tooltip: label('actions.journeyEventHint')});
            }
        }
    }
    if (actor && canView(actor)) {
        const group = addGroup('fellowshipPhase', 'community');
        for (const item of actor.items.filter(item => ['undertaking', 'standing'].includes(item.type))) {
            add(group, item.id, item.name, 'sheet', [item.uuid], {img: item.img,
                info1: {text: item.system.location?.value ?? ''}, info2: {text: String(item.system.year?.value ?? item.system.rating?.value ?? '')}});
        }
        if (community) for (const contact of [...community.system.patrons ?? [], ...community.system.connections ?? []]) {
            const document = game.actors.get(contact.id);
            if (canView(document)) add(group, contact.id, document.name, 'sheet', [document.uuid], {img: document.img});
        }
    }
}

export async function handleFeatureAction(handler, command, args) {
    const [id, option, field] = args;
    if (command === 'sheet') return openSystemSheet(await fromUuid(id), option, field);
    if (command === 'roleRoll') {
        const actor = await fromUuid(id);
        if (!actor?.isOwner || !Object.values(roleSkills).includes(option)) return;
        return game.tor2e.macro.utility.rollSkillMacro(game.i18n.localize('tor2e.commonSkills.' + option), true, {}, actor);
    }
    if (command === 'task') {
        const item = await fromUuid(id);
        if (!canView(item) || item.type !== 'combat-task' || !handler.actor?.isOwner) return;
        const skill = item.system.associatedSkill?.value;
        await shareSystemItem(handler.actor, item);
        if (!skill || skill === 'none') return;
        return game.tor2e.macro.utility.rollSkillMacro(game.i18n.localize('tor2e.commonSkills.' + skill), !handler.isShift, {}, handler.actor);
    }
    if (command === 'journeyEvent' && game.user.isGM) {
        const item = await fromUuid(id);
        if (!canView(item) || item.type !== 'journey-log') return;
        const {rollJourneyLogEvent} = await import('/systems/tor2e/modules/applications/sheets/journey-log-sheet.mjs');
        if (typeof rollJourneyLogEvent === 'function') return rollJourneyLogEvent();
        return openSystemSheet(item);
    }
    if (command === 'recoverHope') {
        const actor = await fromUuid(id);
        const community = await fromUuid(option);
        if (!actor || !community || actor.type !== 'character' || community.type !== 'community'
            || !community.system.members.some(member => member.id === actor.id)) return;
        if (!checkHopeRecoveryPermission(actor, community)) return;
        const {Tor2eRecoverHopeDialog} = await import('/systems/tor2e/modules/rest/Tor2eRecoverHopeDialog.js');
        return Tor2eRecoverHopeDialog.create({
            actorId: actor.id, actorHopePoints: actor.system.resources.hope,
            communityId: community.id, fellowshipPoints: community.system.fellowshipPoints
        });
    }
    if (command === 'target') {
        const target = globalThis.canvas?.tokens?.get(id);
        if (target?.visible) return target.setTarget(true, {releaseOthers: true});
    }
    if (command === 'clearTargets') {
        for (const target of Array.from(game.user.targets)) await target.setTarget(false, {releaseOthers: false});
        return;
    }
    if (command === 'engage' && game.user.isGM) {
        const combat = await fromUuid(id);
        if (combat?.scene?.id === globalThis.canvas?.scene?.id) return combat.engagementAction?.(combat);
    }
    if (command === 'condition' && game.user.isGM) {
        const allowed = handler._getHealthStatuses?.(handler.actors ?? []) ?? ['weary', 'wounded', 'poisoned', 'miserable', 'daunted'];
        if (!allowed.includes(id)) return;
        for (const actor of new Set(handler.actors ?? [handler.actor])) {
            if (!actor?.isOwner || !['character', 'adversary', 'npc', 'lore'].includes(actor.type)
                || (actor.type !== 'character' && ['miserable', 'daunted'].includes(id))) continue;
            if (option === 'true') await actor.addStatusEffectById(id);
            else if (option === 'false') await actor.deleteStatusEffectById(id);
        }
    }
    if (command === 'integration') {
        if (id === 'macro_combat_manoeuvres' && handler.actor?.type === 'character' && handler.actor.isOwner
            && (!game.user.character || game.user.character.id === handler.actor.id) && game.modules.get('tor-2e-gamecontrol')?.active && typeof game.Tor2eGameControl?.[id] === 'function') {
            return game.Tor2eGameControl[id]();
        }
    }
}

export async function shareSystemItem(actor, item) {
    if (!canView(item) || !canView(actor)) return;
    const {Tor2eChatMessage} = await import('/systems/tor2e/modules/chat/Tor2eChatMessage.js');
    return new Tor2eChatMessage().createItemDescriptionMessage(actor, item);
}
