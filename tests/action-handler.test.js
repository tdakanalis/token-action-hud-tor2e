import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {test} from 'node:test';

// This import is supplied by Foundry at runtime; weapon loading does not use it.
const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === '/systems/tor2e/modules/hud/Tor2eTokenHudExtension.js') {
            return {
                url: 'data:text/javascript,export const Tor2eTokenHudExtension = {};',
                shortCircuit: true
            };
        }
        return nextResolve(specifier, context);
    }
});

let initialize;
globalThis.Hooks = {once: (event, callback) => { initialize = callback; }};
const {TOR2EActionHandler: initialHandler} = await import('../scripts/action-handler.js');
assert.equal(initialHandler, null);
await initialize({api: {ActionHandler: class {}, Utils: {i18n: key => key}}});
const {TOR2EActionHandler} = await import('../scripts/action-handler.js');
hooks.deregister();
delete globalThis.Hooks;

function makeHandler({mode = 'equipped', type = 'character', proficiency, group = 'swords'} = {}) {
    const weapon = {
        id: 'weapon-1', type: 'weapon', name: 'Sword', img: 'sword.webp',
        system: {
            group: {value: group}, equipped: {value: mode === 'equipped'},
            dropped: {value: mode === 'dropped'}, damage: {value: 5},
            injury: {value: 16}, description: {value: 'A sword'},
            skill: type === 'adversary' ? proficiency : {value: 5}
        }
    };
    const handler = new TOR2EActionHandler();
    handler.actor = {
        type, items: [weapon],
        extendedData: {getCombatProficiencies: () => new Map([['swords', proficiency]])}
    };
    handler.GROUP = {weapons: {id: 'weapons'}, unequipped: {id: 'unequipped'}, dropped: {id: 'dropped'}};
    handler.delimiter = '|';
    handler.actions = [];
    handler.addActions = (actions, group) => handler.actions.push(...actions.map(action => ({...action, group})));
    return handler;
}

for (const mode of ['equipped', 'unequipped', 'dropped']) {
    test(`missing character proficiency keeps the ${mode} weapon visible`, async () => {
        // The weapon group has no matching entry, even though the map is populated.
        const handler = makeHandler({mode, group: 'unknown', proficiency: {value: 3}});
        await handler._loadWeapons(mode);
        assert.equal(handler.actions.length, 1);
        const [action] = handler.actions;
        assert.equal(action.info1.text, '◇◇◇◇◇◇');
        assert.equal(action.info2.text, 5);
        assert.equal(action.info3.text, '16');
        assert.equal(action.encodedValue, 'weapon|character|Sword|weapon-1');
        assert.equal(action.group.id, mode === 'equipped' ? 'weapons' : mode);
    });
}

for (const type of ['character', 'adversary']) {
    test(`${type} weapon preserves proficiency and favoured display`, async () => {
        const handler = makeHandler({type, proficiency: {
            value: 3, favoured: {value: true, label: 'Favoured'}
        }});
        await handler._loadWeapons();
        assert.equal(handler.actions[0].info1.text, '◆◆◆◇◇◇');
        assert.equal(handler.actions[0].info3.text, '16  Favoured');
    });

    test(`${type} weapon preserves a zero rating`, async () => {
        const handler = makeHandler({type, proficiency: {value: 0}});
        await handler._loadWeapons();
        assert.equal(handler.actions[0].info1.text, '◇◇◇◇◇◇');
    });
}

test('adversary weapon without a skill keeps the weapon visible', async () => {
    const handler = makeHandler({type: 'adversary'});
    await handler._loadWeapons();
    assert.equal(handler.actions.length, 1);
    assert.equal(handler.actions[0].info1.text, '◇◇◇◇◇◇');
});
