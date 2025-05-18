import { TOR2EActionHandler } from './action-handler.js'
import { TOR2ERollHandler } from './roll-handler.js'
import {getGroup, getSettings, MODULE_ID} from "./constants.js";

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
                if (!group.listName) {
                    group.listName = `TOR2e: ${group.name}`
                }
            })
            const groupsArray = Object.values(groups)

            DEFAULTS = {
                layout: [
                    {
                        nestId: groups.stats.id,
                        id: groups.stats.id,
                        name: groups.stats.name,
                        settings: groups.stats.settings,
                        groups: [
                            { ...groups.attributes, nestId: 'stats_attributes' },
                            { ...groups.resources, nestId: 'stats_resources' },
                            { ...groups.stature, nestId: 'stats_stature' },
                            { ...groups.advancement, nestId: 'stats_advancement' }
                        ]

                    },
                    {
                        nestId: groups.skills.id,
                        id: groups.skills.id,
                        name: groups.skills.name,
                        settings: groups.skills.settings,
                        groups: [
                            { ...groups.strength, nestId: 'skills_strength' },
                            { ...groups.heart, nestId: 'skills_heart' },
                            { ...groups.wits, nestId: 'skills_wits' },
                        ]
                    },
                    {
                        nestId: groups.combat.id,
                        id: groups.combat.id,
                        name: groups.combat.name,
                        settings: groups.combat.settings,
                        groups: [
                            { ...groups.weapons, nestId: 'combat_weapons' },
                            { ...groups.combatAttributes, nestId: 'combat_combatAttributes' },
                            { ...groups.stances, nestId: 'combat_stances' },
                            { ...groups.utilities, nestId: 'combat_utilities' },
                            { ...groups.combatProficiences, nestId: 'combat_combatProficiences' },
                            { ...groups.armours, nestId: 'combat_armours' },
                            { ...groups.unequipped, nestId: 'combat_unequipped' },
                            { ...groups.dropped, nestId: 'combat_dropped' }
                        ]
                    },
                    {
                        nestId: groups.traits.id,
                        id: groups.traits.id,
                        name: groups.traits.name,
                        settings: groups.traits.settings,
                        groups: [
                            { ...groups.features, nestId: 'traits_features' },
                            { ...groups.occupation, nestId: 'traits_occupation' },
                            { ...groups.flaws, nestId: 'traits_flaws' },
                            { ...groups.rewards, nestId: 'traits_rewards' },
                            { ...groups.virtues, nestId: 'traits_virtues' },
                            { ...groups.fell, nestId: 'traits_fell' },
                        ]
                    },
                    {
                        nestId: groups.misc.id,
                        id: groups.misc.id,
                        name: groups.misc.name,
                        settings: groups.misc.settings,
                        groups: [
                            { ...groups.equipment, nestId: 'misc_equipment' },
                            { ...groups.rest, nestId: 'misc_rest' },
                            { ...groups.health, nestId: 'misc_health' },
                            { ...groups.effects, nestId: 'misc_effects' },
                        ]
                    },
                    {
                        nestId: groups.community.id,
                        id: groups.community.id,
                        name: groups.community.name,
                        settings: groups.community.settings,
                        groups: [
                            { ...groups.travel, nestId: 'community_travel' },
                            { ...groups.fellowship, nestId: 'community_fellowship' },
                        ]
                    },
                    {
                        nestId: groups.macros.id,
                        id: groups.macros.id,
                        name: groups.macros.name,
                        settings: groups.macros.settings,
                        groups: [
                            { ...groups.core_macros, nestId: 'macros_macros' },
                        ]
                    }
                ],
                groups: groupsArray
            }
            return DEFAULTS
        }

        /** @override */
        async registerSettings(onChangeFunction) {
            const settings = getSettings(coreModule);
            for (const [key, value] of Object.entries(settings)) {
                game.settings.register(MODULE_ID, key, value);
            }
        }
    }

    const module = game.modules.get(MODULE_ID);
    module.api = {
        requiredCoreModuleVersion: '2.0',
        SystemManager: TOR2ESystemManager
    }
    Hooks.call('tokenActionHudSystemReady', module)
});

