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
globalThis.game = {i18n: {localize: key => key === 'tokenActionHud.tor2e.stats.damage' ? 'Damage' : key === 'tokenActionHud.tor2e.stats.injury' ? 'Injury' : key}};
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
        assert.equal(action.info2.text, 'Damage 5');
        assert.equal(action.info3.text, 'Injury 16');
        assert.equal(action.encodedValue, 'weapon|character||weapon-1');
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
        assert.equal(handler.actions[0].info3.text, 'Injury 16  Favoured');
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

function prepareBuild(type) {
    globalThis.game = {
        macros: [], items: [], actors: new Map(), modules: new Map(), user: {isGM: true, targets: new Set()}, settings: {get: () => true},
        i18n: {localize: key => key}, tor2e: {macro: {utility: {getCommunity: () => null}}}
    };
    globalThis.CONFIG = {statusEffects: []};
    const handler = new TOR2EActionHandler();
    handler.actor = {
        id: 'actor-1', type, items: [], effects: [], inCombat: false,
        system: {
            attributes: {}, stature: {}, resources: {}, commonSkills: {}, combatAttributes: {},
            skillPoints: {value: 0, total: {value: 0}},
            adventurePoints: {value: 0, total: {value: 0}}, treasure: {value: 0}
        },
        extendedData: {
            getAttributeLevel: () => 1, getEndurance: () => 10,
            getCombatProficiencies: () => new Map(), getParryBonus: () => 0,
            getArmourProtectionValue: () => 0, getHeadGearProtectionValue: () => 0,
            getShieldUsed: () => undefined
        }
    };
    handler.delimiter = '|';
    handler.actions = [];
    handler.addActions = (actions, group) => handler.actions.push(...actions.map(action => ({...action, group})));
    handler.addGroup = () => {};
    return handler;
}

for (const type of ['character', 'adversary', 'npc', 'lore', 'community']) {
    test(`existing HUD groups build for a ${type} actor`, async () => {
        const handler = prepareBuild(type);
        await handler.buildSystemActions([]);
        assert.ok(handler.actions.every(action => action.id !== undefined && action.encodedValue));
    });
}

test('Shadow display includes temporary Shadow, Scars and Taint', async () => {
    const handler = prepareBuild('character');
    handler.actor.system.resources.shadow = {temporary: {value: 2}, shadowScars: {value: 1}, taint: {value: 3}};
    await handler.buildSystemActions([]);
    assert.equal(handler.actions.find(action => action.id === 'shadow').info1.text, '6');
});

test('NPC skills with the same name remain separate actions identified by Item id', async () => {
    const handler = prepareBuild('npc');
    handler.actor.items = ['first', 'second'].map(id => ({id, type: 'skill', name: 'Notice', system: {
        value: 2, favoured: {value: false}, description: {value: ''}
    }}));
    await handler.buildSystemActions([]);
    assert.deepEqual(handler.actions.filter(action => action.name === 'Notice').map(action => action.id), ['first', 'second']);
});

test('macros with insufficient execution permission are not offered', async () => {
    const handler = prepareBuild('character');
    game.macros = [{id: 'denied', canExecute: false}, {id: 'allowed', name: 'Allowed', canExecute: true}];
    await handler.buildSystemActions([]);
    assert.deepEqual(handler.actions.filter(action => action.encodedValue.startsWith('macro|')).map(action => action.id), ['tor2e_allowed']);
});

test('armour names containing the delimiter do not corrupt item identity', async () => {
    const handler = prepareBuild('character');
    handler.actor.items = [{id: 'armour-id', type: 'armour', name: 'Shield | carved', system: {
        equipped: {value: true}, group: {value: 'shield'}, protection: {value: 2}
    }}];
    await handler.buildSystemActions([]);
    assert.equal(handler.actions.find(action => action.id === 'armour-id').encodedValue, 'armour|character||armour-id');
});

test('solo mode hides group journey-role controls', async () => {
    const handler = prepareBuild('character');
    game.settings.get = (scope, setting) => setting === 'soloMode';
    handler.GROUP = {travel: {id: 'travel'}};
    await handler._loadTravel({system: {travel: {guide: {id: handler.actor.id}}}});
    assert.equal(handler.actions.length, 0);
});

test('fell abilities expose their cost and current active state', async () => {
    const handler = prepareBuild('adversary');
    handler.actor.items = [{id: 'ability', type: 'fell-ability', name: 'Ability', system: {
        active: {value: true}, cost: {value: 2}, description: {value: ''}
    }}];
    await handler.buildSystemActions([]);
    const action = handler.actions.find(action => action.id === 'ability');
    assert.ok(action.cssClass.includes('active'));
    assert.ok(action.info1.text.endsWith(' 2'));
    assert.equal(action.info2.text, 'tokenActionHud.tor2e.states.active');
});
