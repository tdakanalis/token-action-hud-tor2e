import { TOR2EActionHandler } from './action-handler.js'
import { TOR2ERollHandler } from './roll-handler.js'
import {getGroup} from "./constants.js";

export let TOR2ESystemManager = null

export let DEFAULTS = null

Hooks.on('tokenActionHudCoreApiReady', async (coreModule) => {
    TOR2ESystemManager = class TOR2ESystemManager extends coreModule.api.SystemManager {
        /** @override */
        getActionHandler() {
            return new TOR2EActionHandler()
        }

        /** @override */
        getAvailableRollHandlers() {
            let coreTitle = "The One Ring 2nd Edition"
            let choices = { core: coreTitle }
            TOR2ESystemManager.addHandler(choices, 'The One Ring 2nd Edition')
            return choices
        }

        /** @override */
        getRollHandler(handlerId) {
            return new TOR2ERollHandler()
        }

        /** @override */
        async registerDefaults() {
            const groups = getGroup(coreModule);
            Object.values(groups).forEach(group => {
                group.listName = `TOR2e: ${group.name}`
            })
            const groupsArray = Object.values(groups)
            DEFAULTS = {
                layout: [
                    {
                        nestId: 'stats',
                        id: 'stats',
                        name: coreModule.api.Utils.i18n('tor2e.actors.sections.attributes'),
                        groups: [
                            { ...groups.stats, nestId: 'stats' },
                            { ...groups.attributes, nestId: 'stats_attributes' },
                            { ...groups.resources, nestId: 'stats_resources' },
                            { ...groups.stature, nestId: 'stats_stature' },
                            { ...groups.advancement, nestId: 'stats_advancement' }
                        ]

                    },
                    {
                        nestId: 'skills',
                        id: 'skills',
                        name: coreModule.api.Utils.i18n('tor2e.actors.sections.commonSkills'),
                        groups: [
                            { ...groups.skills, nestId: 'skills' },
                            { ...groups.strength, nestId: 'skills_strength' },
                            { ...groups.heart, nestId: 'skills_heart' },
                            { ...groups.wits, nestId: 'skills_wits' },
                        ]

                    },
                    {
                        nestId: 'combat',
                        id: 'combat',
                        name: coreModule.api.Utils.i18n('tor2e.actors.sections.combat'),
                        groups: [
                            { ...groups.combat, nestId: 'combat' },
                            { ...groups.weapons, nestId: 'combat_weapons' },
                            { ...groups.combatAttributes, nestId: 'combat_combatAttributes' },
                            { ...groups.stances, nestId: 'combat_stances' },
                            { ...groups.combatProficiences, nestId: 'combat_combatProficiences' },
                            { ...groups.armours, nestId: 'combat_armours' },
                        ]
                    },
                    {
                        nestId: 'traits',
                        id: 'traits',
                        name: coreModule.api.Utils.i18n('tor2e.actors.sections.traits'),
                        groups: [
                            { ...groups.traits, nestId: 'traits' },
                            { ...groups.features, nestId: 'traits_features' },
                            { ...groups.flaws, nestId: 'traits_flaws' },
                            { ...groups.rewards, nestId: 'traits_rewards' },
                            { ...groups.virtues, nestId: 'traits_virtues' }
                        ]
                    },
                    {
                        nestId: 'misc',
                        id: 'misc',
                        name: coreModule.api.Utils.i18n('tor2e.items.miscellaneous.title'),
                        groups: [
                            { ...groups.misc, nestId: 'misc' },
                            { ...groups.equipment, nestId: 'misc_equipment' },
                            { ...groups.rest, nestId: 'misc_rest' },
                            { ...groups.health, nestId: 'misc_health' },
                        ]
                    },
                    {
                        nestId: 'community',
                        id: 'community',
                        name: coreModule.api.Utils.i18n('tor2e.actors.types.community.title'),
                        groups: [
                            { ...groups.community, nestId: 'community' },
                            { ...groups.travel, nestId: 'community_travel' },
                            { ...groups.fellowship, nestId: 'community_fellowship' },
                        ]
                    }
                ],
                groups: groupsArray
            }

            //game.tokenActionHud.defaults = DEFAULTS
            return DEFAULTS
        }
    }

    const module = game.modules.get('token-action-hud-tor2e');
    module.api = {
        requiredCoreModuleVersion: '2.0',
        SystemManager: TOR2ESystemManager
    }
    Hooks.call('tokenActionHudSystemReady', module)
});

