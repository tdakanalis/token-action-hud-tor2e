"""Exercise right-click with Orca's actual pointer, including leaving the source group."""
import argparse
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--page', required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
cli = os.environ.get('ORCA_CLI_COMMAND') or 'orca-ide'


def browser(*command):
    reply = subprocess.run([cli, *command, '--page', args.page, '--json'],
                           text=True, capture_output=True, timeout=30)
    envelope = json.loads(reply.stdout)
    if not envelope.get('ok'):
        raise RuntimeError(str(envelope))
    return envelope['result']


def evaluate(expression):
    return json.loads(browser('eval', '--expression', expression)['result'])


def move(point):
    browser('mouse', 'move', '--x', str(point['x']), '--y', str(point['y']))


def right_click(point):
    move(point)
    browser('mouse', 'down', '--button', 'right')
    browser('mouse', 'up', '--button', 'right')


def action_point(prefix):
    return evaluate(f"""(async()=>{{
        const deadline=performance.now()+2000;
        while(performance.now()<deadline) {{
            const button=[...game.tokenActionHud.element.querySelectorAll('.tor2e-action')]
                .find(e=>e.value.startsWith('{prefix}'));
            const rect=button.getBoundingClientRect();
            const point={{x:rect.x+rect.width/2,y:rect.y+rect.height/2}};
            if(button.contains(document.elementFromPoint(point.x,point.y))) return point;
            await new Promise(requestAnimationFrame);
        }}
        throw new Error('Action is not the pointer target.');
    }})()""")


category = evaluate('''(async()=>{
    if (!game.ready) await new Promise(resolve=>Hooks.once('ready',resolve));
    if (!canvas.ready) await new Promise(resolve=>Hooks.once('canvasReady',resolve));
    const deadline=performance.now()+10000;
    while (!game.tokenActionHud?.hudManager) {
        if (performance.now()>deadline) throw new Error('HUD did not initialize.');
        await new Promise(requestAnimationFrame);
    }
    if (!game.user.isGM || game.world.id !== 'hud-regression-tests') throw new Error('Isolated GM world required.');
    await ui.context?.close({animate:false});
    canvas.tokens.releaseAll();
    canvas.tokens.placeables.find(t=>t.actor.type==='character').control();
    const app=game.tokenActionHud;
    await app.update(); await app.render({force:true});
    const button=[...app.element.querySelectorAll('.tor2e-action')].find(e=>e.value.startsWith('skill|'));
    const rect=button.closest('.tah-tab-group').querySelector('.tah-group-button').getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
})()''')
# Enter from outside even when the previous run left the pointer over the same
# category coordinates: Core replaces its DOM during render.
move({'x': 10, 'y': 10})
move(category)
right_click(action_point('skill|'))
menu = evaluate('''(async()=>{
    const deadline=performance.now()+3000;
    while(!document.querySelector('#context-menu .context-item')) {
        if(performance.now()>deadline) throw new Error('Real pointer click did not open the menu.');
        await new Promise(requestAnimationFrame);
    }
    if(Object.values(ui.windows).some(a=>a.constructor.name==='Tor2eRollDialog')) throw new Error('Right-click also triggered a roll.');
    const rect=document.querySelector('#context-menu').getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
})()''')
move(menu)
result = evaluate('''(async()=>{
    const app=game.tokenActionHud;
    if(app.element.querySelector('.fa-ellipsis')) throw new Error('Dots must not be rendered.');
    const button=app.element.querySelector('.tor2e-action.context');
    if(!button?.checkVisibility() || Number(getComputedStyle(app.element).opacity)!==1) throw new Error('Source HUD disappeared or faded.');
    const labels=document.querySelector('#context-menu').textContent;
    if(!labels.includes(game.i18n.localize('tokenActionHud.tor2e.actions.increaseRank'))) throw new Error('Rank commands missing.');
    await ui.context.close({animate:false});
    return {versions:{foundry:game.version,system:game.system.version,core:game.modules.get('token-action-hud-core').version},
        results:[{name:'Real right-click opens menu without rolling and preserves source HUD',passed:true}]};
})()''')

category = evaluate('''(async()=>{
    const app=game.tokenActionHud;
    const oldRoot=app.element;
    const hero=canvas.tokens.controlled.find(token=>token.actor?.type==='character');
    canvas.tokens.releaseAll();
    const closeDeadline=performance.now()+2500;
    while(oldRoot.isConnected && performance.now()<closeDeadline) await new Promise(requestAnimationFrame);
    if(oldRoot.isConnected) throw new Error('HUD did not close after token release.');

    hero.control({releaseOthers:true});
    const openDeadline=performance.now()+2500;
    while(!app.element?.isConnected && performance.now()<openDeadline) await new Promise(requestAnimationFrame);
    if(!app.element?.isConnected || app.element===oldRoot) throw new Error('HUD did not rebuild after selection.');
    const rect=app.element.querySelector('.tah-group-button[value="misc"]').getBoundingClientRect();
    return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};
})()''')
move(category)
right_click(action_point('health|'))
evaluate('''(async()=>{
    const deadline=performance.now()+2000;
    while(!document.querySelector('#context-menu .context-item')) {
        if(performance.now()>deadline) throw new Error('Right-click failed after the HUD was rebuilt.');
        await new Promise(requestAnimationFrame);
    }
    const button=game.tokenActionHud.element.querySelector('.tor2e-action.context');
    if(!button?.value.startsWith('health|')) throw new Error('Wrong context menu after HUD rebuild.');
    await ui.context.close({animate:false});
    return true;
})()''')
result['results'].append({'name': 'Right-click opens a new menu after the HUD is closed and rebuilt', 'passed': True})
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
