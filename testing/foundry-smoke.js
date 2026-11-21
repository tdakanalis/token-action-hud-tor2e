// Run after createFixture(), as GM in the isolated test world.
export async function runSmokeTests() {
    if (!game.user.isGM || game.world.id !== 'hud-regression-tests') throw new Error('Isolated GM test world required.');
    const {TOR2EActionHandler} = await import('../scripts/action-handler.js');
    const {TOR2ERollHandler} = await import('../scripts/roll-handler.js');
    const results = [];
    const check = (condition, message) => {if (!condition) throw new Error(message);};
    const record = async (name, run) => {
        try {await run(); results.push({name, passed: true});}
        catch (error) {results.push({name, passed: false, error: error.message});}
    };
    const heroToken = canvas.tokens.placeables.find(token => token.actor.getFlag('token-action-hud-tor2e', 'fixture') === 'hero');
    const hero = heroToken.actor;
    const rollHandler = actor => {
        const handler = new TOR2ERollHandler();
        const token = canvas.tokens.placeables.find(token => token.actor.id === actor.id);
        handler.hudManager = {actor, actors: [actor], token, tokens: [token]};
        return handler;
    };
    const cancelDialog = async (className, run) => {
        let opened = false;
        let resolveClosed;
        let rejectClosed;
        const closed = new Promise((resolve, reject) => {resolveClosed = resolve; rejectClosed = reject;});
        const timer = setTimeout(() => rejectClosed(new Error('Native dialog did not close.')), 10000);
        const hook = Hooks.on('render' + className, app => {
            opened = true;
            // AppV1's render hook fires before RENDERED; close on the next frame.
            requestAnimationFrame(() => app.close().then(resolveClosed, rejectClosed));
        });
        try {await run(); await closed; check(opened, 'Expected native ' + className + ' dialog.');}
        finally {clearTimeout(timer); Hooks.off('render' + className, hook);}
    };
    const contextCommand = async (actor, value, name) => {
        const items = [];
        const handler = rollHandler(actor);
        Hooks.callAll('tokenActionHudCoreActionContextMenu', items, {actor, rollHandler: handler});
        const button = document.createElement('button');
        button.className = 'tah-action-button';
        button.value = value;
        const command = items.find(item => item.label === 'tokenActionHud.tor2e.actions.' + name && item.visible(button));
        check(command, 'Context command unavailable: ' + name);
        await command.onClick({}, button);
    };

    for (const token of canvas.tokens.placeables) await record('Build ' + token.actor.type, async () => {
        const handler = new TOR2EActionHandler();
        handler.hudManager = {actor: token.actor, actors: [token.actor], token, tokens: [token]};
        const actions = [];
        handler.addActions = values => actions.push(...values);
        handler.addGroup = () => {};
        await handler.buildSystemActions([]);
        check(actions.length > 1, 'Expected useful actions.');
        check(!actions.some(action => !action.name || action.name.startsWith('tokenActionHud.')), 'Missing action label.');
    });
    await record('Zero-valued stats survive Core action creation', async () => {
        const handler = new TOR2EActionHandler();
        handler.addActions([{id: 'zero-test', name: 'Zero', encodedValue: 'resource|character|zero', info1: {text: 0}}]);
        check(handler.availableActions.get('zero-test')?.info1.text === '0', 'Core discarded a numeric zero.');
    });
    await record('Native character skill dialog', () => cancelDialog('Tor2eRollDialog', () => rollHandler(hero)._rollSkill('character', 'heart', 'travel')));
    await record('Native proficiency dialog', () => cancelDialog('Tor2eRollDialog', () => rollHandler(hero)._rollProficiency('character', 'swords')));
    await record('Native Valour dialog', () => cancelDialog('Tor2eRollDialog', () => rollHandler(hero)._rollStature('character', 'valour')));
    await record('Native Protection dialog', () => cancelDialog('Tor2eRollDialog', () => rollHandler(hero)._rollSpecial('character', 'armour')));
    const npc = canvas.tokens.placeables.find(token => token.actor.type === 'npc').actor;
    await record('Native NPC skill dialog', () => cancelDialog('Tor2eRollDialog', () => rollHandler(npc)._rollSkill('npc', 'wits', npc.items.find(item => item.type === 'skill').id)));
    await record('Native rest dialog cancellation', () => cancelDialog('Tor2eRecoverHopeDialog', () => rollHandler(hero)._performRest('character', 'short', {preventDefault() {}})));
    await record('Equipment changes and effects', async () => {
        const weapon = hero.items.find(item => item.name === 'Test Sword');
        const handler = rollHandler(hero);
        await handler._setItemStatus(weapon.id, 'system.dropped.value', true, 'system.equipped.value', false);
        check(weapon.system.dropped.value && !weapon.system.equipped.value, 'Drop state incorrect.');
        await handler._setItemStatus(weapon.id, 'system.equipped.value', true, 'system.dropped.value', false);
        check(weapon.system.equipped.value && !weapon.system.dropped.value, 'Equip state incorrect.');
    });
    await record('Favoured skill toggle and restore', async () => {
        const before = hero.system.commonSkills.travel.favoured.value;
        const handler = rollHandler(hero);
        await handler._toggleFavouredSkill('character', 'travel');
        check(hero.system.commonSkills.travel.favoured.value !== before, 'Favoured did not change.');
        await handler._toggleFavouredSkill('character', 'travel');
        check(hero.system.commonSkills.travel.favoured.value === before, 'Favoured did not restore.');
    });
    await record('Native common skill rank increase and decrease', async () => {
        const before = hero.system.commonSkills.travel.value;
        const handler = rollHandler(hero);
        await handler._changeSkillRank('character', 'travel', 1);
        check(hero.system.commonSkills.travel.value === before + 1, 'Rank did not increase through the system processor.');
        await handler._changeSkillRank('character', 'travel', -1);
        check(hero.system.commonSkills.travel.value === before, 'Rank did not restore.');
    });
    await record('Native combat proficiency rank increase and decrease', async () => {
        const before = hero.system.combatProficiencies.swords.value;
        const handler = rollHandler(hero);
        await handler._changeSkillRank('character', 'swords', 1, 'proficiency');
        check(hero.system.combatProficiencies.swords.value === before + 1, 'Proficiency did not increase.');
        await handler._changeSkillRank('character', 'swords', -1, 'proficiency');
        check(hero.system.combatProficiencies.swords.value === before, 'Proficiency did not restore.');
    });
    await record('Native NPC skill rank increase and decrease', async () => {
        const skill = npc.items.find(item => item.type === 'skill');
        const before = skill.system.value;
        const handler = rollHandler(npc);
        await handler._changeSkillRank('npc', skill.id, 1);
        check(skill.system.value === before + 1, 'NPC rank did not increase.');
        await handler._changeSkillRank('npc', skill.id, -1);
        check(skill.system.value === before, 'NPC rank did not restore.');
    });
    await record('Native trait chat card', async () => {
        const {shareSystemItem} = await import('../scripts/features.js');
        const message = await shareSystemItem(hero, hero.items.find(item => item.type === 'trait'));
        check(message?.content?.includes('Synthetic trait'), 'Missing system item-description card.');
    });
    await record('Native journey-role dialog', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        await cancelDialog('Tor2eRollDialog', () => handleFeatureAction(rollHandler(hero), 'roleRoll', [hero.uuid, 'travel']));
    });
    await record('Native company sheet navigation', async () => {
        const {openSystemSheet} = await import('../scripts/features.js');
        const community = game.actors.find(actor => actor.type === 'community');
        await openSystemSheet(community);
        check(community.sheet.rendered, 'Community sheet did not open.');
        await community.sheet.close();
    });
    for (const [encoded, field] of [
        ['attribute|character|strength', 'system.attributes.strength.value'],
        ['resource|character|endurance', 'system.resources.endurance.value'],
        ['advancement|character|skillPoints', 'system.skillPoints.value']
    ]) await record('Native field navigation: ' + field, async () => {
        try {
            await rollHandler(hero)._handleActionClick({}, encoded);
            check(document.activeElement?.name === field, 'Expected focus on native field ' + field);
        } finally {await hero.sheet.close();}
    });
    await record('Native magical skill toggle and restore', async () => {
        const before = hero.system.commonSkills.travel.magical.value;
        try {
            await contextCommand(hero, 'skill|character|heart|travel', 'toggleMagical');
            check(hero.system.commonSkills.travel.magical.value !== before, 'Magical state did not change.');
        } finally {
            if (hero.system.commonSkills.travel.magical.value !== before) await rollHandler(hero)._toggleMagicalSkill('travel');
        }
    });
    await record('Explicit mixed-group conditions apply and remove', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const adversary = canvas.tokens.placeables.find(token => token.actor.type === 'adversary').actor;
        const community = game.actors.find(actor => actor.type === 'community');
        const actors = [hero, hero, adversary, community];
        const before = [hero, adversary].map(actor => actor.hasStatusEffectById('weary'));
        try {
            await handleFeatureAction({actors}, 'condition', ['weary', 'true']);
            check(hero.hasStatusEffectById('weary') && adversary.hasStatusEffectById('weary'), 'Mixed group was not updated.');
            check(!community.hasStatusEffectById('weary'), 'Ineligible Community received a condition.');
            await handleFeatureAction({actors}, 'condition', ['weary', 'false']);
            check(!hero.hasStatusEffectById('weary') && !adversary.hasStatusEffectById('weary'), 'Conditions did not clear.');
        } finally {
            for (const [index, actor] of [hero, adversary].entries()) {
                if (before[index]) await actor.addStatusEffectById('weary');
                else await actor.deleteStatusEffectById('weary');
            }
        }
    });
    await record('Active effect context toggle and restore', async () => {
        const effect = hero.effects.find(effect => effect.name === 'HUD Test Effect');
        check(effect, 'Run enrichFixture first.');
        const before = effect.disabled;
        try {
            await contextCommand(hero, 'hud|sheet|' + effect.uuid, 'toggleEffect');
            check(effect.disabled !== before, 'Effect did not change.');
        } finally {await effect.update({disabled: before});}
    });
    await record('Native song used-state toggle and restore', async () => {
        const company = game.actors.find(actor => actor.type === 'community');
        const song = company.items.find(item => item.type === 'song');
        const before = song.system.used.value;
        try {
            await contextCommand(hero, 'song|character|' + song.id, 'toggleUsed');
            check(song.system.used.value !== before, 'Song used state did not change.');
        } finally {
            if (song.system.used.value !== before) await rollHandler(hero)._toggleSongUsed(song.id);
        }
    });
    await record('Fell ability active-state toggle and restore', async () => {
        const adversary = canvas.tokens.placeables.find(token => token.actor.type === 'adversary').actor;
        const ability = adversary.items.find(item => item.type === 'fell-ability');
        const before = ability.system.active.value;
        try {
            await contextCommand(adversary, `traits|adversary|fell-ability|${ability.id}`, 'toggleAbility');
            check(ability.system.active.value !== before, 'Ability state did not change.');
        } finally {await ability.update({'system.active.value': before});}
    });
    for (const type of ['undertaking', 'standing', 'mount', 'journey-log']) await record('Native ' + type + ' sheet navigation', async () => {
        const {openSystemSheet} = await import('../scripts/features.js');
        const company = game.actors.find(actor => actor.type === 'community');
        const item = [...hero.items, ...company.items].find(item => item.type === type);
        check(item, 'Missing populated fixture: ' + type);
        try {
            await openSystemSheet(item);
            check(item.sheet.rendered, 'Native document sheet did not render.');
        } finally {await item.sheet.close();}
    });
    await record('Combat task announces the native card and opens its skill roll', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const item = game.items.find(item => item.name === 'Test Combat Task');
        const before = game.messages.size;
        await cancelDialog('Tor2eRollDialog', () => handleFeatureAction(rollHandler(hero), 'task', [item.uuid]));
        check(game.messages.size > before, 'Native task chat card was not posted.');
    });
    await record('Visible foe targeting and target clearing', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const target = canvas.tokens.placeables.find(token => token.actor.type === 'adversary');
        await handleFeatureAction(rollHandler(hero), 'target', [target.id]);
        check(game.user.targets.has(target), 'Target not selected.');
        await handleFeatureAction(rollHandler(hero), 'clearTargets', []);
        check(game.user.targets.size === 0, 'Targets did not clear.');
    });
    await record('Game Control player manoeuvres launcher', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const method = 'macro_combat_manoeuvres';
        check(typeof game.Tor2eGameControl?.[method] === 'function', 'Integration not installed.');
        canvas.tokens.releaseAll();
        heroToken.control({releaseOthers: true});
        await cancelDialog('DialogV2', () => handleFeatureAction(rollHandler(hero), 'integration', [method]));
    });
    await record('Native Fellowship Hope recovery dialog', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const community = game.actors.find(actor => actor.type === 'community');
        await cancelDialog('Tor2eRecoverHopeDialog', () => handleFeatureAction(rollHandler(hero), 'recoverHope', [hero.uuid, community.uuid]));
    });
    await record('Native journey event dialog', async () => {
        const {handleFeatureAction} = await import('../scripts/features.js');
        const community = game.actors.find(actor => actor.type === 'community');
        const log = community.items.find(item => item.type === 'journey-log');
        await cancelDialog('Tor2eEventRollDialog', () => handleFeatureAction(rollHandler(hero), 'journeyEvent', [log.uuid]));
    });
    await record('Execute permitted native Macro', async () => {
        const macro = await Macro.create({name: 'HUD Test Macro', type: 'script', command: 'globalThis.__hudMacroRuns = (globalThis.__hudMacroRuns ?? 0) + 1;'});
        const before = globalThis.__hudMacroRuns ?? 0;
        try {
            await rollHandler(hero)._executeMacro(macro.id);
            check(globalThis.__hudMacroRuns === before + 1, 'Macro was not executed.');
        } finally {await macro.delete();}
    });
    await record('System engagement, stance and attack dialog', async () => {
        const adversaryToken = canvas.tokens.placeables.find(token => token.actor.type === 'adversary');
        const combat = await Combat.create({scene: canvas.scene.id, active: true, flags: {'token-action-hud-tor2e': {fixture: true}}});
        try {
            await combat.createEmbeddedDocuments('Combatant', [heroToken, adversaryToken].map(token => ({tokenId: token.id, actorId: token.actor.id, sceneId: canvas.scene.id})));
            heroToken.control({releaseOthers: true});
            adversaryToken.control({releaseOthers: false});
            const combatant = combat.combatants.find(c => c.tokenId === heroToken.id);
            // The system starts asynchronous opponent updates without awaiting them.
            // Observe its document update instead of assuming the button's return is a receipt.
            let engagementHook;
            let engagementTimer;
            const engaged = new Promise((resolve, reject) => {
                engagementHook = Hooks.on('updateCombatant', updated => {
                    if (updated.id === combatant.id && updated.getCombatData()?.engagedWith?.length) resolve();
                });
                engagementTimer = setTimeout(() => reject(new Error('No engagement document update received.')), 10000);
            });
            try {
                await combat.engagementAction(combat);
                await engaged;
            } finally {
                Hooks.off('updateCombatant', engagementHook);
                clearTimeout(engagementTimer);
            }
            check(combatant.getCombatData().engagedWith.length === 1, 'Engagement not set.');
            await rollHandler(hero)._setStance('character', 'Tor2eOpenStance');
            check(combatant.getStance().class === 'Tor2eOpenStance', 'Stance not set.');
            heroToken.control({releaseOthers: true});
            adversaryToken.setTarget(true, {releaseOthers: true});
            const weapon = hero.items.find(item => item.name === 'Test Sword');
            await cancelDialog('Tor2eRollDialog', () => rollHandler(hero)._useWeapon('character', weapon.name, weapon.id));
        } finally {
            for (const token of Array.from(game.user.targets)) token.setTarget(false, {releaseOthers: false});
            await combat.delete();
        }
    });
    canvas.tokens.releaseAll();
    heroToken.control({releaseOthers: true});
    await record('Context menu preserves its originating HUD group', async () => {
        const app = game.tokenActionHud;
        await app.update({name: 'hudSmokeContext'});
        await app.render({force: true});
        const button = [...app.element.querySelectorAll('.tor2e-action')].find(element => element.value.startsWith('weapon|'));
        check(button, 'Weapon control not rendered.');
        const group = button.closest('.tah-tab-group');
        if (!group.classList.contains('hover')) app.toggleGroup(null, group);
        const rect = button.getBoundingClientRect();
        const menuReady = new Promise((resolve, reject) => {
            const observer = new MutationObserver(() => {
                if (document.querySelector('#context-menu')) {observer.disconnect(); clearTimeout(timer); resolve();}
            });
            const timer = setTimeout(() => {observer.disconnect(); reject(new Error('Context menu did not open.'));}, 3000);
            observer.observe(document.body, {childList: true, subtree: true});
        });
        button.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2,
            clientX: rect.left + 10, clientY: rect.top + 10}));
        await menuReady;
        group.dispatchEvent(new PointerEvent('pointerleave', {relatedTarget: document.querySelector('#context-menu')}));
        try {
            check(!group.classList.contains('hover'), 'Pointer-leave path was not exercised.');
            check(button.checkVisibility(), 'Originating HUD group disappeared.');
            check(Number(getComputedStyle(app.element).opacity) === 1, 'HUD faded while its menu remained active.');
        } finally {
            await ui.context?.close({animate: false});
        }
        check(!button.classList.contains('context'), 'Context target was not cleared.');
    });
    await record('Secondary menu opens through keyboard', async () => {
        const app = game.tokenActionHud;
        const button = [...app.element.querySelectorAll('.tor2e-action')].find(element => element.value.startsWith('skill|'));
        check(button, 'Skill control not rendered.');
        const group = button.closest('.tah-tab-group');
        if (!group.classList.contains('hover')) app.toggleGroup(null, group);
        check(!app.element.querySelector('.fa-ellipsis'), 'Secondary-action dots must not be rendered.');
        button.dispatchEvent(new KeyboardEvent('keydown', {key: 'F10', shiftKey: true, bubbles: true}));
        // The native ContextMenu rendering may await its position calculation.
        const deadline = performance.now() + 3000;
        while (!document.querySelector('#context-menu .context-item')) {
            if (performance.now() > deadline) throw new Error('Native secondary menu did not open.');
            await new Promise(requestAnimationFrame);
        }
        try {
            check(document.querySelector('#context-menu').textContent.includes(game.i18n.localize('tokenActionHud.tor2e.actions.increaseRank')),
                'Expected named rank controls.');
        } finally {await ui.context?.close({animate: false});}
    });
    return {versions: {foundry: game.version, system: game.system.version, core: game.modules.get('token-action-hud-core').version}, results};
}
