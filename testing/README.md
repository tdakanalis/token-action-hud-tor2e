# Developer validation

This is development and review evidence, not the player user guide. Guide and PDF changes wait for functionality and appearance approval.

## Unit tests and build

```sh
npm install
npm test
npm run build
git diff --check
```

Unit tests use Node's module hooks to supply the Foundry-only imports. They were run with Node 22.19.0; Foundry 14 itself needs Node 24. No production system code is copied into the tests.

## Isolated Foundry

Use a separately licensed local Foundry installation and an empty data directory. Do not use the repository's campaign-mounted compose configuration. The review instance uses:

- Foundry 14.367, TOR2E 6.3.0, Token Action HUD Core 2.1.1, socketlib, optional Game Control 2.1.1.
- Application: `/tmp/token-action-hud-tor2e-test/app`.
- Data: `/tmp/token-action-hud-tor2e-test/data`.
- HUD module symlink: `Data/modules/token-action-hud-tor2e` points to this checkout.
- Loopback address: `http://127.0.0.1:30001`.

Use your own licensed Foundry distribution and complete its normal license and setup screens. No licensed application files, keys or campaign data belong in this repository. The existing local test container can be started with `docker start tor2e-hud-test` and stopped with `docker stop tor2e-hud-test`.

For a fresh installation, start Foundry with Node 24:

```sh
node /path/to/foundry/main.mjs --dataPath=/path/to/empty-test-data --port=30001
```

Create a TOR2E world with id `hud-regression-tests`, enable Core, socketlib and this HUD, then launch it as GM. Enable Game Control to run the integration checks. In the browser console:

```js
const fixture = await import('/modules/token-action-hud-tor2e/testing/foundry-fixture.js');
await fixture.createFixture();
// Wait for the synthetic scene to finish loading, then:
await fixture.enrichFixture();
```

Fixtures create five actor types, equipment, a trait, a combat task, company documents, an effect and a separate Player. The enrichment step submits the native Undertaking creation dialog and enables extended Standing in this synthetic world. All mutation scripts refuse to run outside the named world. The Player owns its hero and only observes the Community. Sign that Player in using a separate browser profile; keep the GM connected.

## Browser checks

These scripts use Orca's browser CLI. Set `ORCA_CLI_COMMAND` to the current Orca executable if it is not already exported. Obtain the GM and Player page ids with `orca-ide tab list --json` (or your configured CLI). Reload both pages after changing JavaScript to invalidate the browser module cache.

```sh
python3 testing/run-browser-checks.py --page GM_PAGE_ID --output testing/results/foundry14-tor2e63.json
python3 testing/run-browser-checks.py --page PLAYER_PAGE_ID --player --output testing/results/foundry14-tor2e63-player.json
python3 testing/check-pointer.py --page GM_PAGE_ID --output testing/results/foundry14-tor2e63-pointer.json
```

GM checks run native dialogs, cancel them without submitting rolls or spending resources, restore changed flags and conditions, and delete temporary Macros and Combat. Trait/task cards and optional integration reports remain in the synthetic world's chat. Player checks verify the recovery safeguard, Eye privacy, Observer editing restrictions and owned condition changes. The pointer script uses actual right mouse movement and button presses: it checks menu opening without a roll, absence of dots, and HUD visibility when leaving for the menu.

Receipts record individual results and exact runtime versions. An earlier 6.1.0 diagnostic is retained under `results/archive`; it includes a test synchronization failure and is not final compatibility evidence. Foundry 12–13, TOR2E 4–5 and Core 2.0 have not been validated by this release's complete browser suite. Existing manifest bounds are retained; context menu enhancements require Core 2.1 and native journey-event shortcuts require TOR2E 6.

## Review limits

The system's native sheet can still grant Hope before failing to spend Fellowship Points for an Observer. The HUD guards its own recovery and both rest buttons, warns the player, and requires the Loremaster to perform that action. It does not patch the system or elevate document permissions.

Combat tasks announce the native item card and roll the associated native skill. They do not interpret descriptive rules or automatically resolve a task's consequences. Journey-event rolling uses the native dialog; recording the event remains in the native log sheet. Game Control retains its own dialogs, selection behavior, report formats and progression rules.
