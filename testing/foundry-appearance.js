// Read rendered appearance; temporary DOM probes do not change actor documents.
export async function runSmokeTests() {
    if (!game.user.isGM || game.world.id !== 'hud-regression-tests') throw new Error('Isolated GM test world required.');
    const app = game.tokenActionHud;
    canvas.tokens.releaseAll();
    canvas.tokens.placeables.find(token => token.actor.type === 'character').control();
    await ui.context?.close({animate: false});
    await app.update();
    await app.render({force: true});
    const results = [];
    const samples = [];
    const check = (condition, message) => {if (!condition) throw new Error(message);};
    const record = async (name, run) => {
        try {await run(); results.push({name, passed: true});}
        catch (error) {results.push({name, passed: false, error: error.message});}
    };
    await record('Group artwork retains its natural aspect ratio', () => {
        const images = [...app.element.querySelectorAll('.tah-group-button img')];
        check(images.some(image => image.naturalWidth !== image.naturalHeight), 'Missing non-square fixture artwork.');
        for (const image of images) {
            const style = getComputedStyle(image);
            check(style.objectFit === 'contain', 'Group artwork may stretch.');
            check(style.flexShrink === '0', 'Group image slot may shrink.');
        }
    });
    await record('Action artwork fits its slot without distortion', () => {
        for (const image of app.element.querySelectorAll('.tor2e-action .tah-button-image')) {
            const style = getComputedStyle(image);
            check(style.backgroundSize === 'contain' && style.flexShrink === '0', 'Action image may stretch.');
        }
    });
    await record('Toggle controls expose pressed state without depending on color', () => {
        const toggles = [...app.element.querySelectorAll('.tor2e-action.toggle')];
        check(toggles.length, 'No toggle fixture.');
        check(toggles.every(button => button.getAttribute('aria-pressed') === String(button.classList.contains('active'))),
            'Toggle pressed state is missing.');
    });
    const button = [...app.element.querySelectorAll('.tor2e-action')].find(button => button.value.startsWith('skill|'));
    const group = button.closest('.tah-tab-group');
    if (!group.classList.contains('hover')) app.toggleGroup(null, group);
    await record('Rendered normal, active and disabled colors are opaque and readable', () => {
        for (const [name, state] of [['normal', ''], ['active', 'toggle active'], ['disabled', 'disabled']]) {
            const probe = button.cloneNode(true);
            probe.className = 'tah-action-button tah-button-box tor2e-action ' + state;
            probe.removeAttribute('data-action');
            button.after(probe);
            try {
                const style = getComputedStyle(probe);
                check(style.opacity === '1', name + ' loses readability through per-button opacity.');
                samples.push({name: name + ' label', foreground: style.color, background: style.backgroundColor, minimum: 4.5});
                const info = probe.querySelector('.tah-info');
                if (info) samples.push({name: name + ' rank', foreground: getComputedStyle(info).color,
                    background: style.backgroundColor, minimum: 4.5});
                if (name === 'active') {
                    check(style.boxShadow === 'none', 'Active state must not add an inset bottom border.');
                    samples.push({name: 'active border', foreground: style.borderTopColor,
                        background: style.backgroundColor, minimum: 3});
                    const mark = getComputedStyle(probe.querySelector('.tah-button-text'), '::after');
                    check(mark.content.includes('✓'), 'Active state lacks a visual checkmark.');
                    samples.push({name: 'active checkmark', foreground: mark.color, background: style.backgroundColor, minimum: 3});
                }
            } finally {probe.remove();}
        }
        const probe = document.createElement('span');
        app.element.append(probe);
        try {
            for (const [name, foreground, background, minimum] of [
                ['hover label', '--tah-button-hover-text-primary-color', '--tah-button-hover-background-color', 4.5],
                ['hover detail', '--tah-button-hover-text-secondary-color', '--tah-button-hover-background-color', 4.5],
                ['muted text', '--tah-text-secondary-color', '--tah-button-background-color', 4.5],
                ['focus ring', '--tor2e-focus', '--tah-button-background-color', 3]
            ]) {
                probe.style.color = `var(${foreground})`;
                probe.style.backgroundColor = `var(${background})`;
                const style = getComputedStyle(probe);
                samples.push({name, foreground: style.color, background: style.backgroundColor, minimum});
            }
        } finally {probe.remove();}
    });
    await record('Explicit light, high-contrast and custom palettes remain separate', async () => {
        const original = app.setting.style;
        const position = {left: app.position.left, top: app.position.top};
        try {
            for (const style of ['foundryVttLight', 'highContrast', 'custom']) {
                await game.settings.set('token-action-hud-core', 'style', style);
                await app.render({force: true});
                check(!getComputedStyle(app.element).getPropertyValue('--tor2e-hud-surface').trim(),
                    'Default palette leaked into ' + style);
                check(getComputedStyle(app.element.querySelector('.tah-group-button img')).objectFit === 'contain',
                    'Artwork lost its aspect-ratio protection in ' + style);
            }
        } finally {
            await game.settings.set('token-action-hud-core', 'style', original);
            await app.render({force: true});
            app.setPosition(position);
        }
    });
    await record('Independent HUD palette stays stable across character sheet themes', () => {
        const dark = document.body.classList.contains('theme-dark');
        const light = document.body.classList.contains('theme-light');
        const originalSurface = getComputedStyle(app.element).getPropertyValue('--tor2e-hud-surface').trim();
        const probe = document.createElement('span');
        app.element.append(probe);
        try {
            for (const theme of ['theme-light', 'theme-dark']) {
                document.body.classList.remove('theme-light', 'theme-dark');
                document.body.classList.add(theme);
                const rootStyle = getComputedStyle(app.element);
                check(rootStyle.getPropertyValue('--tor2e-hud-surface').trim()
                    === originalSurface, 'Character sheet theme changed the independent HUD palette.');
                for (const state of ['surface', 'hover', 'active']) {
                    probe.style.color = 'var(--tor2e-hud-text)';
                    probe.style.backgroundColor = `var(--tor2e-hud-${state})`;
                    const style = getComputedStyle(probe);
                    samples.push({name: `${theme} ${state} label`, foreground: style.color, background: style.backgroundColor, minimum: 4.5});
                }
            }
        } finally {
            probe.remove();
            document.body.classList.toggle('theme-dark', dark);
            document.body.classList.toggle('theme-light', light);
        }
    });
    await record('Travel assignment wraps inside a narrow panel without clipping', async () => {
        const button = app.element.querySelector('.travelRole[value$="|guide"]');
        check(button, 'No journey-role fixture.');
        const group = button.closest('.tah-tab-group');
        if (!group.classList.contains('hover')) app.toggleGroup(null, group);
        const probe = button.cloneNode(true);
        probe.removeAttribute('data-action');
        probe.style.width = '190px';
        probe.style.maxWidth = '190px';
        const names = probe.querySelector('.tah-info2');
        names.textContent = 'HUD Test Hero With A Long Family Name';
        button.after(probe);
        try {
            await new Promise(requestAnimationFrame);
            check(names.scrollWidth <= names.clientWidth + 1, 'Assigned character text clips horizontally.');
            check(names.getBoundingClientRect().bottom <= probe.getBoundingClientRect().bottom, 'Assigned character text clips vertically.');
            check(getComputedStyle(names).whiteSpace === 'normal', 'Assigned names cannot wrap.');
        } finally {probe.remove();}
    });
    await record('Ordinary controls retain their existing icon slots', () => {
        const button = [...app.element.querySelectorAll('.tor2e-action')].find(button => button.value.startsWith('skill|'));
        const group = button.closest('.tah-tab-group');
        if (!group.classList.contains('hover')) app.toggleGroup(null, group);
        check(parseFloat(getComputedStyle(button.querySelector('.tah-button-image')).width) === 24, 'Icon slots must retain their size.');
        check(parseFloat(getComputedStyle(app.element.querySelector('.tah-group-button img')).width) === 24, 'Category icon slots must retain their size.');
    });
    await record('Context menu uses the same palette as its source HUD', async () => {
        const button = [...app.element.querySelectorAll('.tor2e-action')].find(button => button.value.startsWith('skill|'));
        const group = button.closest('.tah-tab-group');
        if (!group.classList.contains('hover')) app.toggleGroup(null, group);
        const rect = button.getBoundingClientRect();
        button.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2, clientX: rect.right - 10, clientY: rect.top + 10}));
        const deadline = performance.now() + 3000;
        while (!document.querySelector('#context-menu .context-item')) {
            if (performance.now() > deadline) throw new Error('Native context menu did not open.');
            await new Promise(requestAnimationFrame);
        }
        try {
            const menu = document.querySelector('#context-menu');
            const item = menu.querySelector('.context-item');
            const background = getComputedStyle(menu).backgroundColor;
            check(background === getComputedStyle(button).backgroundColor, 'Menu and HUD surfaces differ.');
            samples.push({name: 'context menu text', foreground: getComputedStyle(item).color, background, minimum: 4.5});
            const icon = item.querySelector('i');
            if (icon) samples.push({name: 'context menu icon', foreground: getComputedStyle(icon).color, background, minimum: 3});
        } finally {await ui.context?.close({animate: false});}
    });
    return {versions: {foundry: game.version, system: game.system.version}, results, samples};
}
