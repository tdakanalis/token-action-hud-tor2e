// Run as the fixture Player, with ownership of the hero and Observer access to the Community.
export async function runSmokeTests() {
    if (game.user.isGM || game.world.id !== 'hud-regression-tests') throw new Error('Isolated player test world required.');
    const {TOR2ERollHandler} = await import('../scripts/roll-handler.js');
    const {TOR2EActionHandler} = await import('../scripts/action-handler.js');
    const actor = game.user.character;
    const community = game.tor2e.macro.utility.getCommunity();
    if (!actor?.isOwner || !community || community.isOwner) throw new Error('Expected owned hero and Observer-only Community.');
    const handler = new TOR2ERollHandler();
    handler.hudManager = {actor, actors: [actor]};
    const values = () => JSON.stringify({hope: actor.system.resources.hope.value,
        endurance: actor.system.resources.endurance.value, fellowship: community.system.fellowshipPoints.value});
    const before = values();
    const results = [];
    let dialogs = 0;
    let warnings = 0;
    const hook = Hooks.on('renderTor2eRecoverHopeDialog', app => {dialogs++; app.close();});
    const originalWarn = ui.notifications.warn;
    ui.notifications.warn = function(message, ...args) {
        if (message === game.i18n.localize('tokenActionHud.tor2e.actions.hopeRecoveryPermission')) warnings++;
        return originalWarn.call(this, message, ...args);
    };
    const record = async (name, run) => {
        try {await run(); results.push({name, passed: true});}
        catch (error) {results.push({name, passed: false, error: error.message});}
    };
    try {
        for (const [name, encoded] of [
            ['Player short rest permission safeguard', 'rest|character|short'],
            ['Player prolonged rest permission safeguard', 'rest|character|prolonged'],
            ['Player stale Hope recovery action safeguard', `hud|recoverHope|${actor.uuid}|${community.uuid}`]
        ]) await record(name, async () => {
            const previousWarnings = warnings;
            await handler.handleActionClick({preventDefault() {}}, encoded);
            if (warnings !== previousWarnings + 1) throw new Error('Expected explanatory permission warning.');
            if (dialogs) throw new Error('Unsafe native recovery dialog opened.');
            if (values() !== before) throw new Error('Resources changed during a blocked action.');
        });
        await record('Player HUD hides unavailable direct recovery', async () => {
            const actionHandler = new TOR2EActionHandler();
            actionHandler.hudManager = {actor, actors: [actor]};
            const actions = [];
            actionHandler.addActions = values => actions.push(...values);
            actionHandler.addGroup = () => {};
            await actionHandler.buildSystemActions([]);
            if (actions.some(action => action.encodedValue.startsWith('hud|recoverHope|'))) {
                throw new Error('Unauthorized recovery shortcut was offered.');
            }
            const rests = actions.filter(action => action.encodedValue.startsWith('rest|'));
            if (rests.length !== 2 || rests.some(action => !action.cssClass.includes('tor2e-rest-blocked')
                || !action.info1?.text || !action.tooltip)) throw new Error('Blocked rests do not explain the restriction.');
        });
        for (const document of [actor, community]) await record('Player Eye Awareness privacy: ' + document.type, async () => {
            const actionHandler = new TOR2EActionHandler();
            actionHandler.hudManager = {actor: document, actors: [document]};
            const actions = [];
            actionHandler.addActions = values => actions.push(...values);
            actionHandler.addGroup = () => {};
            await actionHandler.buildSystemActions([]);
            if (actions.some(action => action.id === 'eyeAwareness')) throw new Error('Loremaster-only Eye Awareness exposed.');
        });
        await record('Player settings gate health, effects and Eye Awareness', async () => {
            const hud = 'token-action-hud-tor2e';
            const overrides = new Map();
            const originalGet = game.settings.get;
            game.settings.get = function(scope, key) {
                const id = `${scope}.${key}`;
                return overrides.has(id) ? overrides.get(id) : originalGet.call(this, scope, key);
            };
            const actionsFor = async (document, actors = [document]) => {
                const actionHandler = new TOR2EActionHandler();
                actionHandler.hudManager = {actor: document, actors};
                const actions = [];
                actionHandler.addActions = values => actions.push(...values);
                actionHandler.addGroup = () => {};
                await actionHandler.buildSystemActions([]);
                return actions;
            };
            const set = (key, value) => overrides.set(`${hud}.${key}`, value);
            const conditionState = () => JSON.stringify([...actor.effects].map(effect => effect.toObject()));
            try {
                set('displayPlayerHealthEvents', true);
                set('displayPlayerEffects', true);
                const enabled = await actionsFor(actor);
                if (!enabled.some(a => a.id === 'weary') || !enabled.some(a => a.id === 'dead')) {
                    throw new Error('Expected available health and effect actions.');
                }
                set('displayPlayerHealthEvents', false);
                set('displayPlayerEffects', false);
                const disabled = await actionsFor(actor);
                if (disabled.some(a => /^(health|effect)\||ActiveEffect/.test(a.encodedValue) || a.id.startsWith('tor2e_check_'))) {
                    throw new Error('A disabled health or effect control is visible.');
                }
                const beforeEffects = conditionState();
                await handler.handleActionClick({preventDefault() {}}, 'health|character|weary');
                await handler.handleActionClick({preventDefault() {}}, 'effect|character|dead');
                if (conditionState() !== beforeEffects) throw new Error('A stale action changed effects while disabled.');

                for (const [moduleAllows, systemPrivate] of [[false, false], [true, true], [true, false]]) {
                    set('displayPlayerEyeAwareness', moduleAllows);
                    overrides.set('tor2e.eyeAwarenessLoremasterOnly', systemPrivate);
                    for (const document of [actor, community]) {
                        const visible = (await actionsFor(document)).some(a => a.id === 'eyeAwareness');
                        if (visible !== (moduleAllows && !systemPrivate)) throw new Error('Eye Awareness did not respect both settings.');
                    }
                }

                set('displayPlayerHealthEvents', true);
                set('displayPlayerEffects', true);
                const other = {type: 'character', isOwner: true, effects: []};
                const bulk = action => /^(multiple\||hud\|condition\|)/.test(action.encodedValue);
                if ((await actionsFor(null, [actor, other])).some(bulk)) throw new Error('Loremaster bulk actions were offered to a player.');
                if (!(await actionsFor(actor)).some(action => action.id === 'weary')) throw new Error('Individual health controls must remain available.');
                await handler.handleActionClick({preventDefault() {}}, 'multiple|multiple|weary');
                await handler.handleActionClick({preventDefault() {}}, 'multiple|multiple|dead');
                await handler.handleActionClick({preventDefault() {}}, 'hud|condition|weary|true');
                if (conditionState() !== beforeEffects) throw new Error('Player bulk action changed a condition.');

                const menu = [];
                Hooks.callAll('tokenActionHudCoreActionContextMenu', menu, {actor, rollHandler: handler});
                const skillButton = document.createElement('button');
                skillButton.value = 'skill|character|heart|travel';
                const isSkillEdit = entry => /\.(increaseRank|decreaseRank|toggleFavoured|toggleMagical)$/.test(entry.label);
                set('allowPlayerCharacterEdits', true);
                const skillEdits = menu.filter(entry => isSkillEdit(entry) && entry.visible(skillButton));
                if (skillEdits.length !== 4) throw new Error('Owned skill-edit commands are missing.');
                set('allowPlayerCharacterEdits', false);
                if (skillEdits.some(entry => entry.visible(skillButton))) throw new Error('Disabled skill edits were offered.');
                const beforeSkill = JSON.stringify(actor.system.commonSkills.travel);
                for (const edit of skillEdits) await edit.onClick({}, skillButton);
                await handler._changeSkillRank('character', 'travel', 1);
                await handler._toggleFavouredSkill('character', 'travel');
                await handler._toggleMagicalSkill('travel');
                if (JSON.stringify(actor.system.commonSkills.travel) !== beforeSkill) throw new Error('A disabled skill edit changed the character.');
            } finally {game.settings.get = originalGet;}
        });
        await record('Observer Community has no song edit command', async () => {
            const items = [];
            Hooks.callAll('tokenActionHudCoreActionContextMenu', items, {actor: community, rollHandler: handler});
            const button = document.createElement('button');
            button.className = 'tah-action-button';
            button.value = 'song|community|' + community.items.find(item => item.type === 'song').id;
            if (items.some(item => item.label.endsWith('.toggleUsed') && item.visible(button))) {
                throw new Error('Observer was offered an editing command.');
            }
        });
        await record('Player can apply and remove an owned character condition', async () => {
            const before = actor.hasStatusEffectById('weary');
            try {
                await handler._setHealthStatus('character', 'weary');
                if (actor.hasStatusEffectById('weary') === before) throw new Error('Owned condition did not change.');
            } finally {
                if (actor.hasStatusEffectById('weary') !== before) await handler._setHealthStatus('character', 'weary');
            }
        });
    } finally {
        Hooks.off('renderTor2eRecoverHopeDialog', hook);
        ui.notifications.warn = originalWarn;
    }
    return {versions: {foundry: game.version, system: game.system.version}, results};
}
