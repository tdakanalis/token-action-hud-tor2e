import { terser } from 'rollup-plugin-terser'
import multi from '@rollup/plugin-multi-entry'
import copy from 'rollup-plugin-copy'

export default [
    {
        external: ['/systems/tor2e/modules/hud/Tor2eTokenHudExtension.js', '/systems/tor2e/modules/utilities.js', '/systems/tor2e/modules/combat/Tor2eStance.js'],
        input: {
            include: [
                'scripts/*.js'
            ]
        },
        output: {
            format: 'esm',
            file: 'dist/token-action-hud-tor2e.min.js'
        },
        plugins: [
            terser({ keep_classnames: true, keep_fnames: true }),
            multi(),
            copy({
                targets: [
                    { src: 'styles/*.css', dest: 'dist/styles' },
                    { src: 'languages/*.json', dest: 'dist/languages' },
                ]
            })
        ]
    }
]