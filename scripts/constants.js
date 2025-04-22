export function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
}

export function generateDiamonds(count) {
    const total = 6;
    const full = '◆';
    const empty = '◇';

    if (count < 0 || count > total) {
        throw new Error('Count must be between 0 and 6');
    }

    return full.repeat(count) + empty.repeat(total - count);
}

export function getGroup(coreModule) {
    return {
        stats: { id: 'stats', name: 'Stats', type: 'system', settings: {image: "systems/tor2e/assets/images/icons/actors/character.webp"} },
        attributes: { id: 'attributes', name: coreModule.api.Utils.i18n('tor2e.actors.sections.attributes'), type: 'system' },
        stature: { id: 'stature', name: coreModule.api.Utils.i18n('tor2e.actors.sections.heroicStature'), type: 'system' },
        resources: { id: 'resources', name: coreModule.api.Utils.i18n('tor2e.actors.sections.resources'), type: 'system' },
        advancement: { id: 'advancement', name: 'Advancement', type: 'system' },

        skills: { id: 'skills', name: coreModule.api.Utils.i18n('tor2e.actors.sections.commonSkills'), type: 'system',  settings: {image: "systems/tor2e/assets/images/icons/skill.png"} },
        strength: { id: 'strength', name: coreModule.api.Utils.i18n('tor2e.stats.strength'), type: 'system' },
        heart: { id: 'heart', name: coreModule.api.Utils.i18n('tor2e.stats.heart'), type: 'system' },
        wits: { id: 'wits', name: coreModule.api.Utils.i18n('tor2e.stats.wits'), type: 'system' },

        combat: { id: 'combat', name: coreModule.api.Utils.i18n('tor2e.actors.sections.combat'), type: 'system', settings: {image: "systems/tor2e/assets/images/icons/weapons/dagger.png"} },
        stances: { id: 'stances', name: 'Stances', type: 'system' },
        weapons: {id: 'weapons', name: coreModule.api.Utils.i18n('tor2e.items.common.equipped') + " " + coreModule.api.Utils.i18n('tor2e.items.weapons.title'), type: 'system' },
        armours: {id: 'armours', name: coreModule.api.Utils.i18n('tor2e.items.common.equipped') + " " + coreModule.api.Utils.i18n('tor2e.items.armours.title'), type: 'system' },
        combatProficiences: { id: 'combatProficiences', name: coreModule.api.Utils.i18n('tor2e.actors.sections.combatProficiencies'), type: 'system' },
        combatAttributes: { id: 'combatAttributes', name: coreModule.api.Utils.i18n('tor2e.actors.sections.attributes'), type: 'system' },

        traits: { id: 'traits', name: coreModule.api.Utils.i18n('tor2e.actors.sections.traits'), type: 'system',  settings: {image: "systems/tor2e/assets/images/icons/miscellaneous.webp"} },
        features: { id: 'features', name: coreModule.api.Utils.i18n('tor2e.actors.traits.distinctiveFeatures'), type: 'system' },
        flaws: { id: 'flaws', name: coreModule.api.Utils.i18n('tor2e.actors.traits.flaws'), type: 'system' },
        rewards: { id: 'rewards', name: coreModule.api.Utils.i18n('tor2e.actors.sections.rewards'), type: 'system' },
        virtues: { id: 'virtues', name: coreModule.api.Utils.i18n('tor2e.actors.sections.virtues'), type: 'system' },

        misc: { id: 'misc', name: coreModule.api.Utils.i18n('tor2e.items.miscellaneous.title'), type: 'system',  settings: {image: "systems/tor2e/assets/images/icons/gear.png"} },
        equipment: { id: 'equipment', name: coreModule.api.Utils.i18n('tor2e.actors.sections.equipment-gear'), type: 'system' },
        rest: { id: 'rest', name: coreModule.api.Utils.i18n('tor2e.actors.stats.rest'), type: 'system' },
        health: { id: 'health', name: coreModule.api.Utils.i18n('tor2e.actors.stats.health'), type: 'system' },

        community: { id: 'community', name: coreModule.api.Utils.i18n('tor2e.actors.types.community.title'), type: 'system',  settings: {image: "systems/tor2e/assets/images/icons/actors/community.webp"} },
        travel: { id: 'travel', name: coreModule.api.Utils.i18n('tor2e.actors.sections.travel'), type: 'system' },
        fellowship: { id: 'fellowship', name: coreModule.api.Utils.i18n('tor2e.actors.stats.fellowshipPoints'), type: 'system' },
    };
}

export const SKILLS = {
    STR: ["awe", "athletics", "awareness", "hunting", "song", "craft"],
    HEART: ["enhearten", "travel", "insight", "healing", "courtesy", "battle"],
    WITS: ["persuade", "stealth", "scan", "explore", "riddle", "lore"],
}


export const STATS = {
    ATTRIBUTE: ["strength", "heart", "wits"],
    STATURE: ["valour", "wisdom"],
    RESOURCE: ["hope", "endurance", "shadow", "load", "travelLoad"],
}