import {capitalizeFirstLetter, generateDiamonds, getGroup, SKILLS} from "./constants.js";

import {Tor2eTokenHudExtension} from "/systems/tor2e/modules/hud/Tor2eTokenHudExtension.js";
import {getTargetedTokens} from "./utils.js";

export let TOR2EActionHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's ActionHandler class and builds system-defined actions for the HUD.
    TOR2EActionHandler = class TOR2EActionHandler extends coreModule.api.ActionHandler {

        /** @override */
        async buildSystemActions(groupIds) {
            this.GROUP = getGroup(coreModule);

            const token = this.token;
            if (!token) return;
            const tokenId = token.id;
            const actor = this.actor;
            if (!actor) return;

            console.debug('actor', this.actor);
            console.debug('token', this.token);
            console.debug('game', game);

            await this._loadStats();
            await this._loadSkills();
            await this._loadCombat();
            await this._loadTraits();
            await this._loadMiscellaneous();
            await this._loadCommunity();
        }

        async _loadStats() {
            await this._loadAttributes();
            await this._loadStature();
            await this._loadResources();
            await this._loadAdvancement();
        }
        async _loadAttributes() {
            if(this.actor.type === 'character') {
                Object.keys(this.actor.system.attributes).forEach( el => {
                    let group = this.GROUP.attributes;
                    let attribute = this.actor.system.attributes[el];
                    let name = coreModule.api.Utils.i18n(attribute.label);
                    let valueFunc = 'get' + capitalizeFirstLetter(el);
                    let value = this.actor.extendedData?.[valueFunc]();
                    let tn = this.actor.extendedData?.getTn(el);

                    this.addActions([{
                        id:el,
                        img: "systems/tor2e/assets/images/icons/actors/character.webp",
                        name: name,
                        description: name,
                        encodedValue: ['attribute','character', el].join(this.delimiter),
                        info1: { text: value },
                        info2: { class: "hud-info", text: 'TN ' + tn }
                    }], group)
                })
            } else if(this.actor.type === 'adversary') {
                let group = this.GROUP.attributes;
                const attributeLevel = this.actor.extendedData?.getAttributeLevel();
                const might = this.actor.system?.might.value;
                const maxMight = this.actor.system?.might.max;

                this.addActions([
                    {
                        id: "attributeLevel",
                        img: "systems/tor2e/assets/images/icons/actors/character.webp",
                        name: coreModule.api.Utils.i18n(this.actor.system?.attributeLevel?.label),
                        description: coreModule.api.Utils.i18n(this.actor.system?.attributeLevel?.label),
                        encodedValue: ['attribute', 'adversary', 'attributeLevel'].join(this.delimiter),
                        info1: {text: '' + attributeLevel},
                    },
                    {
                        id: "might",
                        img: "systems/tor2e/assets/images/icons/actors/character.webp",
                        name: coreModule.api.Utils.i18n(this.actor.system?.might?.label),
                        description: coreModule.api.Utils.i18n(this.actor.system?.might?.label),
                        encodedValue: ['attribute', 'adversary', 'might'].join(this.delimiter),
                        info1: {text: '' + might},
                        info2: { class: "hud-info", text: 'Max ' + maxMight }
                    }
                ], group)
            } else if(this.actor.type === 'npc') {
                let group = this.GROUP.attributes;
                const attributeLevel = this.actor.extendedData?.getAttributeLevel();

                this.addActions([
                    {
                        id: "attributeLevel",
                        img: "systems/tor2e/assets/images/icons/actors/character.webp",
                        name: coreModule.api.Utils.i18n(this.actor.system?.attributeLevel?.label),
                        description: coreModule.api.Utils.i18n(this.actor.system?.attributeLevel?.label),
                        encodedValue: ['attribute', this.actor.type, 'attributeLevel'].join(this.delimiter),
                        info1: {text: '' + attributeLevel},
                    }
                ], group)
            }
        }
        async _loadResources() {
            if(this.actor.type === 'character') {
                Object.keys(this.actor.system.resources).forEach( el => {
                    let group = this.GROUP.resources;
                    let attribute = this.actor.system.resources[el];
                    let name = '';
                    let value = '';
                    let extra = '';
                    let image = '';
                    const maxLabel = capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.actors.stats.max'));
                    const fatigueLabel = capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.actors.stats.travelLoad'));
                    if (el === 'travelLoad') {
                        name = coreModule.api.Utils.i18n('tor2e.actors.stats.load');
                        value = "" + (this.actor.extendedData?.getLoad() || 0);
                        extra = fatigueLabel + " " + (this.actor.system?.resources?.travelLoad?.value || 0);
                        image = 'travel-gear.png';
                    } else if (el === 'shadow') {
                        name = coreModule.api.Utils.i18n('tor2e.actors.stats.shadow');
                        value = "" + (attribute.shadowScars.value + attribute.temporary.value);
                        image = 'actors/lore.webp';
                    } else if (el === 'hope') {
                        name = coreModule.api.Utils.i18n(attribute.label);
                        value = "" + (this.actor.extendedData?.getHopePoint() || 0);
                        extra = maxLabel + " " + (this.actor.system?.resources?.hope?.max || 0);
                        image = 'virtue.png';
                    } else if (el === 'endurance') {
                        name = coreModule.api.Utils.i18n(attribute.label);
                        value = "" + (this.actor.extendedData?.getEndurance() || 0);
                        extra = maxLabel + " " + (this.actor.system?.resources?.endurance?.max || 0);
                        image = 'calling.png';
                    }
                    const action = {
                        id:el,
                        name: name,
                        img: 'systems/tor2e/assets/images/icons/' + image,
                        description: name,
                        encodedValue: ['resource','character', el].join(this.delimiter),
                        info1: { class: "hud-info", text: value }
                    };
                    if (extra) {
                        action['info2'] = { class: "hud-info", text: extra }
                    }
                    this.addActions([action], group)
                })
            } else if(this.actor.type === 'adversary') {
                let group = this.GROUP.resources;
                const endurance = this?.actor.system?.endurance;
                const hate = this.actor.system?.hate;
                const enduranceValue = this.actor.extendedData?.getEndurance();

                this.addActions([
                    {
                        id: "endurance",
                        img: "systems/tor2e/assets/images/icons/calling.png",
                        name: coreModule.api.Utils.i18n(endurance?.label),
                        description: coreModule.api.Utils.i18n(endurance?.label),
                        encodedValue: ['attribute', 'adversary', 'endurance'].join(this.delimiter),
                        info1: {text: enduranceValue},
                        info2: { class: "hud-info", text: "Max " + endurance?.max }
                    },
                    {
                        id: "hate",
                        img: "systems/tor2e/assets/images/icons/actors/lore.webp",
                        name: coreModule.api.Utils.i18n(hate?.label),
                        description: coreModule.api.Utils.i18n(hate?.label),
                        encodedValue: ['attribute', 'adversary', 'hate'].join(this.delimiter),
                        info1: {text: hate?.value},
                        info2: { class: "hud-info", text: 'Max ' + hate?.max }
                    }
                ], group)
            } else if(this.actor.type === 'npc') {
                let group = this.GROUP.resources;
                const endurance = this?.actor.system?.endurance;
                this.addActions([
                    {
                        id: "endurance",
                        img: "systems/tor2e/assets/images/icons/calling.png",
                        name: coreModule.api.Utils.i18n(endurance?.label),
                        description: coreModule.api.Utils.i18n(endurance?.label),
                        encodedValue: ['attribute', this.actor.type, 'endurance'].join(this.delimiter),
                        info1: {text: '' + endurance?.value},
                        info2: { class: "hud-info", text: "Max " + endurance?.max }
                    }
                ], group)
            }
        }
        async _loadStature() {
            if(this.actor.type === 'character') {
                Object.keys(this.actor.system.stature).forEach( el => {
                    let attribute = this.actor.system.stature[el];
                    let name = coreModule.api.Utils.i18n(attribute.label);
                    let value = "" + attribute.value;
                    this.addActions([{
                        id:el,
                        img: 'systems/tor2e/assets/images/icons/skills/skill-' + el + '.webp',
                        name: name,
                        description: name,
                        encodedValue: ['stature','character', el].join(this.delimiter),
                        info1: { text: value }
                    }], this.GROUP.stature)
                })
            }
        }
        async _loadAdvancement() {
            if(this.actor.type === 'character') {
                const totalLabel = capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.statureStats.total'));
                this.addActions([{
                    id: 'skillPoints',
                    img: 'systems/tor2e/assets/images/icons/skill.png',
                    name: coreModule.api.Utils.i18n('tor2e.actors.sections.skillPoints'),
                    encodedValue: ['advancement','character', 'skillPoints'].join(this.delimiter),
                    info1: { text: '' + this.actor.system.skillPoints.value},
                    info2: { class: "hud-info", text: totalLabel + ' ' + this.actor.system.skillPoints.total.value}
                }], this.GROUP.advancement);
                this.addActions([{
                    id: 'adventurePoints',
                    img: 'systems/tor2e/assets/images/icons/journey-log.png',
                    name: coreModule.api.Utils.i18n('tor2e.statureStats.adventurePoints'),
                    encodedValue: ['advancement','character', 'adventurePoints'].join(this.delimiter),
                    info1: { text: '' + this.actor.system.adventurePoints.value},
                    info2: { class: "hud-info", text: totalLabel + ' ' + this.actor.system.adventurePoints.total.value}
                }], this.GROUP.advancement);
                this.addActions([{
                    id: 'treasure',
                    img: 'systems/tor2e/assets/images/icons/treasure.png',
                    name: coreModule.api.Utils.i18n('tor2e.actors.sections.treasure'),
                    encodedValue: ['advancement','character', 'treasure'].join(this.delimiter),
                    info1: { text: '' + this.actor.system.treasure.value}
                }], this.GROUP.advancement)
            }
        }

        async _loadSkills() {
            if(this.actor.type === 'character') {
                Object.keys(this.actor.system.commonSkills).forEach( el => {
                    let group = this.GROUP.skills;
                    let attr = ''
                    if(SKILLS.STR.includes(el))  { group = this.GROUP.strength; attr='strength' }
                    if(SKILLS.HEART.includes(el))  { group = this.GROUP.heart; attr='heart' }
                    if(SKILLS.WITS.includes(el))  { group = this.GROUP.wits; attr='wits' }

                    const skill = this.actor.system.commonSkills[el];
                    const name = coreModule.api.Utils.i18n(skill.label);
                    const isFavoured = skill.favoured.value;
                    const isMagical = skill.magical.value;

                    const action = {
                        id:el,
                        img: 'systems/tor2e/assets/images/icons/skills/skill-' + el + '.webp',
                        name: name,
                        description: name,
                        encodedValue: ['skill', 'character', attr, el].join(this.delimiter),
                        info1: { text: generateDiamonds(skill.value) },
                    }

                    if (isFavoured) {
                        action['info2'] = { text: capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.stats.favoured')) }
                    }

                    if (isMagical) {
                        action['info3'] = { text: capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.chat.taskCheck.options.magical')) }
                    }

                    this.addActions([action], group)
                })
            } else if(this.actor.type === 'npc') {
                const availableSkills = new Map(
                    this.actor.items
                        .filter(e => e.type === 'skill')
                        .map(s => [s.name, s])
                );
                Array.from(availableSkills.keys()).forEach( el => {
                    const skill = availableSkills.get(el);
                    const group = skill?.system?.associatedStat?.value && this.GROUP[skill.system.associatedStat.value] ?
                        this.GROUP[skill.system.associatedStat.value] : this.GROUP.skills;
                    const isFavoured = skill.system.favoured.value;

                    const action = {
                        id: el,
                        img: skill.img,
                        name: el,
                        tooltip: skill?.system.description.value,
                        encodedValue: ['skill', this.actor.type, group.id, el].join(this.delimiter),
                        info1: { text: generateDiamonds(skill.system.value) },
                    }

                    if (isFavoured) {
                        action['info2'] = { text: capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.stats.favoured')) }
                    }

                    this.addActions([action], group)
                })
            }
        }

        async _loadCombat() {
            await this._loadWeapons();
            await this._loadArmours();
            await this._loadCombatProficiencies();
            await this._loadCombatAttributes();
            await this._loadStances();
        }
        async _loadWeapons() {
            if(this.actor.type === 'character' || this.actor.type === 'adversary') {
                const weapons = Array.from(this.actor.items.filter(e => e.type === 'weapon'))
                let proficiencies = null;
                if (this.actor.type === 'character') {
                    proficiencies = this.actor.extendedData?.getCombatProficiencies();
                }
                weapons.filter(w => w?.system?.equipped?.value).forEach(weapon => {
                    let damage = weapon?.system?.damage?.value;
                    let injury = weapon?.system?.injury?.value;
                    const proficiency = proficiencies ? proficiencies.get(weapon?.system?.group?.value) : weapon?.system?.skill;
                    const action = {
                        id: weapon.id,
                        cssClass: "weapon",
                        name: weapon.name,
                        img: weapon.img,
                        tooltip: weapon?.system?.description?.value,
                        encodedValue: ['weapon', this.actor.type, weapon.name].join(this.delimiter),
                        info1: {class: "hud-info", text: generateDiamonds(proficiency.value)},
                        info2: {class: "hud-info", text: damage},
                        info3: {class: "hud-info", text: injury + (proficiency?.favoured?.value ?
                                '  ' + coreModule.api.Utils.i18n(proficiency?.favoured?.label) : '')},
                    };

                    this.addActions([action], this.GROUP.weapons)
                })
            }
        }
        async _loadArmours() {
            if(this.actor.type === 'character') {
                const armours = Array.from(this.actor.items.filter(e => e.type === 'armour'))
                armours.filter(a => a?.system?.equipped?.value).forEach(armour => {
                    let equipped = armour?.system?.equipped?.value ? coreModule.api.Utils.i18n('tor2e.items.common.equipped') : '';
                    let dropped = armour?.system?.dropped?.value ? coreModule.api.Utils.i18n('tor2e.items.common.dropped') : '';
                    let protection = armour?.system?.protection?.value;
                    if (armour.system.group.value === 'head') {
                        protection += 'D';
                    }
                    this.addActions([{
                        id: armour.id,
                        name: armour.name,
                        cssClass: "armour",
                        img: armour.img,
                        description: armour.name,
                        encodedValue: ['armour', 'character', armour.name].join(this.delimiter),
                        info1: {text: protection},
                    }], this.GROUP.armours)
                })
            }
        }
        async _loadCombatProficiencies() {
            if(this.actor.type === 'character') {
                const proficiencies = this.actor.extendedData?.getCombatProficiencies();
                proficiencies.keys().forEach(p => {
                    const proficiency = proficiencies.get(p);
                    const name = coreModule.api.Utils.i18n(proficiency.label);
                    this.addActions([{
                        id: p,
                        name: name,
                        img: proficiency.icon,
                        description: name,
                        encodedValue: ['proficiency', 'character', p].join(this.delimiter),
                        info1: {text: generateDiamonds(proficiency.value)},
                    }], this.GROUP.combatProficiences)
                })
            }
        }
        async _loadCombatAttributes() {
            if(this.actor.type === 'character') {
                Object.keys(this.actor.system.combatAttributes).forEach(p => {
                    const proficiency = this.actor.system.combatAttributes[p];
                    let name = '';
                    let value = '';
                    let bonus = '';
                    let image = '';
                    if (p === 'parry') {
                        name = coreModule.api.Utils.i18n(proficiency.label);
                        value = (this.actor.extendedData.getParryBonus() || 0);
                        const shield = this.actor.items.filter(e => e.type === 'armour' && e.system.group.value === 'shield');
                        bonus = '+' + (shield.length > 0 ? shield[0].system.protection.value : 0);
                        image = 'systems/tor2e/assets/images/icons/armour.png';
                    } else if (p === 'armour') {
                        name = coreModule.api.Utils.i18n('tor2e.rolls.protection');
                        value = (this.actor.extendedData?.getArmourProtectionValue() || 0) + 'D';
                        bonus = (this.actor.extendedData?.getHeadGearProtectionValue() || 0) + 'D';
                        image = 'systems/tor2e/assets/images/icons/armour.png';
                    } else {
                        return;
                    }
                    this.addActions([{
                        id: p,
                        name: name,
                        img: image,
                        description: name,
                        encodedValue: ['combatAttribute', 'character', p].join(this.delimiter),
                        info1: {text: '' + value},
                        info2: {text: '' + bonus},
                    }], this.GROUP.combatAttributes)
                })
            } else if (this.actor.type === 'adversary') {
                const combatAttributes = ["parry", "armour"];
                Object.values(combatAttributes).forEach(p => {
                    const proficiency = this.actor.system?.parry;
                    let name = '';
                    let value = '';
                    let bonus = '';
                    let image = '';
                    if (p === 'parry') {
                        name = coreModule.api.Utils.i18n(proficiency.label);
                        value = (this.actor.extendedData.getParryBonus() || 0);
                        const shield = this.actor.items.filter(e => e.type === 'armour' && e.system.group.value === 'shield');
                        bonus = '+' + (shield.length > 0 ? shield[0].system.protection.value : 0);
                        image = 'systems/tor2e/assets/images/icons/armour.png';
                    } else if (p === 'armour') {
                        name = coreModule.api.Utils.i18n('tor2e.rolls.protection');
                        value = (this.actor.extendedData?.getArmourProtectionValue() || 0) + 'D';
                        bonus = (this.actor.extendedData?.getHeadGearProtectionValue() || 0) + 'D';
                        image = 'systems/tor2e/assets/images/icons/armour.png';
                    } else {
                        return;
                    }
                    this.addActions([{
                        id: p,
                        name: name,
                        img: image,
                        description: name,
                        encodedValue: ['combatAttribute', 'adversary', p].join(this.delimiter),
                        info1: {text: '' + value},
                        info2: {text: '' + bonus},
                    }], this.GROUP.combatAttributes)
                })
            }
        }

        async _loadTraits() {
            await this._loadItemsByType('trait', 'distinctiveFeature', this.GROUP.features);
            await this._loadItemsByType('trait', 'flaw', this.GROUP.flaws);
            await this._loadItemsByType('virtues', null, this.GROUP.virtues);
            await this._loadItemsByType('reward', null, this.GROUP.rewards);
            await this._loadItemsByType('fell-ability', null, this.GROUP.fell);
        }
        async _loadItemsByType(type, subType, group) {
            const items = this.actor.items.filter(e => e.type === type && (!subType || e?.system?.group?.value === subType));
            items.forEach( item => {
                let description = item.system.description.value;
                this.addActions([{
                    id: item.id,
                    name: item.name,
                    img: item.img,
                    tooltip: description,
                    encodedValue: ['traits', this.actor.type, subType || type, item.id].join(this.delimiter),
                    info1: {class: "hud-info", text: '' + (this.actor.type === 'adversary' && type === 'fell-ability' ? item?.system?.cost?.value : '')}
                }], group)
            })
        }

        async _loadMiscellaneous() {
            await this._loadEquipment();
            await this._loadRest();
            await this._loadOccupation();

            if (game.user.isGM || game.settings.get("token-action-hud-tor2e", "displayPlayerHealthEvents")) {
                await this._loadHealth();
            }
            if (game.user.isGM || game.settings.get("token-action-hud-tor2e", "displayPlayerEffects")) {
                await this._loadEffects();
            }
        }
        async _loadEquipment() {
            if(this.actor.type === 'character') {
                const equipment = this.actor.items.filter(e => e.type === 'miscellaneous');
                equipment.forEach( item => {
                    let description = item.system.description.value;
                    this.addActions([{
                        id: item.id,
                        cssClass: "equipment",
                        name: item.name,
                        img: item.img,
                        tooltip: description,
                        encodedValue: ['miscellaneous','character', 'equipment', item.id].join(this.delimiter),
                    }], this.GROUP.equipment)
                })
            }
        }
        async _loadRest() {
            if (this.actor.type === 'character') {
                this.addActions([
                    {
                        id: 'shortRest',
                        cssClass: "rest",
                        img: 'systems/tor2e/assets/images/icons/rest/campfire.svg',
                        name: coreModule.api.Utils.i18n('tor2e.sheet.actions.rest.short.label'),
                        encodedValue: ['rest', 'character', 'short'].join(this.delimiter),
                    },
                    {
                        id: 'longRest',
                        cssClass: "rest",
                        img: 'systems/tor2e/assets/images/icons/rest/person-in-bed.svg',
                        name: coreModule.api.Utils.i18n('tor2e.sheet.actions.rest.prolonged.label'),
                        encodedValue: ['rest', 'character', 'prolonged'].join(this.delimiter),
                    }], this.GROUP.rest);
            }
        }
        async _loadHealth() {
            if (['character', 'adversary', 'lore', 'npc'].includes(this.actor.type)) {
                const activeEffects = this.actor.effects.map(e => [...e?.statuses][0]);
                const availableStatuses = ['weary', 'wounded', 'poisoned'];
                if (this.actor.type === 'character') {
                    availableStatuses.push('miserable');
                }

                availableStatuses.forEach(s => {
                    const active = activeEffects.includes(s);
                    const tooltip = coreModule.api.Utils.i18n("tokenActionHud.tor2e.health.status." + s);
                    this.addActions([{
                        id: s,
                        cssClass: active ? "stateOfHealth active" : "stateOfHealth",
                        img: 'systems/tor2e/assets/images/icons/effects/' + s + '.svg',
                        name: coreModule.api.Utils.i18n('tor2e.actors.stateOfHealth.' + s),
                        tooltip: tooltip,
                        encodedValue: ['health', this.actor.type, s].join(this.delimiter),
                    }], this.GROUP.health);
                });
            }
        }
        async _loadEffects() {
            if (['character', 'adversary', 'lore', 'npc'].includes(this.actor.type)) {
                const activeEffects = this.actor.effects.map(e => [...e?.statuses][0]);
                const activeTargets = getTargetedTokens();
                const allowedEffects = ["dead", "unconscious", "invisible"/*, "target"*/];
                const effects = CONFIG.statusEffects.filter(e => allowedEffects.includes(e.id));

                const actions = [];
                effects.forEach(effect => {
                    const active = (effect === 'target' && activeTargets?.includes(this.token.id)) || activeEffects?.includes(effect.id);
                    actions.push({
                        id: effect.id,
                        cssClass: active ? "effects active" : "effects",
                        name: coreModule.api.Utils.i18n(effect.name),
                        img: effect.img,
                        encodedValue: ['effect', this.actor.type, effect.id].join(this.delimiter),
                    });
                })
                this.addActions(actions, this.GROUP.effects);
            }
        }

        async _loadOccupation() {
            if (['lore', 'npc'].includes(this.actor.type)) {
                const occupation = this.actor?.system?.occupation?.value;
                this.addActions([{
                    id: occupation,
                    cssClass: "occupation",
                    name: occupation,
                    img: "systems/tor2e/assets/images/icons/actors/npc.webp",
                    encodedValue: ['occupation', this.actor.type, occupation].join(this.delimiter),
                }], this.GROUP.occupation);
            }
        }

        async _loadStances() {
            if (this.actor.type === 'character') {
                if (this?.actor?.inCombat) {
                    const stances = this.token?.combatant ? Tor2eTokenHudExtension._buildStances(this.token?.combatant)?.stances : [];
                    stances.forEach(s => {
                        const bonusLabel = 'tokenActionHud.' +  s?.stance?.title?.replace(".label", ".bonus");
                        const taskLabel = 'tokenActionHud.' +  s?.stance?.title?.replace(".label", ".task");
                        const tooltip = coreModule.api.Utils.i18n(bonusLabel);

                        this.addActions([{
                            id: s?.stance?.class,
                            cssClass: s?.isActive ? "stance active" : "stance",
                            img: s?.stance?.logo,
                            name: coreModule.api.Utils.i18n(s?.stance?.title),
                            tooltip: tooltip,
                            encodedValue: ['stance','character', s.stance.class].join(this.delimiter),
                            info1: {class: "hud-info", text: coreModule.api.Utils.i18n(taskLabel)}
                        }], this.GROUP.stances);
                    });
                }
            }
        }

        async _loadCommunity() {
            const defaultCommunity = game.settings.get("tor2e", "communityCurrentActor");
            const community = game?.actors?.filter(a => a.type === "community" && a.id === defaultCommunity)?.[0];
            const members = community.system.members;
            const memberIds = members.filter(p => p?.id === this.actor?.id);
            if (memberIds <= 0) {
                return;
            }

            await this._loadTravel(community);
            await this._loadFellowship(community);
        }
        async _loadTravel(community) {
            if (this.actor.type === 'character') {
                const travel = community.system.travel;
                const labels = {
                    "hunters": "hunting",
                    "guide": "travel",
                    "scouts": "explore",
                    "lookouts": "awareness",
                };
                Object.keys(travel).forEach(role => {
                    const players = role === 'guide' ? [travel[role]] : travel[role];
                    const playerNames = players.map(p => p?.name).join(', ');
                    const playerIds = players.map(p => p?.id);
                    const skill = coreModule.api.Utils.i18n('tor2e.travel.roles.' + role + '.skill');
                    const active = playerIds.includes(this.actor.id);
                    this.addActions([{
                        id: role,
                        cssClass: active ? "travelRole active" : "travelRole",
                        img: 'systems/tor2e/assets/images/icons/skills/skill-' + labels[role] + '.webp',
                        name: coreModule.api.Utils.i18n('tor2e.travel.roles.' + role + '.label'),
                        encodedValue: ['community','character', 'travel', role].join(this.delimiter),
                        info1: { class: "hud-info", text:  skill},
                        info2: { class: "hud-info", text:  playerNames},
                    }], this.GROUP.travel);
                });
            }
        }

        async _loadFellowship(community) {
            if (this.actor.type === 'character') {
                const fellowship = community.system.fellowshipPoints;
                const maxLabel = capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.actors.stats.max'));
                this.addActions([{
                    id: 'fellowshipPoints',
                    img: 'systems/tor2e/assets/images/icons/fellowship.webp',
                    name: coreModule.api.Utils.i18n(fellowship?.label),
                    encodedValue: ['community','character', 'fellowshipPoints'].join(this.delimiter),
                    info1: { class: "hud-info", text:  "" + fellowship?.value},
                    info2: { class: "hud-info", text:  maxLabel + " " + fellowship?.max},
                }], this.GROUP.fellowship);
            }
        }

        extractSkillId(url) {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            const skillPart = filename.split('.')[0];
            return skillPart.split('-')[1];
        }
    }
})