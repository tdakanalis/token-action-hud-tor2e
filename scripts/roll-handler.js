import {STATS} from "./constants.js";
import {tor2eUtilities} from "/systems/tor2e/modules/utilities.js";
import {getControlledTokens, getSetting, getTargetedTokens} from "./utils.js";

export let TOR2ERollHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's RollHandler class and handles action events triggered when an action is clicked.
    TOR2ERollHandler = class TOR2ERollHandler extends coreModule.api.RollHandler {
        
        async handleActionClick(event, encodedValue) {
            const decoded = encodedValue.split("|");

            console.debug(encodedValue);

            let typeAction = decoded[0]
            let typeActor = decoded[1]
            let macroType = decoded[2]
            let macroSubType = ''

            if(decoded.length > 3) {
                macroSubType = decoded[3]
            }

            if (this.isRightClick) {
                this._showItem(macroSubType);
                return;
            }

            if (this.isAlt || this.isCtrl || this.isShift) {
                if (typeActor === 'character' && (typeAction === "armour" || typeAction === "weapon")) {
                    const equipped = "system.equipped.value";
                    const dropped =  "system.dropped.value";
                    if (this.isAlt) {
                        await this._setItemStatus(macroSubType, equipped, false, dropped, false)
                        return;
                    } else if (this.isCtrl) {
                        await this._setItemStatus(macroSubType, equipped, true, dropped, false)
                        return;
                    } else if (this.isShift) {
                        await this._setItemStatus(macroSubType, dropped, true, equipped, false)
                        return;
                    }
                }
                return;
            }

            switch(typeAction) {
                case 'skill':
                    await this._rollSkill(typeActor, macroType, macroSubType)
                    break;
                case 'stature':
                    await this._rollStature(typeActor, macroType)
                    break;
                case 'proficiency':
                    await this._rollProficiency(typeActor, macroType)
                    break;
                case 'combatAttribute':
                    await this._rollSpecial(typeActor, macroType, macroSubType)
                    break;
                case 'weapon':
                    await this._useWeapon(typeActor, macroType, macroSubType)
                    break;
                case 'health':
                    await this._setHealthStatus(typeActor, macroType)
                    break;
                case 'effect':
                    await this._setEffect(typeActor, macroType)
                    break;
                case 'toggleTarget':
                    await this._toggleTarget()
                    break;
                case 'rest':
                    await this._performRest(typeActor, macroType, event)
                    break;
                case 'stance':
                    await this._setStance(typeActor, macroType)
                    break;
                case 'multiple':
                    await this._handleMultipleTokens(macroType)
                    break;
            }
        }

        async _handleMultipleTokens(typeAction) {
            switch(typeAction) {
                case 'toggleCombat':
                    await this._toggleCombat();
                    break;
                case 'unconscious':
                case 'dead':
                case 'invisible':
                    await this._toggleEffect(typeAction);
                    break;
                case 'weary':
                case 'poisoned':
                case 'wounded':
                    await this._toggleHealthStatus(typeAction);
                    break;
            }
        }

        async _showItem(itemId) {
            if (this.isRenderItem()) {
                await this.renderItem(this.actor, itemId)
            }
        }

        async _rollStature(typeActor, attr) {
            if(typeActor === 'character') {
                if (STATS.STATURE.includes(attr)) {
                    await game.tor2e.macro.utility.rollHeroicStatureMacro(coreModule.api.Utils.i18n('tor2e.statureStats.' + attr));
                }
            }
        }

        async _rollProficiency(typeActor, proficiency) {
            if(typeActor === 'character') {
                function getProficiencyFrom(_skillId, actor = game.tor2e.macro.utility._getActorFrom({})) {
                    let skills = actor.extendedData?.getCombatProficiencies();
                    let skill =  skills.values().find(s => game.i18n.localize(s.label) === _skillId)
                    skill.favoured = {value: false};
                    return skill;
                }
                await game.tor2e.macro.utility._executeSkillMacro(this.actor,
                    coreModule.api.Utils.i18n('tor2e.combatProficiencies.' + proficiency), true, getProficiencyFrom, 0)
            }
        }

        async _performRest(typeActor, restType, event) {
            if(typeActor === 'character') {
                tor2eUtilities.eventsProcessing.actor = this.actor;
                if (restType === 'short') {
                    await tor2eUtilities.eventsProcessing.onShortRest({}, event);
                } else {
                    await tor2eUtilities.eventsProcessing.onProlongedRest({}, event);
                }
            }
        }

        async _setHealthStatus(typeActor, status) {
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                await this.actor.toggleStatusEffectById(status);
            }
        }

        async _setEffect(typeActor, effect) {
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                const condition = CONFIG.statusEffects.find(e => e.id === effect);
                const overlay = getSetting("addOverlayOnEffects");
                await this.actor.toggleStatusEffect(condition.id, {overlay: overlay});
            }
        }

        async _setStance(typeActor, stanceClass) {
            if(typeActor === 'character') {
                await game.tor2e.macro.utility.setPlayerStance({stanceClass: stanceClass, onlyLoremaster: false})
            }
        }

        async _rollSkill(typeActor, attr, skill) {
            if(typeActor === 'character') {
                game.tor2e.macro.utility.rollSkillMacro(coreModule.api.Utils.i18n('tor2e.commonSkills.' + skill));
            } else if(typeActor === 'npc') {
                function getSkillFrom(_skillId, actor = game.tor2e.macro.utility._getActorFrom({})) {
                    const skill = actor?.items.filter(i => i.type === 'skill').find(i => i.name === _skillId);
                    skill.favoured = skill?.system?.favoured;
                    skill.label = skill?.name;
                    skill.value = skill.system?.value;
                    return skill;
                }
                await game.tor2e.macro.utility._executeSkillMacro(this.actor, skill, true, getSkillFrom, 0)
            }
        }

        async _rollSpecial(typeActor, special) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                if (special === 'armour') {
                    await game.tor2e.macro.utility.rollSpecialSkillMacro("Protection");
                }
            }
        }

        async _useWeapon(typeActor, weapon, itemId) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                const item = coreModule.api.Utils.getItem(this.actor, itemId);
                if(item?.system?.equipped.value){
                    await game.tor2e.macro.utility.rollItemMacro(weapon, "weapon");
                }
            }
        }

        async _toggleTarget() {
            const target = this.token;
            if (!target) {
                return;
            }

            // Check if the current user is already targeting this token
            const targets = getTargetedTokens();
            const isTargeted = targets.has(this.token.id);

            // Toggle the target state
            if (isTargeted) {
                await target.setTarget(false);
            } else {
                await target.setTarget(true, { releaseOthers: true });
            }
        }

        async _toggleCombat() {
            const tokens = getControlledTokens();
            for (const token of tokens) {
                await token.document.toggleCombatant();
            }
        }

        async _toggleEffect(effect) {
            for (const actor of this.actors) {
                const condition = CONFIG.statusEffects.find(e => e.id === effect);
                const overlay = getSetting("addOverlayOnEffects");
                await actor.toggleStatusEffect(condition.id, {overlay: overlay});
            }
        }

        async _toggleHealthStatus(status) {
            for (const actor of this.actors) {
                await actor.toggleStatusEffectById(status);
            }
        }

        async _setItemStatus(itemId, primaryAttribute, primaryValue, secondaryAttribute, secondaryValue) {
            const item = coreModule.api.Utils.getItem(this.actor, itemId);
            await item.update({[secondaryAttribute]: secondaryValue});
            this.actor.toggleItemActiveEffect(itemId, primaryValue);
            await item.update({[primaryAttribute]: primaryValue});
        }
    }
})