import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getControlledTokens, getTargetedTokens, getActiveStatusIds, getImage, capitalizeFirstLetter} from '../scripts/utils.js';

test('controlled tokens come from the Foundry canvas', () => {
    globalThis.game = {};
    const tokens = [{id: 'one'}];
    globalThis.canvas = {tokens: {controlled: tokens}};
    assert.equal(getControlledTokens(), tokens);
    delete globalThis.canvas;
});

test('target ids work with standard Sets and missing game state', () => {
    globalThis.game = {user: {targets: new Set([{id: 'one'}])}};
    assert.deepEqual(getTargetedTokens(), new Set(['one']));
    delete globalThis.game;
    assert.deepEqual(getTargetedTokens(), new Set());
});

test('all enabled effect statuses are represented', () => {
    assert.deepEqual(getActiveStatusIds({effects: [
        {statuses: new Set(['weary', 'miserable'])},
        {statuses: new Set(['wounded']), disabled: true},
        {statuses: new Set(['poisoned']), isSuppressed: true},
        {}
    ]}), ['weary', 'miserable']);
});

test('image filtering does not mutate caller options', () => {
    globalThis.game = {settings: {get: () => true}};
    const defaults = Object.freeze(['default.webp']);
    assert.equal(getImage({img: 'sword.webp'}, defaults), 'sword.webp');
    assert.equal(getImage({img: 'icons/svg/mystery-man.svg'}, defaults), '');
});

test('empty localized labels do not break HUD construction', () => {
    assert.equal(capitalizeFirstLetter(''), '');
    assert.equal(capitalizeFirstLetter(undefined), '');
});
