import {
    canSeeEyeAwareness,
    capitalizeFirstLetter,
    generateDiamonds,
    getActiveStatusIds,
    getControlledTokens,
    getImage,
    getTargetedTokens,
    isAllowedForUser
} from "./utils.js";
import {getGroup, SKILLS} from "./constants.js";
import {canView, communityFor, label, loadFeatures} from './features.js';

import {Tor2eTokenHudExtension} from "/systems/tor2e/modules/hud/Tor2eTokenHudExtension.js";

export let TOR2EActionHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's ActionHandler class and builds system-defined actions for the HUD.
    TOR2EActionHandler = class TOR2EActionHandler extends coreModule.api.ActionHandler {

        addActions(actions, group) {
            const contextMenus = Number(game.modules.get('token-action-hud-core')?.version?.split('.')[1] ?? 0) >= 1;
            return super.addActions(actions.map(action => {
                const [type, command, id] = action.encodedValue?.split(this.delimiter) ?? [];
                const ordinaryMenu = ['weapon', 'armour', 'skill', 'song', 'traits', 'miscellaneous', 'health', 'effect'].includes(type)
                    || (type === 'proficiency' && id !== 'brawling');
                const documentMenu = type === 'hud' && (command === 'task' || command === 'roleRoll'
                    || (command === 'sheet' && (id?.includes('.Item.') || id?.startsWith('Item.') || id?.includes('.ActiveEffect.'))));
                const hasContextMenu = contextMenus && (ordinaryMenu || documentMenu);
                const hint = ['skill', 'weapon', 'stature', 'proficiency', 'combatAttribute'].includes(type)
                    ? label('actions.rollHint') : ['resource', 'attribute', 'advancement'].includes(type)
                        ? label('actions.resourceHint') : undefined;
                const info = Object.fromEntries(['info1', 'info2', 'info3'].map(key => [key,
                    action[key] && typeof action[key].text === 'number' ? {...action[key], text: String(action[key].text)} : action[key]
                ]));
                return {...action,
                    ...info,
                    tooltip: action.tooltip || hint,
                    cssClass: `tor2e-action ${action.cssClass ?? ''}`,
                    info1: ['skill', 'proficiency'].includes(type) ? {...info.info1, title: label('actions.rankHint')} : info.info1,
                    hasContextMenu
                };
            }), group);
        }

        /** @override */
        async buildSystemActions(groupIds) {
            this.GROUP = getGroup(coreModule);

            if (this.actor && (game.user.isGM || this.actor.isOwner)) {
                await this._loadStats();
                await this._loadSkills();
                await this._loadCombat();
                await this._loadTraits();
                await this._loadMiscellaneous();
                await this._loadCommunity();
            } else if (this.actor?.type === 'community' && canView(this.actor)) {
                await this._loadCommunity();
            } else if (!this.actor) {
                await this._loadCombatUtils();
                if (game.user.isGM) {
                    await this._loadHealthStatusesForMultiple();
                    await this._loadEffectsForMultiple();
                }
            }
            if (!this.actor || game.user.isGM || canView(this.actor)) await loadFeatures(this);
            await this._loadMacros();
        }

        async _loadMacros() {
            const macros = game.macros.filter(macro => macro.canExecute);

            for (const macro of macros) {
                const group = {
                    id: 'macros_' + (macro?.folder?.name ?? 'macros'),
                    name: macro?.folder?.name ?? 'macros'
                }

                this.addGroup(group, {id: this.GROUP.macros.id}, true);

                this.addActions([{
                    id: 'tor2e_' + macro.id,
                    name: macro.name,
                    img: getImage(macro),
                    encodedValue: ['macro', 'all', macro.id].join(this.delimiter),
                }], group);
            }
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
                const might = this.actor.system?.might?.value ?? 0;
                const maxMight = this.actor.system?.might?.max ?? 0;

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
                        value = "" + (Number(attribute.shadowScars?.value ?? 0)
                            + Number(attribute.temporary?.value ?? 0) + Number(attribute.taint?.value ?? 0));
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
                // The model always labels this stat "hate"; the system picks Hate vs
                // Resolve from isHateMode at display time, so mirror that here.
                const mentalLabel = this.actor.system?.isHateMode?.value === false
                    ? 'tor2e.actors.stats.resolve'
                    : (hate?.label ?? 'tor2e.actors.stats.hate');

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
                        name: coreModule.api.Utils.i18n(mentalLabel),
                        description: coreModule.api.Utils.i18n(mentalLabel),
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
                        .map(s => [s.id, s])
                );
                Array.from(availableSkills.keys()).forEach( el => {
                    const skill = availableSkills.get(el);
                    const group = skill?.system?.associatedStat?.value && this.GROUP[skill.system.associatedStat.value] ?
                        this.GROUP[skill.system.associatedStat.value] : this.GROUP.skills;
                    const isFavoured = skill.system.favoured.value;

                    const action = {
                        id: el,
                        img: skill.img,
                        name: skill.name,
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
            await this._loadWeapons("unequipped");
            await this._loadArmours("unequipped");
            await this._loadWeapons("dropped");
            await this._loadArmours("dropped");
            await this._loadCombatUtils();
            await this._loadCombatProficiencies();
            await this._loadCombatAttributes();
            await this._loadStances();
        }
        async _loadWeapons(mode = "equipped") {
            if(this.actor.type === 'character' || this.actor.type === 'adversary') {
                const weapons = Array.from(this.actor.items.filter(e => e.type === 'weapon'))
                let proficiencies = null;
                if (this.actor.type === 'character') {
                    proficiencies = this.actor.extendedData?.getCombatProficiencies();
                }
                const group = mode === "equipped" ? this.GROUP.weapons : mode === "dropped" ? this.GROUP.dropped : this.GROUP.unequipped;
                weapons.filter(w => (mode === "equipped" && w?.system?.equipped?.value) || (mode === "unequipped" && !w?.system?.equipped?.value && !w?.system?.dropped?.value) || (mode === "dropped" && w?.system?.dropped?.value)).forEach(weapon => {
                    let damage = weapon?.system?.damage?.value;
                    let injury = weapon?.system?.injury?.value;
                    const proficiency = proficiencies ? proficiencies.get(weapon?.system?.group?.value) : weapon?.system?.skill;
                    const action = {
                        id: weapon.id,
                        cssClass: "weapon",
                        name: weapon.name,
                        img: weapon.img,
                        tooltip: weapon?.system?.description?.value,
                        encodedValue: ['weapon', this.actor.type, '', weapon.id].join(this.delimiter),
                        info1: {class: "hud-info", text: generateDiamonds(proficiency?.value ?? 0)},
                        info2: {class: "hud-info", text: label('stats.damage') + ' ' + damage},
                        info3: {class: "hud-info", text: label('stats.injury') + ' ' + injury + (proficiency?.favoured?.value ?
                                '  ' + coreModule.api.Utils.i18n(proficiency?.favoured?.label) : '')},
                    };

                    this.addActions([action], group)
                })
            }
        }
        async _loadArmours(mode = "equipped") {
            if(this.actor.type === 'character') {
                const armours = Array.from(this.actor.items.filter(e => e.type === 'armour'));
                const group = mode === "equipped" ? this.GROUP.armours : mode === "dropped" ? this.GROUP.dropped : this.GROUP.unequipped;
                armours.filter(w => (mode === "equipped" && w?.system?.equipped?.value) || (mode === "unequipped" && !w?.system?.equipped?.value && !w?.system?.dropped?.value) || (mode === "dropped" && w?.system?.dropped?.value)).forEach(armour => {
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
                        encodedValue: ['armour', 'character', '', armour.id].join(this.delimiter),
                        info1: {text: protection},
                    }], group)
                })
            }
        }
        async _loadCombatProficiencies() {
            if(this.actor.type === 'character') {
                const proficiencies = this.actor.extendedData?.getCombatProficiencies() ?? new Map();
                for (const [p, proficiency] of proficiencies) {
                    const name = coreModule.api.Utils.i18n(proficiency.label);
                    this.addActions([{
                        id: p,
                        name: name,
                        img: proficiency.icon,
                        description: name,
                        encodedValue: ['proficiency', 'character', p].join(this.delimiter),
                        info1: {text: generateDiamonds(proficiency.value)},
                    }], this.GROUP.combatProficiences)
                }
            }
        }
        async _loadCombatAttributes() {
            const actorType = this.actor.type;
            if (actorType !== 'character' && actorType !== 'adversary') {
                return;
            }

            // Characters hold these under system.combatAttributes alongside entries the
            // HUD does not render; adversaries keep parry at the top level instead.
            const attributes = actorType === 'character'
                ? Object.keys(this.actor.system?.combatAttributes ?? {}).filter(p => p === 'parry' || p === 'armour')
                : ['parry', 'armour'];
            const parrySource = actorType === 'character'
                ? this.actor.system?.combatAttributes?.parry
                : this.actor.system?.parry;
            const image = 'systems/tor2e/assets/images/icons/armour.png';

            attributes.forEach(p => {
                let name;
                let value;
                let bonus;

                if (p === 'parry') {
                    const shield = this.actor.extendedData?.getShieldUsed?.();
                    name = coreModule.api.Utils.i18n(parrySource?.label);
                    value = (this.actor.extendedData?.getParryBonus() || 0);
                    bonus = '+' + (shield?.system?.protection?.value ?? 0);
                } else {
                    name = coreModule.api.Utils.i18n('tor2e.rolls.protection');
                    value = (this.actor.extendedData?.getArmourProtectionValue() || 0) + 'D';
                    bonus = (this.actor.extendedData?.getHeadGearProtectionValue() || 0) + 'D';
                }

                this.addActions([{
                    id: p,
                    name: name,
                    img: image,
                    description: name,
                    encodedValue: ['combatAttribute', actorType, p].join(this.delimiter),
                    info1: {text: '' + value},
                    info2: {text: '' + bonus},
                }], this.GROUP.combatAttributes)
            });
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
                const fellAbility = type === 'fell-ability';
                this.addActions([{
                    id: item.id,
                    name: item.name,
                    img: item.img,
                    tooltip: description,
                    cssClass: fellAbility ? `toggle ${item.system.active?.value ? 'active' : ''}` : '',
                    encodedValue: ['traits', this.actor.type, subType || type, item.id].join(this.delimiter),
                    info1: {class: "hud-info", text: fellAbility ? label('stats.cost') + ' ' + (item.system.cost?.value ?? 0) : ''},
                    info2: {text: fellAbility ? label(item.system.active?.value ? 'states.active' : 'states.inactive') : ''}
                }], group)
            })
        }

        async _loadMiscellaneous() {
            await this._loadEquipment();
            await this._loadRest();
            await this._loadOccupation();

            if (isAllowedForUser("displayPlayerHealthEvents")) {
                await this._loadHealth();
            }
            if (isAllowedForUser("displayPlayerEffects")) {
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
        _getHealthStatuses(actors) {
            const statuses = ['weary', 'wounded', 'poisoned'];
            if (actors.some(actor => actor?.type === 'character')) {
                statuses.push('miserable', 'daunted');
            }
            return statuses;
        }

        _buildHealthStatusAction(status, active, encodedValue) {
            // Resolve icon and name from the system's own registration rather than
            // rebuilding paths: 'daunted' ships as effects/dread.svg and has no
            // tor2e.actors.stateOfHealth key.
            const definition = CONFIG.statusEffects.find(e => e.id === status);
            return {
                id: status,
                cssClass: active ? "stateOfHealth toggle active" : "stateOfHealth toggle",
                img: definition?.img ?? ('systems/tor2e/assets/images/icons/effects/' + status + '.svg'),
                name: coreModule.api.Utils.i18n(definition?.label ?? ('tor2e.actors.stateOfHealth.' + status)),
                tooltip: coreModule.api.Utils.i18n("tokenActionHud.tor2e.health.status." + status),
                encodedValue: encodedValue,
            };
        }

        async _loadHealth() {
            if (['character', 'adversary', 'lore', 'npc'].includes(this.actor.type)) {
                const activeEffects = getActiveStatusIds(this.actor);
                this._getHealthStatuses([this.actor]).forEach(s => {
                    this.addActions([
                        this._buildHealthStatusAction(s, activeEffects.includes(s),
                            ['health', this.actor.type, s].join(this.delimiter))
                    ], this.GROUP.health);
                });
            }
        }
        async _loadEffects() {
            if (['character', 'adversary', 'lore', 'npc'].includes(this.actor.type)) {
                const activeEffects = getActiveStatusIds(this.actor);
                const allowedEffects = ["dead", "unconscious", "invisible"];
                const effects = CONFIG.statusEffects.filter(e => allowedEffects.includes(e.id));

                const actions = [];
                effects.forEach(effect => {
                    const active = activeEffects?.includes(effect.id);
                    actions.push({
                        id: effect.id,
                        cssClass: active ? "effects toggle active" : "effects toggle",
                        name: coreModule.api.Utils.i18n(effect.label ?? effect.name),
                        img: effect.img ?? effect.icon,
                        encodedValue: ['effect', this.actor.type, effect.id].join(this.delimiter),
                    });
                })
                this.addActions(actions, this.GROUP.effects);
            }
        }

        async _loadOccupation() {
            if (['lore', 'npc'].includes(this.actor.type)) {
                const occupation = this.actor?.system?.occupation?.value;
                if (!occupation) return;
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
                    const combatant = this.token?.document?.findCombat?.()?.combatant ?? this.token?.combatant;
                    const stances = combatant ? (Tor2eTokenHudExtension._buildStances(combatant)?.stances ?? []) : [];
                    stances.forEach(s => {
                        const bonusLabel = 'tokenActionHud.' +  s?.stance?.title?.replace(".label", ".bonus");
                        const taskLabel = 'tokenActionHud.' +  s?.stance?.title?.replace(".label", ".task");
                        const tooltip = coreModule.api.Utils.i18n(bonusLabel);

                        this.addActions([{
                            id: s?.stance?.class,
                            cssClass: s?.isActive ? "stance toggle active" : "stance toggle",
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
            const community = communityFor(this.actor);
            if (!community) {
                return;
            }
            await this._loadTravel(community);
            await this._loadFellowship(community);
            await this._loadSongs(community);
            await this._loadEyeAwareness(community);
        }

        async _loadEyeAwareness(community) {
            if (!['character', 'community'].includes(this.actor.type) || !canSeeEyeAwareness()) {
                return;
            }
            const eyeAwareness = community.system?.eyeAwareness;
            if (!eyeAwareness) {
                return;
            }
            const maxLabel = capitalizeFirstLetter(coreModule.api.Utils.i18n('tor2e.actors.stats.max'));
            this.addActions([{
                id: 'eyeAwareness',
                img: 'systems/tor2e/assets/images/icons/shadow-weakness.png',
                name: coreModule.api.Utils.i18n(eyeAwareness?.label),
                // Display-only, like the other community entries: there is no
                // system-side action to roll or advance the Eye.
                encodedValue: ['community', 'character', 'eyeAwareness'].join(this.delimiter),
                info1: { class: "hud-info", text: "" + (eyeAwareness?.value ?? 0) },
                info2: { class: "hud-info", text: maxLabel + " " + (eyeAwareness?.max ?? 0) },
            }], this.GROUP.eyeAwareness);
        }

        async _loadSongs(community) {
            if (!['character', 'community'].includes(this.actor.type)) {
                return;
            }
            const songs = community.items.filter(item => item.type === 'song');
            const actions = songs.map(song => {
                const typeLabel = CONFIG.tor2e?.songGroups?.[song.system?.group?.value];
                const used = song.system?.used?.value === true;
                return {
                    id: song.id,
                    cssClass: used ? "song toggle active" : "song toggle",
                    name: song.name,
                    img: getImage(song, ["systems/tor2e/assets/images/icons/default.webp"]),
                    tooltip: song.isOwner ? song.system?.description?.value : undefined,
                    encodedValue: ['song', this.actor.type, song.id].join(this.delimiter),
                    info1: {class: "hud-info", text: typeLabel ? coreModule.api.Utils.i18n(typeLabel) : ''},
                };
            });
            if (actions.length) this.addActions(actions, this.GROUP.songs);
        }
        async _loadTravel(community) {
            if (this.actor.type === 'character' && !game.settings.get('tor2e', 'soloMode')) {
                const travel = community.system.travel ?? {};
                const labels = {
                    "hunters": "hunting",
                    "guide": "travel",
                    "scouts": "explore",
                    "lookouts": "awareness",
                };
                Object.keys(labels).forEach(role => {
                    const players = role === 'guide' ? [travel[role]] : travel[role] ?? [];
                    const playerNames = players.map(p => p?.name).join(', ');
                    const playerIds = players.map(p => p?.id);
                    const skill = coreModule.api.Utils.i18n('tor2e.commonSkills.' + labels[role]);
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
            if (['character', 'community'].includes(this.actor.type)) {
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

        async _loadCombatUtils() {
            if (!game.user.isGM) {
                return;
            }

            const controlledTokens = getControlledTokens();
            if (!controlledTokens.length) return;
            const toggleCombatId = "toggleCombat";
            const toggleCombatName = controlledTokens.every(token => token.inCombat)
                ? game.i18n.localize("tokenActionHud.tor2e.combat.removeFromCombat")
                : game.i18n.localize("tokenActionHud.tor2e.combat.addToCombat");


            const actions = [{
                id: toggleCombatId,
                name: toggleCombatName,
                img: 'icons/svg/combat.svg',
                encodedValue: ['multiple', 'multiple', toggleCombatId].join(this.delimiter),
            }];

            if (this.actor && this?.actor?.inCombat) {
                const toggleTargetId = "toggleTarget";
                const toggleTargetName =  getTargetedTokens().has(this.token?.id)
                    ? game.i18n.localize("tokenActionHud.tor2e.combat.untargetToken")
                    : game.i18n.localize("tokenActionHud.tor2e.combat.targetToken");

                actions.push({
                    id: toggleTargetId,
                    name: toggleTargetName,
                    img: 'icons/svg/target.svg',
                    encodedValue: [toggleTargetId, this.actor.type].join(this.delimiter),
                });
            }

            this.addActions(actions, this.GROUP.utilities);
        }

        async _loadEffectsForMultiple() {
            const actors = this._getOwnedConditionActors();
            if (!actors.length) return;
            const activeEffects = actors.flatMap(getActiveStatusIds);

            const allowedEffects = ["dead", "unconscious", "invisible"];
            const effects = CONFIG.statusEffects.filter(e => allowedEffects.includes(e.id));

            const actions = [];
            effects.forEach(effect => {
                const active = activeEffects?.includes(effect.id);
                actions.push({
                    id: effect.id,
                    cssClass: active ? "effects toggle active" : "effects toggle",
                    name: coreModule.api.Utils.i18n(effect.label ?? effect.name),
                    img: effect.img ?? effect.icon,
                    encodedValue: ['multiple', 'multiple', effect.id].join(this.delimiter),
                });
            })
            this.addActions(actions, this.GROUP.effects);
        }

        async _loadHealthStatusesForMultiple() {
            const actors = this._getOwnedConditionActors();
            if (!actors.length) return;
            const activeEffects = actors.flatMap(getActiveStatusIds);
            this._getHealthStatuses(actors).forEach(s => {
                this.addActions([
                    this._buildHealthStatusAction(s, activeEffects.includes(s),
                        ['multiple', 'multiple', s].join(this.delimiter))
                ], this.GROUP.health);
            });
        }

        _getOwnedConditionActors() {
            return Array.from(this.actors ?? []).filter(actor =>
                actor.isOwner && ['character', 'adversary', 'npc', 'lore'].includes(actor.type));
        }
    }
})
