"""Run native Foundry smoke checks through the Orca browser and retain a receipt."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--page', required=True, help='Orca browser page id for the isolated GM world')
parser.add_argument('--output', required=True, type=Path)
modes = parser.add_mutually_exclusive_group()
modes.add_argument('--player', action='store_true', help='Run permission checks as the isolated fixture Player')
modes.add_argument('--appearance', action='store_true', help='Inspect rendered icon sizing and palette as the isolated GM')
args = parser.parse_args()
expression = '''(async () => {
    if (!game.ready) await new Promise(resolve => Hooks.once("ready", resolve));
    if (!canvas.ready) await new Promise(resolve => Hooks.once("canvasReady", resolve));
    const deadline = performance.now() + 10000;
    while (!game.tokenActionHud?.hudManager) {
        if (performance.now() > deadline) throw new Error("HUD did not initialize.");
        await new Promise(requestAnimationFrame);
    }
    const {runSmokeTests} = await import("/modules/token-action-hud-tor2e/testing/foundry-smoke.js");
    return await runSmokeTests();
})()'''
if args.player:
    expression = expression.replace('foundry-smoke.js', 'foundry-player-smoke.js')
if args.appearance:
    expression = expression.replace('foundry-smoke.js', 'foundry-appearance.js')
cli = os.environ.get('ORCA_CLI_COMMAND') or 'orca-ide'
reply = subprocess.run([cli, 'eval', '--page', args.page, '--expression', expression, '--json'],
                       text=True, capture_output=True, timeout=60)
try:
    envelope = json.loads(reply.stdout)
    if not envelope.get('ok'):
        print(json.dumps(envelope, indent=2))
        sys.exit(1)
    result = json.loads(envelope['result']['result'])
except (ValueError, KeyError):
    print(reply.stdout)
    print(reply.stderr, file=sys.stderr)
    sys.exit(1)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
failures = [test for test in result['results'] if not test['passed']]
print(json.dumps({'versions': result['versions'], 'passed': len(result['results']) - len(failures),
                  'failures': failures, 'receipt': str(args.output)}, indent=2))
sys.exit(bool(failures))
