import {capitalizeFirstLetter, STATS} from "./constants.js";
import {tor2eUtilities} from "/systems/tor2e/modules/utilities.js";
import {Tor2eStance} from "/systems/tor2e/modules/combat/Tor2eStance.js";

export let TOR2ERollHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's RollHandler class and handles action events triggered when an action is clicked.
    TOR2ERollHandler = class TOR2ERollHandler extends coreModule.api.RollHandler {
        
        async handleActionClick(event, encodedValue) {
            const decoded = encodedValue.split("|");

            console.log(encodedValue);
            let typeAction = decoded[0]
            let typeActor = decoded[1]
            let macroType = decoded[2]
            let macroSubType = ''
            if(decoded.length > 3) {
                macroSubType = decoded[3]
            }
            switch(typeAction) {
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
                    this._useWeapon(typeActor, macroType)
                    break;
                case 'health':
                    this._setHealthStatus(typeActor, macroType)
                    break;
                case 'rest':
                    this._performRest(typeActor, macroType, event)
                    break;
                case 'stance':
                    await this._setStance(typeActor, macroType)
                    break;
            }
        }

        _rollStature(typeActor, attr) {
            if(typeActor === 'character') {
                if (STATS.STATURE.includes(attr)) {
                    game.tor2e.macro.utility.rollHeroicStatureMacro(capitalizeFirstLetter(attr));
                }
            }
        }

        _rollProficiency(typeActor, proficiency, event) {
            if(typeActor === 'character') {
                function getProficiencyFrom(_skillId, actor = game.tor2e.macro.utility._getActorFrom({})) {
                    let skills = actor.extendedData?.getCombatProficiencies();
                    let skill =  skills.values().find(s => game.i18n.localize(s.label) === _skillId)
                    skill.favoured = {value: false};
                    return skill;
                }
                game.tor2e.macro.utility._executeSkillMacro(this.actor, capitalizeFirstLetter(proficiency), true, getProficiencyFrom, 0)
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
            if(typeActor === 'character') {
                this.actor.toggleStatusEffectById(status);
            }
        }

        async _setStance(typeActor, stanceClass) {
            if(typeActor === 'character') {
                //game.tor2e.macro.utility.setPlayerStance({stanceClass: stanceClass, onlyLoremaster: false})
                const newStance = Tor2eStance.from(stanceClass);
                if (this.token?.combatant) {
                    let combatData = this.token?.combatant.getCombatData()
                    combatData.stance = newStance.toJSON();
                    await this.token?.combatant.setCombatData(combatData);
                    await this.token.render(game?.canvas?.app?.renderer);
                    await this.token._draw();
                }
            }
        }

        _rollSkill(typeActor, attr, skill) {
            if(typeActor === 'character') {
                game.tor2e.macro.utility.rollSkillMacro(capitalizeFirstLetter(skill));
            }
        }

        _rollSpecial(typeActor, special) {
            if(typeActor === 'character') {
                if (special === 'armour') {
                    game.tor2e.macro.utility.rollSpecialSkillMacro("Protection");
                }
            }
        }

        _useWeapon(typeActor, weapon) {
            if(typeActor === 'character') {
                game.tor2e.macro.utility.rollItemMacro(weapon, "weapon");
            }
        }
    }
})