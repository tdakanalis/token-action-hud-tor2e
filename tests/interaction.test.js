import assert from 'node:assert/strict';
import {test} from 'node:test';
import {registerInteractions} from '../scripts/interaction.js';

function setup() {
    const handlers = new Map();
    const refreshes = [];
    globalThis.Hooks = {on: (event, handler) => handlers.set(event, handler), callAll: event => refreshes.push(event)};
    globalThis.game = {user: {isGM: true}};
    registerInteractions();
    return {handlers, refreshes};
}

test('native and legacy wrapped context targets expose the same rank commands', () => {
    const {handlers} = setup();
    const menu = [];
    handlers.get('tokenActionHudCoreActionContextMenu')(menu, {actor: {isOwner: true, type: 'character'}});
    const button = {value: 'skill|character|heart|travel', closest() {return this;}};
    const increase = menu.find(item => item.label.endsWith('.increaseRank'));
    assert.equal(increase.visible(button), true);
    assert.equal(increase.visible([button]), true);
});

test('Core layout flag saves do not cause a HUD rebuild loop', () => {
    const {handlers, refreshes} = setup();
    handlers.get('updateActor')({}, {flags: {'token-action-hud-core': {layout: {}}}});
    assert.equal(refreshes.length, 0);
    handlers.get('updateActor')({}, {system: {resources: {hope: {value: 3}}}});
    assert.deepEqual(refreshes, ['forceUpdateTokenActionHud']);
});

test('a health context command stops working when the Loremaster disables it', async () => {
    const {handlers} = setup();
    let enabled = true;
    game.user.isGM = false;
    game.settings = {get: () => enabled};
    const menu = [];
    const actor = {isOwner: true, addStatusEffectById: () => assert.fail('disabled action ran')};
    handlers.get('tokenActionHudCoreActionContextMenu')(menu, {actor});
    const button = {value: 'health|character|weary'};
    const apply = menu.find(item => item.label.endsWith('.apply') && item.visible(button));
    assert.ok(apply);
    enabled = false;
    assert.equal(apply.visible(button), false);
    await apply.onClick({}, button);
});
