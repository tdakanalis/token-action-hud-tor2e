import {STATS} from "./constants.js";
import {tor2eUtilities} from "/systems/tor2e/modules/utilities.js";
import Tor2eSong from "/systems/tor2e/modules/song.js";
import {Tor2eStance} from "/systems/tor2e/modules/combat/Tor2eStance.js";
import {checkHopeRecoveryPermission, communityFor, handleFeatureAction, openSystemSheet, shareSystemItem} from './features.js';
import {getControlledTokens, getCurrentCommunity, getSetting, getTargetedTokens, isAllowedForUser} from "./utils.js";

export let TOR2ERollHandler = null

Hooks.once('tokenActionHudCoreApiReady', async (coreModule) => {
    // Extends TAH Core's RollHandler class and handles action events triggered when an action is clicked.
    TOR2ERollHandler = class TOR2ERollHandler extends coreModule.api.RollHandler {
        
        async handleActionClick(event, encodedValue) {
            try {
                await this._handleActionClick(event, encodedValue);
            } catch (error) {
                console.error('Token Action HUD TOR2E | Action failed', error);
                ui.notifications.error(game.i18n.localize('tokenActionHud.tor2e.actions.failed'));
            } finally {
                Hooks.callAll('forceUpdateTokenActionHud');
            }
        }

        async _handleActionClick(event, encodedValue) {
            const decoded = encodedValue.split("|");

            let typeAction = decoded[0]
            let typeActor = decoded[1]
            let macroType = decoded[2]
            let macroSubType = ''

            if(decoded.length > 3) {
                macroSubType = decoded[3]
            }

            if (this.isRightClick) {
                // Songs live on the community actor rather than this.actor, so they
                // need their own lookup to open a sheet.
                if (typeAction === 'song') {
                    await this._showSong(macroType);
                } else {
                    await this._showItem(macroSubType);
                }
                return;
            }

            if (this.isAlt || this.isCtrl || this.isShift) {
                if (this.isAlt && ['skill', 'proficiency'].includes(typeAction)
                    && event.target?.closest?.('.tah-info1')) {
                    await this._changeSkillRank(typeActor, typeAction === 'skill' ? macroSubType : macroType,
                        this.isShift ? -1 : 1, typeAction);
                    return;
                }
                // Alt is the system's own modifier for these toggles: its sheet gates
                // them behind tor2eUtilities.utilities.isAllowed, which is event.altKey.
                if (this.isAlt && typeAction === 'skill') {
                    await this._toggleFavouredSkill(typeActor, macroSubType);
                    return;
                }
                if (this.isAlt && typeAction === 'song') {
                    await this._toggleSongUsed(macroType);
                    return;
                }
                if (this.isCtrl && typeAction === 'skill' && typeActor === 'character') {
                    await this._toggleMagicalSkill(macroSubType);
                    return;
                }
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
            }

            switch(typeAction) {
                case 'armour':
                    await openSystemSheet(this.actor.items.get(macroSubType));
                    break;
                case 'hud':
                    await handleFeatureAction(this, typeActor, decoded.slice(2));
                    break;
                case 'traits':
                case 'miscellaneous':
                    await shareSystemItem(this.actor, this.actor.items.get(macroSubType));
                    break;
                case 'resource':
                    await openSystemSheet(this.actor, 'combat', macroType === 'shadow'
                        ? 'system.resources.shadow.temporary.value' : `system.resources.${macroType}.value`);
                    break;
                case 'attribute':
                    await openSystemSheet(this.actor, 'abilities', typeActor === 'character'
                        ? `system.attributes.${macroType}.value` : `system.${macroType}.value`);
                    break;
                case 'advancement':
                    await openSystemSheet(this.actor, 'hero', `system.${macroType}.value`);
                    break;
                case 'occupation':
                    await openSystemSheet(this.actor, undefined, 'system.occupation.value');
                    break;
                case 'community': {
                    const community = communityFor(this.actor);
                    if (macroType === 'travel' && this.actor?.type === 'character') {
                        const skills = {guide: 'travel', hunters: 'hunting', scouts: 'explore', lookouts: 'awareness'};
                        const members = macroSubType === 'guide' ? [community?.system.travel?.guide] : community?.system.travel?.[macroSubType] ?? [];
                        if (members.some(member => member?.id === this.actor.id)) {
                            await this._rollSkill('character', '', skills[macroSubType]);
                            break;
                        }
                    }
                    await openSystemSheet(community);
                    break;
                }
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
                case 'macro':
                    await this._executeMacro(macroType)
                    break;
                case 'song':
                    await this._playSong(typeActor, macroType)
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
                case 'miserable':
                case 'daunted':
                    await this._toggleHealthStatus(typeAction);
                    break;
            }
        }

        async _showItem(itemId) {
            if (this.isRenderItem()) {
                await this.renderItem(this.actor, itemId)
            }
        }

        async _showSong(songId) {
            const community = communityFor(this.actor);
            if (this.isRenderItem() && community) {
                await this.renderItem(community, songId)
            }
        }

        async _rollStature(typeActor, attr) {
            if(typeActor === 'character') {
                if (STATS.STATURE.includes(attr)) {
                    await game.tor2e.macro.utility._executeSkillMacro(this.actor,
                        coreModule.api.Utils.i18n('tor2e.statureStats.' + attr), !this.isShift,
                        label => this.actor.extendedData.getHeroicStatureFrom(label));
                }
            }
        }

        async _rollProficiency(typeActor, proficiency) {
            if(typeActor === 'character') {
                const getProficiencyFrom = () => {
                    const skill = this.actor.extendedData?.getCombatProficiencies()?.get(proficiency);
                    return skill ? {...skill, favoured: skill.favoured ?? {value: false}} : null;
                };
                await game.tor2e.macro.utility._executeSkillMacro(this.actor,
                    coreModule.api.Utils.i18n('tor2e.combatProficiencies.' + proficiency), !this.isShift, getProficiencyFrom, 0)
            }
        }

        async _performRest(typeActor, restType, event) {
            if(typeActor === 'character') {
                // Use the active Community directly, including when it is not
                // visible: this is the document the native rest flow will use.
                if (!checkHopeRecoveryPermission(this.actor, getCurrentCommunity())) return;
                if (restType === 'short') {
                    await tor2eUtilities.eventsProcessing.onShortRest.call({actor: this.actor}, {}, event);
                } else {
                    await tor2eUtilities.eventsProcessing.onProlongedRest.call({actor: this.actor}, {}, event);
                }
            }
        }

        async _setHealthStatus(typeActor, status) {
            if (!isAllowedForUser("displayPlayerHealthEvents") || this.actor?.isOwner === false) {
                return;
            }
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                await this.actor.toggleStatusEffectById(status);
            }
        }

        async _setEffect(typeActor, effect) {
            if (!isAllowedForUser("displayPlayerEffects") || this.actor?.isOwner === false) {
                return;
            }
            if (['character', 'adversary', 'lore', 'npc'].includes(typeActor)) {
                const condition = CONFIG.statusEffects.find(e => e.id === effect);
                const overlay = getSetting("addOverlayOnEffects");
                if (condition) await this.actor.toggleStatusEffect(condition.id, {overlay: overlay});
            }
        }

        async _setStance(typeActor, stanceClass) {
            if(typeActor === 'character') {
                const combatant = this.token?.document?.findCombat?.()?.combatant ?? this.token?.combatant;
                const stance = Tor2eStance.from(stanceClass);
                if (combatant && stance && this.actor.isOwner !== false) {
                    await combatant.setCombatantStance(stance.toJSON());
                }
            }
        }

        async _rollSkill(typeActor, attr, skill) {
            if(typeActor === 'character') {
                await game.tor2e.macro.utility.rollSkillMacro(
                    coreModule.api.Utils.i18n('tor2e.commonSkills.' + skill), !this.isShift, {}, this.actor);
            } else if(typeActor === 'npc') {
                const getSkillFrom = skillId => {
                    const item = this.actor.items.find(i => i.type === 'skill' && (i.id === skillId || i.name === skillId));
                    return item ? {...item.system, label: item.name,
                        roll: {associatedAttribute: item.system.associatedStat?.value},
                        favoured: item.system.favoured ?? {value: false}} : null;
                };
                await game.tor2e.macro.utility._executeSkillMacro(this.actor, skill, !this.isShift, getSkillFrom, 0)
            }
        }

        async _rollSpecial(typeActor, special) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                if (special === 'armour') {
                    await game.tor2e.macro.utility._executeSkillMacro(this.actor, "Protection", !this.isShift,
                        label => this.actor.extendedData.getSpecialSkillFrom(label));
                } else {
                    await openSystemSheet(this.actor, 'combat', typeActor === 'character'
                        ? 'system.combatAttributes.parry.value' : 'system.parry.value');
                }
            }
        }

        async _useWeapon(typeActor, weapon, itemId) {
            if(typeActor === 'character' || typeActor === 'adversary') {
                const item = coreModule.api.Utils.getItem(this.actor, itemId);
                if(item?.system?.equipped?.value){
                    await this.actor.attackOpponentWith(item.name, {automaticDifficultyRoll: Boolean(this.isShift)});
                } else if (item) await openSystemSheet(item);
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
            if (!game.user.isGM) return;
            const tokens = getControlledTokens();
            const remove = tokens.every(token => token.inCombat);
            for (const token of tokens) {
                if (Boolean(token.inCombat) === remove) await token.document.toggleCombatant();
            }
        }

        async _toggleEffect(effect) {
            if (!isAllowedForUser("displayPlayerEffects")) {
                return;
            }
            for (const actor of new Set(this.actors)) {
                if (!['character', 'adversary', 'npc', 'lore'].includes(actor.type)) continue;
                const condition = CONFIG.statusEffects.find(e => e.id === effect);
                const overlay = getSetting("addOverlayOnEffects");
                if (condition && actor.isOwner !== false) await actor.toggleStatusEffect(condition.id, {overlay: overlay});
            }
        }

        async _toggleHealthStatus(status) {
            if (!isAllowedForUser("displayPlayerHealthEvents")) {
                return;
            }
            for (const actor of new Set(this.actors)) {
                if (actor.isOwner === false || !['character', 'adversary', 'npc', 'lore'].includes(actor.type)
                    || (actor.type !== 'character' && ['miserable', 'daunted'].includes(status))) continue;
                await actor.toggleStatusEffectById(status);
            }
        }

        async _setItemStatus(itemId, primaryAttribute, primaryValue, secondaryAttribute, secondaryValue) {
            const item = coreModule.api.Utils.getItem(this.actor, itemId);
            if (!item || this.actor.isOwner === false) return;
            const updates = {[secondaryAttribute]: secondaryValue, [primaryAttribute]: primaryValue};
            await item.update(updates);
            await this.actor.toggleItemActiveEffect(itemId, updates['system.equipped.value'] === true);
        }

        async _executeMacro(macroId) {
            const macro = game.macros.get(macroId);
            if (macro?.canExecute) await macro.execute();
        }

        async _toggleFavouredSkill(typeActor, skillId) {
            if (this.actor?.isOwner === false) return;
            if (typeActor === 'character') {
                const skill = this.actor.system.commonSkills[skillId];
                if (!skill) return;
                await tor2eUtilities.eventsProcessing.onSkillName.call({actor: this.actor}, {}, {
                    altKey: true, preventDefault() {}, currentTarget: {dataset: {
                        actionFavouredValue: String(skill.favoured?.value === true),
                        actionFavouredName: `system.commonSkills.${skillId}.favoured.value`
                    }}
                });
            } else if (typeActor === 'npc') {
                // Preserve older saved action values that used the skill name.
                const skill = this.actor.items
                    .filter(i => i.type === 'skill')
                    .find(i => i.id === skillId || i.name === skillId);
                if (!skill) {
                    return;
                }
                await tor2eUtilities.eventsProcessing.ontoggleFavouredSkillState.call({actor: this.actor}, {}, {
                    altKey: true, preventDefault() {}, currentTarget: {
                        closest: () => ({dataset: {itemId: skill.id}}),
                        dataset: {actionFavouredValue: String(skill.system.favoured?.value === true), actionFavouredName: 'system.favoured.value'}
                    }
                });
            }
        }

        async _changeSkillRank(typeActor, skillId, direction, typeAction = 'skill') {
            if (this.actor?.isOwner === false || ![-1, 1].includes(direction)) return;
            const item = typeActor === 'npc' ? this.actor.items.get(skillId) : null;
            const skills = typeAction === 'proficiency' ? this.actor.system.combatProficiencies : this.actor.system.commonSkills;
            const skill = typeActor === 'npc' ? item?.system : skills?.[skillId];
            if (!skill || (typeAction === 'proficiency' && skillId === 'brawling')) return;
            const field = typeActor === 'npc' ? 'system.value'
                : `system.${typeAction === 'proficiency' ? 'combatProficiencies' : 'commonSkills'}.${skillId}.value`;
            // Supply the metadata of TOR2E's six-diamond rank control. Its existing
            // processor owns bounds, modifier behavior and document persistence.
            const control = {
                dataset: {field, actionValue: String(skill.value), actionMaxValue: '6'},
                closest: () => ({dataset: {itemId: item?.id}})
            };
            const event = {currentTarget: control, altKey: true, shiftKey: direction < 0, preventDefault() {}};
            const operation = typeActor === 'npc'
                ? tor2eUtilities.eventsProcessing.onItemSkillModify : tor2eUtilities.eventsProcessing.onSkillModify;
            await operation.call({actor: this.actor}, {}, event);
        }

        async _toggleMagicalSkill(skillId) {
            const skill = this.actor?.system.commonSkills?.[skillId];
            if (!this.actor?.isOwner || !skill) return;
            await tor2eUtilities.eventsProcessing.onSkillName.call({actor: this.actor}, {}, {
                ctrlKey: true, preventDefault() {}, currentTarget: {dataset: {
                    actionMagicalValue: String(skill.magical?.value === true),
                    actionMagicalName: `system.commonSkills.${skillId}.magical.value`
                }}
            });
        }

        async _toggleSongUsed(songId) {
            const community = communityFor(this.actor);
            // Songs belong to the community actor, which players usually cannot edit;
            // bail out rather than letting the update fail on permissions.
            if (!community?.isOwner) {
                return;
            }
            const song = community.items.get(songId);
            if (!song) {
                return;
            }
            await tor2eUtilities.eventsProcessing.ontoggleUsedState.call({actor: community}, {}, {
                preventDefault() {}, currentTarget: {
                    closest: () => ({dataset: {itemId: song.id}}), dataset: {primaryAttribute: 'system.used.value'}
                }
            });
        }

        async _playSong(typeActor, songId) {
            if (!['character', 'community'].includes(typeActor)) {
                return;
            }
            const community = communityFor(this.actor);
            if (!community) {
                return;
            }
            // Tor2eSong resolves the performing character itself: a Loremaster gets a
            // member picker, a player uses their assigned character.
            await new Tor2eSong({songId, user: game.user, community}).play();
        }
    }
})
