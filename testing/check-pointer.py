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


category = evaluate('''(async()=>{
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
move(category)
action = evaluate('''(()=>{
    const button=[...game.tokenActionHud.element.querySelectorAll('.tor2e-action')].find(e=>e.value.startsWith('skill|'));
    if(game.tokenActionHud.element.querySelector('.fa-ellipsis')) throw new Error('Dots must not be rendered.');
    const rect=button.getBoundingClientRect();
    const point={x:rect.x+rect.width/2,y:rect.y+rect.height/2};
    if (!button.contains(document.elementFromPoint(point.x,point.y))) throw new Error('Action is not the pointer target.');
    return point;
})()''')
move(action)
browser('mouse', 'down', '--button', 'right')
browser('mouse', 'up', '--button', 'right')
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
    const button=app.element.querySelector('.tor2e-action.context');
    if(!button?.checkVisibility() || Number(getComputedStyle(app.element).opacity)!==1) throw new Error('Source HUD disappeared or faded.');
    const labels=document.querySelector('#context-menu').textContent;
    if(!labels.includes(game.i18n.localize('tokenActionHud.tor2e.actions.increaseRank'))) throw new Error('Rank commands missing.');
    await ui.context.close({animate:false});
    return {versions:{foundry:game.version,system:game.system.version},
        results:[{name:'Real right-click opens menu without rolling and preserves source HUD',passed:true}]};
})()''')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
