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
