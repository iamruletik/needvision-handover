//Builds the 3D scene (scene/ folder, pnpm + Astro) and copies the artifacts into
//public/ so our Vite server (dev) and the production deploy serve them.
//Run after changing anything in scene/: npm run scene:build
//
//Paths matter: built app.js imports /assets/World.js relative to its own origin,
//so bundles must live under public/assets/. Runtime asset fetches use the
//PUBLIC_STATIC_BASE origin baked at build time (scene/.env).
//
//Deliberately NOT copied: static/draco (decoders come from Google CDN),
//static/gltf/city5.3.glb (uncompressed source, runtime loads the _opt one),
//six unreferenced video variants (~30MB of leftovers).

import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const SCENE_DIR = 'scene'
const BUILD_DIR = join(SCENE_DIR, 'build')

const STATIC_COPY_LIST = [
    'static/gltf/city5.3_opt.glb',
    'static/textures/gradient-noise.jpg',
    'static/textures/normal-map.jpg',
    'static/textures/hdri/sunset_in_the_chalk_quarry_1k.hdr',
    'static/textures/hdri/ferndale_studio_08_1k.hdr',
    'static/videos/underwater2_264.af',
    'static/videos/underwater2_264_gov1.af',
    'static/videos/underwater2_265.af',
    'static/videos/underwater2_265_gov1.af',
]

console.log('Building scene...')
execSync('pnpm build', { cwd: SCENE_DIR, stdio: 'inherit' })

console.log('Copying bundles to public/assets...')
rmSync('public/assets', { recursive: true, force: true })
cpSync(join(BUILD_DIR, 'assets'), 'public/assets', { recursive: true })

console.log('Copying static assets to public/static...')
rmSync('public/static', { recursive: true, force: true })
for (let path of STATIC_COPY_LIST) {
    let target = join('public', path)
    mkdirSync(join(target, '..'), { recursive: true })
    cpSync(join(BUILD_DIR, path), target)
}

console.log('Scene ready: public/assets + public/static')
