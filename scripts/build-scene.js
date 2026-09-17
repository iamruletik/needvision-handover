//Builds the 3D scene (scene/ folder, pnpm + Astro) and copies the artifacts into
//public/ so our Vite server (dev) and the production deploy serve them.
//Dev:  npm run scene:build        (uses scene/.env — localhost)
//Prod: npm run scene:build:prod   (bakes the GitHub Pages URL instead)
//
//Paths matter: built app.js imports /assets/World.js relative to its own origin,
//so bundles must live under public/assets/. Runtime asset fetches use the
//PUBLIC_STATIC_BASE origin baked in at build time.
//
//Deliberately NOT copied: static/draco (decoders come from Google CDN),
//static/gltf/city5.3.glb (uncompressed source, runtime loads the _opt one),
//six unreferenced video variants (~30MB of leftovers).

import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCTION_STATIC_BASE } from '../vite.config.js'

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

const isProd = process.argv.includes('--prod')
//Prod serves runtime assets from Google Cloud Storage; dev serves them from our
//own Vite server. No trailing slash — the scene appends its own leading slash.
const staticBase = isProd ? PRODUCTION_STATIC_BASE.replace(/\/$/, '') : undefined

console.log(`Building scene${isProd ? ' (production)' : ''}...`)
execSync('pnpm build', {
    cwd: SCENE_DIR,
    stdio: 'inherit',
    //Only override when prod — dev keeps using scene/.env as-is
    env: staticBase ? { ...process.env, PUBLIC_STATIC_BASE: staticBase } : process.env,
})

console.log('Copying bundles to public/assets...')
rmSync('public/assets', { recursive: true, force: true })
cpSync(join(BUILD_DIR, 'assets'), 'public/assets', { recursive: true })

//Prod loads these ~25MB from Google Cloud Storage, so they must NOT land in public/
//(Vite copies public/ into dist/, which is what gets uploaded to Pages).
//Dev serves them from our own Vite server, so there they are still copied.
rmSync('public/static', { recursive: true, force: true })

if (isProd) {
    console.log(`Skipping static assets — production loads them from ${staticBase}`)
    console.log('Scene ready: public/assets')
} else {
    console.log('Copying static assets to public/static...')
    for (let path of STATIC_COPY_LIST) {
        let target = join('public', path)
        mkdirSync(join(target, '..'), { recursive: true })
        cpSync(join(BUILD_DIR, path), target)
    }
    console.log('Scene ready: public/assets + public/static')
}
