import {STATS} from "./constants.js";
import {tor2eUtilities} from "/systems/tor2e/modules/utilities.js";
import {getTargetedTokens} from "./utils.js";

export let TOR2ERollHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's RollHandler class and handles action events triggered when an action is clicked.
    TOR2ERollHandler = class TOR2ERollHandler extends coreModule.api.RollHandler {
        
        async handleActionClick(event, encodedValue) {
            const decoded = encodedValue.split("|");

            console.debug(event, encodedValue);

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

            switch(typeAction) {
                case 'armour':
                    this._showItem(typeActor, macroType, macroSubType);
                    break;
                case 'skill':
                    this._rollSkill(typeActor, macroType, macroSubType)
                    break;
                case 'stature':
                    this._rollStature(typeActor, macroType)
                    break;
                case 'proficiency':
                    this._rollProficiency(typeActor, macroType)
                    break;
                case 'combatAttribute':
                    this._rollSpecial(typeActor, macroType, macroSubType)
                    break;
                case 'weapon':
                    this._useWeapon(typeActor, macroType, macroSubType)
                    break;
                case 'health':
                    this._setHealthStatus(typeActor, macroType)
                    break;
                case 'effect':
                    await this._setEffect(typeActor, macroType)
                    break;
                case 'target':
                    await this._toggleTokenTarget()
                    break;
                case 'rest':
                    this._performRest(typeActor, macroType, event)
                    break;
                case 'stance':
                    await this._setStance(typeActor, macroType)
                    break;
            }
        }

        _showItem(itemId) {
            if (this.isRenderItem()) {
                this.renderItem(this.actor, itemId)
            }
        }

        _rollStature(typeActor, attr) {
            if(typeActor === 'character') {
                if (STATS.STATURE.includes(attr)) {
                    game.tor2e.macro.utility.rollHeroicStatureMacro(coreModule.api.Utils.i18n('tor2e.statureStats.' + attr));
                }
            }
        }

        _rollProficiency(typeActor, proficiency) {
            if(typeActor === 'character') {
                function getProficiencyFrom(_skillId, actor = game.tor2e.macro.utility._getActorFrom({})) {
                    let skills = actor.extendedData?.getCombatProficiencies();
                    let skill =  skills.values().find(s => game.i18n.localize(s.label) === _skillId)
                    skill.favoured = {value: false};
                    return skill;
                }
                game.tor2e.macro.utility._executeSkillMacro(this.actor,
                    coreModule.api.Utils.i18n('tor2e.combatProficiencies.' + proficiency), true, getProficiencyFrom, 0)
            }
        }

        _performRest(typeActor, restType, event) {
            if(typeActor === 'character') {
                tor2eUtilities.eventsProcessing.actor = this.actor;
                if (restType === 'short') {
                    tor2eUtilities.eventsProcessing.onShortRest({}, event);
                } else {
                    tor2eUtilities.eventsProcessing.onProlongedRest({}, event);
                }
            }
        }

        _setHealthStatus(typeActor, status) {
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                this.actor.toggleStatusEffectById(status);
            }
        }

        async _setEffect(typeActor, effect) {
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                if (effect === 'target') {
                    this._toggleTokenTarget();
                } else {
                    const condition = CONFIG.statusEffects.find(e => e.id === effect);
                    const overlay = game.settings.get("token-action-hud-tor2e", "addOverlayOnEffects");
                    await this.actor.toggleStatusEffect(condition.id, {overlay: overlay});
                }
            }
        }

        async _setStance(typeActor, stanceClass) {
            if(typeActor === 'character') {
                game.tor2e.macro.utility.setPlayerStance({stanceClass: stanceClass, onlyLoremaster: false})
            }
        }

        _rollSkill(typeActor, attr, skill) {
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
                game.tor2e.macro.utility._executeSkillMacro(this.actor, skill, true, getSkillFrom, 0)
            }
        }

        _rollSpecial(typeActor, special) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                if (special === 'armour') {
                    game.tor2e.macro.utility.rollSpecialSkillMacro("Protection");
                }
            }
        }

        _useWeapon(typeActor, weapon) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                game.tor2e.macro.utility.rollItemMacro(weapon, "weapon");
            }
        }

        _toggleTokenTarget() {
            const target = this.token;
            if (!target) {
                return;
            }

            // Check if the current user is already targeting this token
            const targets = getTargetedTokens();
            const isTargeted = targets.has(this.token.id);

            // Toggle the target state
            if (isTargeted) {
                target.setTarget(false);
            } else {
                target.setTarget(true, { releaseOthers: true });
            }
        }
    }
})