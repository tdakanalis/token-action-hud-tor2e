// Import only in the isolated local world. This creates synthetic documents, never campaign data.
export async function createFixture() {
    if (!game.user.isGM || game.world.id !== 'hud-regression-tests') {
        throw new Error('HUD fixtures may only run as the GM in hud-regression-tests.');
    }
    const flag = 'token-action-hud-tor2e';
    const existing = game.actors.find(actor => actor.getFlag(flag, 'fixture') === 'hero');
    if (existing) return {existing: true, heroId: existing.id};
    const hero = await Actor.create({name: 'HUD Test Hero', type: 'character',
        flags: {[flag]: {fixture: 'hero'}},
        system: {
            attributes: {strength: {value: 5}, heart: {value: 4}, wits: {value: 5}},
            resources: {endurance: {value: 20, max: 25}, hope: {value: 8, max: 12}},
            commonSkills: {travel: {value: 2}, awareness: {value: 3}, battle: {value: 2}},
            combatProficiencies: {swords: {value: 3}}
        }});
    const adversary = await Actor.create({name: 'HUD Test Adversary', type: 'adversary',
        flags: {[flag]: {fixture: 'adversary'}}, system: {
            endurance: {value: 12, max: 18}, hate: {value: 3, max: 5}, attributeLevel: {value: 3}
        }});
    const npc = await Actor.create({name: 'HUD Test NPC', type: 'npc', flags: {[flag]: {fixture: 'npc'}}});
    const lore = await Actor.create({name: 'HUD Test Patron', type: 'lore', flags: {[flag]: {fixture: 'lore'}}});
    const digest = {id: hero.id, name: hero.name, token: hero.img, location: '', owner: true};
    const community = await Actor.create({name: 'HUD Test Company', type: 'community',
        flags: {[flag]: {fixture: 'community'}}, system: {
            members: [digest], travel: {guide: digest}, fellowshipPoints: {value: 3, max: 5}
        }});
    await hero.createEmbeddedDocuments('Item', [
        {name: 'Test Sword', type: 'weapon', system: {equipped: {value: true}, group: {value: 'swords'}, damage: {value: 5}}},
        {name: 'Unknown Proficiency', type: 'weapon', system: {equipped: {value: true}, group: {value: 'unknown'}}},
        {name: 'Test Shield', type: 'armour', system: {group: {value: 'shield'}, protection: {value: 2}, equipped: {value: true}}},
        {name: 'Spare Shield', type: 'armour', system: {group: {value: 'shield'}, protection: {value: 9}, equipped: {value: false}}},
        {name: 'Test Feature', type: 'trait', system: {group: {value: 'distinctiveFeature'}, description: {value: '<p>Synthetic trait for HUD testing.</p>'}}}
    ]);
    await adversary.createEmbeddedDocuments('Item', [
        {name: 'Test Spear', type: 'weapon', system: {equipped: {value: true}, skill: {value: 2}, damage: {value: 4}}},
        {name: 'Test Fell Ability', type: 'fell-ability', system: {cost: {value: 1}, description: {value: '<p>Synthetic ability for HUD testing.</p>'}}}
    ]);
    await npc.createEmbeddedDocuments('Item', [{name: 'Notice', type: 'skill', system: {value: 2, associatedStat: {value: 'wits'}}}]);
    await community.createEmbeddedDocuments('Item', [
        {name: 'Test Journey', type: 'journey-log'},
        {name: 'Test Walking Song', type: 'song', system: {group: {value: 'journey'}}},
        {name: 'Test Pony', type: 'mount', system: {vigour: {value: 2}}}
    ]);
    await Item.create({name: 'Test Combat Task', type: 'combat-task', system: {
        associatedStance: {value: 'all'}, associatedSkill: {value: 'battle'},
        description: {value: '<p>Synthetic task, no automatic effects.</p>'}
    }});
    await game.settings.set('tor2e', 'communityCurrentActor', community.id);
    const scene = await Scene.create({name: 'HUD Test Scene', width: 1600, height: 1200, grid: {size: 100, type: 0},
        flags: {[flag]: {fixture: true}}});
    const actors = [hero, adversary, npc, lore, community];
    await scene.createEmbeddedDocuments('Token', await Promise.all(actors.map(async (actor, index) => {
        const token = await actor.getTokenDocument({x: 400 + index * 150, y: 400});
        return token.toObject();
    })));
    const player = await User.create({name: 'HUD Test Player', role: CONST.USER_ROLES.PLAYER, character: hero.id});
    await hero.update({[`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER});
    await community.update({[`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER});
    await scene.activate();
    return {heroId: hero.id, adversaryId: adversary.id, npcId: npc.id, loreId: lore.id,
        communityId: community.id, sceneId: scene.id, playerId: player.id};
}

export async function enrichFixture() {
    if (!game.user.isGM || game.world.id !== 'hud-regression-tests') throw new Error('Isolated GM test world required.');
    const actorFor = type => canvas.tokens.placeables.find(token => token.actor.getFlag('token-action-hud-tor2e', 'fixture') === type)?.actor;
    const hero = actorFor('hero');
    const community = actorFor('community');
    const lore = actorFor('lore');
    if (!hero || !community || !lore) throw new Error('Create the base fixture first.');
    const items = [
        {name: 'Test Undertaking', type: 'undertaking', system: {location: {value: 'Bree'}, year: {value: '2965'},
            yule: {value: false}, free: {value: false}, season: {value: 2}, usage: {value: ''}, originId: {value: ''}}},
        {name: 'Test Standing', type: 'standing', system: {location: {value: 'Bree'}, rating: {value: 2}}}
    ].filter(data => !hero.items.some(item => item.name === data.name && item.type === data.type));
    await game.settings.set('tor2e', 'standingActivation', 'extended');
    // Undertakings use a native enrichment dialog on creation. Submit that
    // dialog instead of bypassing the system's pre-create behavior.
    const hook = Hooks.on('renderDialog', app => {
        if (!app.options.classes?.includes('undertaking')) return;
        requestAnimationFrame(() => app.element[0].querySelector('[data-button="create"]')?.click());
    });
    try {
        if (items.length) await hero.createEmbeddedDocuments('Item', items);
    } finally {Hooks.off('renderDialog', hook);}
    if (!hero.effects.some(effect => effect.name === 'HUD Test Effect')) await hero.createEmbeddedDocuments('ActiveEffect', [
        {name: 'HUD Test Effect', disabled: true, changes: []}
    ]);
    const contact = {id: lore.id, name: lore.name, token: lore.img, location: 'Bree', owner: true};
    if (!community.system.patrons.some(entry => entry.id === lore.id)) {
        await community.update({'system.patrons': [...community.system.patrons, contact]});
    }
    const song = community.items.find(item => item.type === 'song');
    if (song) await song.update({'system.group.value': 'journey'});
    const player = game.users.getName('HUD Test Player');
    await lore.update({[`ownership.${player.id}`]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER});
    return {hero: hero.id, community: community.id, contact: lore.id};
}
