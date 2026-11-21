import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';

const utility = {eventsProcessing: {}};
globalThis.__hudTestUtility = utility;
const loader = registerHooks({resolve(specifier, context, nextResolve) {
    if (specifier === '/systems/tor2e/modules/utilities.js') return {
        url: 'data:text/javascript,export const tor2eUtilities = globalThis.__hudTestUtility;', shortCircuit: true
    };
    if (specifier === '/systems/tor2e/modules/song.js') return {
        url: 'data:text/javascript,export default class Tor2eSong {}', shortCircuit: true
    };
    if (specifier === '/systems/tor2e/modules/combat/Tor2eStance.js') return {
        url: 'data:text/javascript,export const Tor2eStance = {from: value => ({toJSON: () => ({class: value})})};', shortCircuit: true
    };
    return nextResolve(specifier, context);
}});
let initialize;
globalThis.Hooks = {once: (_, callback) => {initialize = callback;}};
await import('../scripts/roll-handler.js');
await initialize({api: {RollHandler: class {}, Utils: {
    i18n: key => key, getItem: (actor, id) => actor.items.find(item => item.id === id)
}}});
const {TOR2ERollHandler} = await import('../scripts/roll-handler.js');
loader.deregister();
delete globalThis.Hooks;

function handler(actor = {}) {
    globalThis.game = {
        user: {isGM: true}, settings: {get: () => true},
        tor2e: {macro: {utility: {}}}, i18n: {localize: key => key}
    };
    const instance = new TOR2ERollHandler();
    instance.actor = actor;
    return instance;
}

test('skill rolls explicitly use the HUD actor', async () => {
    const actor = {id: 'hud-actor'};
    const instance = handler(actor);
    let rolledActor;
    game.tor2e.macro.utility.rollSkillMacro = async (_, interactive, options, selectedActor) => {rolledActor = selectedActor;};
    await instance._rollSkill('character', 'strength', 'awe');
    assert.equal(rolledActor, actor);
});

test('proficiency rolls use the HUD actor and do not mutate derived proficiency', async () => {
    const proficiency = Object.freeze({value: 3});
    const actor = {extendedData: {getCombatProficiencies: () => new Map([['swords', proficiency]])}};
    const instance = handler(actor);
    game.tor2e.macro.utility._executeSkillMacro = async (selected, _, interactive, getSkill) => {
        assert.equal(selected, actor);
        assert.deepEqual(getSkill(), {value: 3, favoured: {value: false}});
    };
    await instance._rollProficiency('character', 'swords');
    assert.deepEqual(proficiency, {value: 3});
});

test('missing proficiency is passed to the system for its normal missing-skill feedback', async () => {
    const instance = handler({extendedData: {getCombatProficiencies: () => new Map()}});
    game.tor2e.macro.utility._executeSkillMacro = async (_, label, interactive, getSkill) => assert.equal(getSkill(), null);
    await instance._rollProficiency('character', 'unknown');
});

test('NPC skill adaptation preserves its associated attribute without changing the Item', async () => {
    const skill = Object.freeze({id: 'npc-skill', type: 'skill', name: 'Notice', system: {
        value: 2, associatedStat: {value: 'wits'}, favoured: {value: true}
    }});
    const instance = handler({items: [skill]});
    game.tor2e.macro.utility._executeSkillMacro = async (_, label, interactive, getSkill) => {
        assert.deepEqual(getSkill(label), {...skill.system, label: 'Notice', roll: {associatedAttribute: 'wits'}});
    };
    await instance._rollSkill('npc', 'wits', 'npc-skill');
});

test('rest delegates with an isolated actor context', async () => {
    const actor = {id: 'resting', isOwner: true};
    const instance = handler(actor);
    const original = {id: 'other'};
    utility.eventsProcessing.actor = original;
    utility.eventsProcessing.onShortRest = async function() {assert.equal(this.actor, actor);};
    await instance._performRest('character', 'short', {});
    assert.equal(utility.eventsProcessing.actor, original);
});

test('both native rest paths are blocked before mutation for an Observer-only Community', async () => {
    const actor = {id: 'resting', isOwner: true, update: () => assert.fail('must not mutate Hope')};
    const instance = handler(actor);
    const company = {type: 'community', isOwner: false};
    game.tor2e.macro.utility.getCommunity = () => company;
    const warnings = [];
    globalThis.ui = {notifications: {warn: message => warnings.push(message)}};
    utility.eventsProcessing.onShortRest = async () => assert.fail('unsafe short rest');
    utility.eventsProcessing.onProlongedRest = async () => assert.fail('unsafe prolonged rest');
    await instance._performRest('character', 'short', {});
    await instance._performRest('character', 'prolonged', {});
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every(message => message === 'tokenActionHud.tor2e.actions.hopeRecoveryPermission'));
    delete globalThis.ui;
});

test('authorized rest delegates unchanged, and permission changes are checked on every click', async () => {
    const actor = {isOwner: true};
    const instance = handler(actor);
    const company = {type: 'community', isOwner: true};
    game.tor2e.macro.utility.getCommunity = () => company;
    globalThis.ui = {notifications: {warn: () => {}}};
    const event = {};
    let calls = 0;
    utility.eventsProcessing.onProlongedRest = async function(extra, receivedEvent) {
        assert.equal(this.actor, actor);
        assert.equal(receivedEvent, event);
        calls++;
    };
    await instance._performRest('character', 'prolonged', event);
    company.isOwner = false;
    await instance._performRest('character', 'prolonged', event);
    assert.equal(calls, 1);
    company.isOwner = true;
    actor.isOwner = false;
    await instance._performRest('character', 'prolonged', event);
    assert.equal(calls, 1);
    delete globalThis.ui;
});

test('weapon attack delegates directly to the selected actor', async () => {
    let attacked;
    const instance = handler({items: [{id: 'sword', name: 'Sword', system: {equipped: {value: true}}}],
        attackOpponentWith: async name => {attacked = name;}});
    await instance._useWeapon('character', 'Sword', 'sword');
    assert.equal(attacked, 'Sword');
});

test('dropping equipment updates both fields together and disables its effects', async () => {
    const updates = [];
    const effects = [];
    const instance = handler({items: [{id: 'shield', update: async data => updates.push(data)}],
        toggleItemActiveEffect: async (...args) => effects.push(args)});
    await instance._setItemStatus('shield', 'system.dropped.value', true, 'system.equipped.value', false);
    assert.deepEqual(updates, [{'system.dropped.value': true, 'system.equipped.value': false}]);
    assert.deepEqual(effects, [['shield', false]]);
});

test('mixed combat selection adds missing tokens without removing existing combatants', async () => {
    const instance = handler();
    const changed = [];
    globalThis.canvas = {tokens: {controlled: [
        {inCombat: true, document: {toggleCombatant: async () => changed.push('existing')}},
        {inCombat: false, document: {toggleCombatant: async () => changed.push('new')}}
    ]}};
    await instance._toggleCombat();
    assert.deepEqual(changed, ['new']);
    game.user.isGM = false;
    await instance._toggleCombat();
    assert.deepEqual(changed, ['new']);
    delete globalThis.canvas;
});

test('group status toggles affect a linked actor only once', async () => {
    const instance = handler();
    const statuses = [];
    const actor = {type: 'character', toggleStatusEffectById: async status => statuses.push(status)};
    instance.actors = [actor, actor];
    await instance._toggleHealthStatus('weary');
    assert.deepEqual(statuses, ['weary']);
});

test('mixed group health toggles skip unowned and ineligible actors', async () => {
    const instance = handler();
    const changed = [];
    instance.actors = ['character', 'adversary', 'community'].map(type => ({type, isOwner: true,
        toggleStatusEffectById: async () => changed.push(type)}));
    instance.actors.push({type: 'character', isOwner: false, toggleStatusEffectById: () => assert.fail('unowned actor')});
    await instance._toggleHealthStatus('miserable');
    assert.deepEqual(changed, ['character']);
});

test('Shift-click reaches the system quick-roll path instead of swallowing the action', async () => {
    const instance = handler({id: 'hero'});
    instance.isShift = true;
    let interactive;
    game.tor2e.macro.utility.rollSkillMacro = async (_, showOptions) => {interactive = showOptions;};
    await instance._handleActionClick({}, 'skill|character|heart|travel');
    assert.equal(interactive, false);
});

test('rank commands delegate bounds and persistence to the system processor', async () => {
    const actor = {system: {commonSkills: {travel: {value: 2}}}};
    const instance = handler(actor);
    const calls = [];
    utility.eventsProcessing.onSkillModify = async function(extra, event) {
        calls.push({actor: this.actor, field: event.currentTarget.dataset.field, value: event.currentTarget.dataset.actionValue,
            decrease: event.shiftKey});
    };
    await instance._changeSkillRank('character', 'travel', 1);
    await instance._changeSkillRank('character', 'travel', -1);
    assert.deepEqual(calls, [
        {actor, field: 'system.commonSkills.travel.value', value: '2', decrease: false},
        {actor, field: 'system.commonSkills.travel.value', value: '2', decrease: true}
    ]);
    assert.equal(actor.system.commonSkills.travel.value, 2, 'HUD must not update rank itself');
});
