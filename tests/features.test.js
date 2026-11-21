import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerHooks} from 'node:module';
import {canView, communityFor, handleFeatureAction, loadFeatures} from '../scripts/features.js';

registerHooks({resolve(specifier, context, nextResolve) {
    if (specifier === '/systems/tor2e/modules/chat/Tor2eChatMessage.js') return {
        url: 'data:text/javascript,export class Tor2eChatMessage {async createItemDescriptionMessage() {}}', shortCircuit: true
    };
    return nextResolve(specifier, context);
}});

function setup() {
    globalThis.game = {
        user: {isGM: true}, modules: new Map(), actors: new Map(), items: [], system: {version: '6.3.0'},
        settings: {get: () => false}, i18n: {localize: key => key},
        tor2e: {macro: {utility: {getCommunity: () => null}}}
    };
    globalThis.CONFIG = {statusEffects: []};
    globalThis.fromUuid = async uuid => [...game.actors.values(), ...game.items].find(document => document.uuid === uuid);
}

test('observer access is required before exposing document details', () => {
    setup();
    assert.equal(canView({isOwner: false, testUserPermission: () => false}), false);
    assert.equal(canView({isOwner: false, testUserPermission: () => true}), true);
});

test('a selected Community actor is used even when another company is active', () => {
    setup();
    const selected = {type: 'community', isOwner: true};
    game.tor2e.macro.utility.getCommunity = () => ({type: 'community', isOwner: true});
    assert.equal(communityFor(selected), selected);
});

test('a character outside the active company does not receive its controls', () => {
    setup();
    game.tor2e.macro.utility.getCommunity = () => ({type: 'community', isOwner: true, system: {members: [{id: 'member'}]}});
    assert.equal(communityFor({id: 'outsider'}), null);
});

test('sharing company totals reveals only resources of members players can view', async () => {
    setup();
    game.user.isGM = false;
    let share = false;
    game.settings.get = (_, key) => key === 'shareCompanyResourceTotals' && share;
    const members = ['owned', 'observer', 'private'].map(id => ({
        id, name: id, uuid: 'Actor.' + id, isOwner: id === 'owned',
        testUserPermission: () => id === 'observer',
        system: {resources: {endurance: {max: 25}, hope: {max: 10}}},
        extendedData: {getEndurance: () => 16, getHopePoint: () => 6}
    }));
    game.actors = new Map(members.map(actor => [actor.id, actor]));
    game.tor2e.macro.utility.getCommunity = () => ({
        type: 'community', testUserPermission: () => true, system: {members}, items: []
    });
    const actions = [];
    const handler = {
        delimiter: '|', GROUP: {community: {id: 'community'}},
        addGroup() {}, addActions: values => actions.push(...values)
    };
    await loadFeatures(handler);
    assert.deepEqual(actions.map(action => [action.name, action.info1?.text, action.info2?.text]),
        [['owned', '16/25', '6/10'], ['observer', undefined, undefined]]);
    share = true;
    actions.length = 0;
    await loadFeatures(handler);
    assert.deepEqual(actions.map(action => [action.name, action.info1?.text, action.info2?.text]),
        [['owned', '16/25', '6/10'], ['observer', '16/25', '6/10']]);
});

test('journey-role rolls delegate to the assigned actor rather than the selected company', async () => {
    setup();
    const actor = {id: 'hero', uuid: 'Actor.hero', isOwner: true};
    game.actors.set(actor.id, actor);
    const calls = [];
    game.tor2e.macro.utility.rollSkillMacro = async (...args) => calls.push(args);
    await handleFeatureAction({}, 'roleRoll', [actor.uuid, 'travel']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][3], actor);
    actor.isOwner = false;
    await handleFeatureAction({}, 'roleRoll', [actor.uuid, 'travel']);
    assert.equal(calls.length, 1);
});

test('combat tasks use system skill rolls', async () => {
    setup();
    const task = {uuid: 'Item.task', type: 'combat-task', isOwner: true, system: {associatedSkill: {value: 'battle'}}};
    game.items.push(task);
    const actor = {isOwner: true};
    let selected;
    game.tor2e.macro.utility.rollSkillMacro = async (label, interactive, options, performer) => {selected = performer;};
    await handleFeatureAction({actor}, 'task', [task.uuid]);
    assert.equal(selected, actor);
});

test('combat tasks prefer the actor copy without losing same-name variants', async () => {
    setup();
    const task = (id, parent, {skill = 'awe', stance = 'forward', description = '<p>Standard task.</p>'} = {}) => ({
        id, uuid: `${parent}Item.${id}`, name: 'Intimidate Foe', type: 'combat-task', isOwner: true,
        system: {associatedSkill: {value: skill}, associatedStance: {value: stance}, description: {value: description}}
    });
    const actorCopy = task('shared-id', 'Actor.hero.');
    const worldCopy = task('copied-id', '');
    const worldVariant = task('shared-id', '', {description: '<p>Campaign variant.</p>'});
    const otherSkill = task('other-skill', '', {skill: 'battle'});
    const otherStance = task('other-stance', '', {stance: 'defensive'});
    game.items = [worldCopy, worldVariant, otherSkill, otherStance];
    game.modules.set('tor-2e-gamecontrol', {active: true});
    game.Tor2eGameControl = {macro_combat_manoeuvres() {}};
    const actor = {type: 'character', isOwner: true, items: [actorCopy]};
    const actions = [];
    await loadFeatures({
        actor, delimiter: '|', GROUP: {resources: {id: 'resources'}, combat: {id: 'combat'}, community: {id: 'community'}},
        addGroup() {}, addActions: values => actions.push(...values)
    });
    const tasks = actions.filter(action => action.encodedValue.startsWith('hud|task|'));
    assert.deepEqual(tasks.map(action => action.encodedValue), [actorCopy, worldVariant, otherSkill, otherStance]
        .map(item => 'hud|task|' + item.uuid));
    assert.equal(new Set(tasks.map(action => action.id)).size, tasks.length);
    assert.ok(actions.every(action => action.encodedValue !== 'hud|integration|macro_combat_manoeuvres'));
});

test('explicit group conditions use system add/remove methods and deduplicate actors', async () => {
    setup();
    const calls = [];
    const hero = {isOwner: true, type: 'character', addStatusEffectById: async id => calls.push(['add', id]),
        deleteStatusEffectById: async id => calls.push(['remove', id])};
    const adversary = {isOwner: true, type: 'adversary', addStatusEffectById: async () => assert.fail('ineligible actor')};
    const handler = {actors: [hero, hero, adversary]};
    await handleFeatureAction(handler, 'condition', ['miserable', 'true']);
    await handleFeatureAction(handler, 'condition', ['miserable', 'false']);
    assert.deepEqual(calls, [['add', 'miserable'], ['remove', 'miserable']]);
});

test('the HUD does not dispatch Game Control Loremaster tools, even for GMs', async () => {
    setup();
    game.modules.set('tor-2e-gamecontrol', {active: true});
    game.Tor2eGameControl = {macro_communaute_ajouteprogression: () => assert.fail('not a HUD action')};
    await handleFeatureAction({actor: {isOwner: true, type: 'character'}}, 'integration', ['macro_communaute_ajouteprogression']);
});

test('target controls cannot target invisible tokens', async () => {
    setup();
    globalThis.canvas = {tokens: {get: () => ({visible: false, setTarget: () => assert.fail('hidden target')})}};
    await handleFeatureAction({}, 'target', ['hidden']);
    delete globalThis.canvas;
});

test('recovery refuses a crafted or stale action after Community ownership is lost', async () => {
    setup();
    const hero = {id: 'hero', uuid: 'Actor.hero', type: 'character', isOwner: true,
        update: () => assert.fail('must not change Hope')};
    const company = {id: 'company', uuid: 'Actor.company', type: 'community', isOwner: false,
        system: {members: [{id: hero.id}]}, update: () => assert.fail('must not spend Fellowship')};
    game.actors.set(hero.id, hero);
    game.actors.set(company.id, company);
    const warnings = [];
    globalThis.ui = {notifications: {warn: message => warnings.push(message)}};
    await handleFeatureAction({}, 'recoverHope', [hero.uuid, company.uuid]);
    assert.deepEqual(warnings, ['tokenActionHud.tor2e.actions.hopeRecoveryPermission']);
    delete globalThis.ui;
});

test('feature construction follows company membership and solo-mode settings', async () => {
    setup();
    const hero = {id: 'hero', uuid: 'Actor.hero', type: 'character', isOwner: true,
        items: [], effects: [], system: {resources: {endurance: {max: 20}, hope: {max: 10}}}};
    const company = {id: 'company', uuid: 'Actor.company', type: 'community', isOwner: true, items: [],
        system: {members: [{id: hero.id}], travel: {guide: {id: hero.id}}}};
    game.actors.set(hero.id, hero);
    game.tor2e.macro.utility.getCommunity = () => company;
    const actions = [];
    const handler = {actor: company, actors: [company], GROUP: {resources: {}, combat: {}, misc: {}, fellowship: {}, travel: {}, community: {}},
        delimiter: '|', addGroup: () => {}, addActions: values => actions.push(...values)};
    await loadFeatures(handler);
    assert.equal(actions.filter(action => action.encodedValue.startsWith('hud|roleRoll')).length, 1);
    actions.length = 0;
    game.settings.get = (scope, setting) => setting === 'soloMode';
    await loadFeatures(handler);
    assert.equal(actions.filter(action => action.encodedValue.startsWith('hud|roleRoll')).length, 0);
});

test('player effect-detail visibility follows the Loremaster setting', async () => {
    setup();
    game.user.isGM = false;
    const actor = {id: 'hero', uuid: 'Actor.hero', type: 'character', isOwner: true, items: [],
        effects: [{id: 'effect', uuid: 'Actor.hero.ActiveEffect.effect', name: 'Effect'}]};
    const actions = [];
    const handler = {actor, actors: [actor], GROUP: {resources: {}, combat: {}, misc: {}, community: {}},
        delimiter: '|', addGroup() {}, addActions: values => actions.push(...values)};
    await loadFeatures(handler);
    assert.equal(actions.some(action => action.id === 'tor2e_effect'), false);
    game.settings.get = (scope, key) => key === 'displayPlayerEffects';
    await loadFeatures(handler);
    assert.equal(actions.some(action => action.id === 'tor2e_effect'), true);
});
