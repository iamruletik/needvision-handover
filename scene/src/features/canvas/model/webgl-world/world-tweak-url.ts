import {
    ACESFilmicToneMapping,
    AgXToneMapping,
    CineonToneMapping,
    CustomToneMapping,
    LinearToneMapping,
    NeutralToneMapping,
    NoToneMapping,
    ReinhardToneMapping,
    type ToneMapping,
} from 'three/webgpu';
import { clamp } from '@/shared/lib/math/clamp';
import type { EmissiveBloomGuiParams } from './create-post-processing';
import type { WaterGuiParams } from './create-water-reflector-plane';
import { DEFAULT_WATER_GUI } from './create-water-reflector-plane';
import type { CityGuiParams } from './load-city-glb';
import { DEFAULT_ROAD_PARAMS, type ParticleRoadTweakGui } from './objects/ParticleRoad';
import { DEFAULT_SCROLL_TRANSITION_TWEAKS } from './scroll-transition-post-tsl';

export const TONE_MAPPING_OPTIONS = {
    None: NoToneMapping,
    Linear: LinearToneMapping,
    Reinhard: ReinhardToneMapping,
    Cineon: CineonToneMapping,
    ACESFilmic: ACESFilmicToneMapping,
    Custom: CustomToneMapping,
    AgX: AgXToneMapping,
    Neutral: NeutralToneMapping,
} as const;

export type ToneMappingOptionName = keyof typeof TONE_MAPPING_OPTIONS;

const TONE_NAME_BY_VALUE = new Map<number, ToneMappingOptionName>(
    (Object.entries(TONE_MAPPING_OPTIONS) as [ToneMappingOptionName, number][]).map(([name, v]) => [v, name]),
);

export function createWorldGuiState() {
    return {
        rendererGui: {
            toneMapping: ACESFilmicToneMapping as ToneMapping,
            toneMappingExposure: 1,
        },
        envGui: {
            intensity: 0.8,
            rotationXDeg: -70,
            rotationYDeg: -117,
            rotationZDeg: -180,
        },
        waterGui: {
            ...DEFAULT_WATER_GUI,
            normalScale: 2,
            reflectionDistortion: 0.04,
            repeatX: 6,
            repeatY: 6,
            speed: 2,
            waterEnvRotationXDeg: -180,
            waterEnvRotationYDeg: 23,
            waterEnvRotationZDeg: 10,
            envIblIntensityMultiplier: 0.6,
            roughness: 0,
            color: '#232323',
        } satisfies WaterGuiParams,
        spotLightParams: {
            color: '#e5c6a0',
            intensity: 30,
            decay: 0.3,
            angleDeg: 30,
            penumbra: 1,
        },
        volumetricGui: {
            attenuation: 20,
            anglePower: 4,
            resolutionScale: 1,
            depthContactSoftness: 10,
            coneBaseFade: 1,
            coneApexRadius: 0.08,
        },
        cityGui: {
            color: '#19140d',
            roughness: 1,
            metalness: 0,
            aoMapIntensity: 3,
            hoverColor: '#f8b46b',
            hoverMix: 0.5,
            hoverEmissive: 0.2,
        } satisfies CityGuiParams,
        emissiveBloomGui: {
            strength: 1,
            radius: 0.2,
            threshold: 0,
        } satisfies EmissiveBloomGuiParams,
        scrollTransitionGui: DEFAULT_SCROLL_TRANSITION_TWEAKS,
        sceneGui: {
            background: '#0c0c0c',
        },
        particleRoadGui: {
            color: DEFAULT_ROAD_PARAMS.color,
            size: DEFAULT_ROAD_PARAMS.size,
            speed: DEFAULT_ROAD_PARAMS.speed,
            spacing: DEFAULT_ROAD_PARAMS.spacing,
        } satisfies ParticleRoadTweakGui,
    };
}

const W = {
    tm: 'wv_tm',
    te: 'wv_te',
    ei: 'wv_ei',
    erx: 'wv_erx',
    ery: 'wv_ery',
    erz: 'wv_erz',
    wns: 'wv_wns',
    wrd: 'wv_wrd',
    wrx: 'wv_wrx',
    wry: 'wv_wry',
    wsp: 'wv_wsp',
    wex: 'wv_wex',
    wey: 'wv_wey',
    wez: 'wv_wez',
    wem: 'wv_wem',
    wr: 'wv_wr',
    wm: 'wv_wm',
    wc: 'wv_wc',
    spc: 'wv_spc',
    spi: 'wv_spi',
    spd: 'wv_spd',
    spa: 'wv_spa',
    spp: 'wv_spp',
    vat: 'wv_vat',
    vap: 'wv_vap',
    vds: 'wv_vds',
    vbf: 'wv_vbf',
    vxr: 'wv_vxr',
    vrs: 'wv_vrs',
    ccr: 'wv_ccr',
    cmg: 'wv_cmg',
    cmt: 'wv_cmt',
    cao: 'wv_cao',
    chc: 'wv_chc',
    chm: 'wv_chm',
    che: 'wv_che',
    ebs: 'wv_ebs',
    ebr: 'wv_ebr',
    ebt: 'wv_ebt',
    sbg: 'wv_sbg',
    prz: 'wv_prz',
    prv: 'wv_prv',
    prm: 'wv_prm',
    prc: 'wv_prc',
} as const;

const N_EPS = 1e-5;

function numEq(a: number, b: number): boolean {
    return Math.abs(a - b) < N_EPS;
}

function colorEq(a: string, b: string): boolean {
    return normalizeHex(a) === normalizeHex(b);
}

function normalizeHex(c: string): string {
    return c.trim().replace(/^#/, '').toLowerCase();
}

function parseNum(s: string | null): number | undefined {
    if (s === null || s === '') {
        return undefined;
    }

    const n = Number(s);

    return Number.isFinite(n) ? n : undefined;
}

export function applyParticleRoadGuiFromSearchParams(search: URLSearchParams, gui: ParticleRoadTweakGui): void {
    const get = (k: string) => search.get(k);
    const prz = parseNum(get(W.prz));

    if (prz !== undefined) {
        gui.size = clamp(prz, 0.05, 6);
    }
    const prv = parseNum(get(W.prv));

    if (prv !== undefined) {
        gui.speed = clamp(prv, 0.001, 3);
    }
    const prm = parseNum(get(W.prm));

    if (prm !== undefined) {
        gui.spacing = clamp(prm, 0.025, 2);
    }
    const prc = get(W.prc);

    if (prc !== null && prc !== '') {
        gui.color = prc.startsWith('#') ? prc : `#${prc}`;
    }
}

export type WorldTweakUrlDeps = {
    rendererGui: { toneMapping: ToneMapping; toneMappingExposure: number };
    envGui: {
        intensity: number;
        rotationXDeg: number;
        rotationYDeg: number;
        rotationZDeg: number;
    };
    waterGui: WaterGuiParams;
    spotLightParams: {
        color: string;
        intensity: number;
        decay: number;
        angleDeg: number;
        penumbra: number;
    };
    volumetricGui: {
        attenuation: number;
        anglePower: number;
        resolutionScale: number;
        depthContactSoftness: number;
        coneBaseFade: number;
        coneApexRadius: number;
    };
    cityGui?: CityGuiParams;
    emissiveBloomGui: EmissiveBloomGuiParams;
    sceneGui: {
        background: string;
    };
    particleRoadGui: ParticleRoadTweakGui;
};

export function applyWorldTweaksFromSearchParams(
    search: URLSearchParams,
    d: WorldTweakUrlDeps,
    opts: { includeCity: boolean },
): void {
    const get = (k: string) => search.get(k);

    const tm = get(W.tm);

    if (tm !== null && tm !== '' && tm in TONE_MAPPING_OPTIONS) {
        d.rendererGui.toneMapping = TONE_MAPPING_OPTIONS[tm as ToneMappingOptionName];
    }
    const te = parseNum(get(W.te));

    if (te !== undefined) {
        d.rendererGui.toneMappingExposure = te;
    }

    const ei = parseNum(get(W.ei));

    if (ei !== undefined) {
        d.envGui.intensity = ei;
    }

    for (const [key, field] of [
        [W.erx, 'rotationXDeg' as const],
        [W.ery, 'rotationYDeg' as const],
        [W.erz, 'rotationZDeg' as const],
    ] as const) {
        const v = parseNum(get(key));

        if (v !== undefined) {
            d.envGui[field] = v;
        }
    }

    const w = d.waterGui;
    const setW = (key: string, apply: (n: number) => void) => {
        const v = parseNum(get(key));

        if (v !== undefined) {
            apply(v);
        }
    };

    setW(W.wns, (n) => {
        w.normalScale = n;
    });
    setW(W.wrd, (n) => {
        w.reflectionDistortion = n;
    });
    setW(W.wrx, (n) => {
        w.repeatX = n;
    });
    setW(W.wry, (n) => {
        w.repeatY = n;
    });
    setW(W.wsp, (n) => {
        w.speed = n;
    });
    setW(W.wex, (n) => {
        w.waterEnvRotationXDeg = n;
    });
    setW(W.wey, (n) => {
        w.waterEnvRotationYDeg = n;
    });
    setW(W.wez, (n) => {
        w.waterEnvRotationZDeg = n;
    });
    setW(W.wem, (n) => {
        w.envIblIntensityMultiplier = n;
    });
    setW(W.wr, (n) => {
        w.roughness = n;
    });
    setW(W.wm, (n) => {
        w.metalness = n;
    });
    const wc = get(W.wc);

    if (wc !== null && wc !== '') {
        w.color = wc.startsWith('#') ? wc : `#${wc}`;
    }

    const sp = d.spotLightParams;
    const spc = get(W.spc);

    if (spc !== null && spc !== '') {
        sp.color = spc.startsWith('#') ? spc : `#${spc}`;
    }
    const spi = parseNum(get(W.spi));

    if (spi !== undefined) {
        sp.intensity = spi;
    }
    const spd = parseNum(get(W.spd));

    if (spd !== undefined) {
        sp.decay = spd;
    }
    const spa = parseNum(get(W.spa));

    if (spa !== undefined) {
        sp.angleDeg = spa;
    }
    const spp = parseNum(get(W.spp));

    if (spp !== undefined) {
        sp.penumbra = spp;
    }

    const vat = parseNum(get(W.vat));

    if (vat !== undefined) {
        d.volumetricGui.attenuation = vat;
    }
    const vap = parseNum(get(W.vap));

    if (vap !== undefined) {
        d.volumetricGui.anglePower = vap;
    }
    const vds = parseNum(get(W.vds));

    if (vds !== undefined) {
        d.volumetricGui.depthContactSoftness = vds;
    }
    const vbf = parseNum(get(W.vbf));

    if (vbf !== undefined) {
        d.volumetricGui.coneBaseFade = vbf;
    }
    const vxr = parseNum(get(W.vxr));

    if (vxr !== undefined) {
        d.volumetricGui.coneApexRadius = vxr;
    }
    const vrs = parseNum(get(W.vrs));

    if (vrs !== undefined) {
        d.volumetricGui.resolutionScale = vrs;
    }

    if (opts.includeCity && d.cityGui) {
        const cg = d.cityGui;
        const ccr = get(W.ccr);

        if (ccr !== null && ccr !== '') {
            cg.color = ccr.startsWith('#') ? ccr : `#${ccr}`;
        }
        const cr = parseNum(get(W.cmg));

        if (cr !== undefined) {
            cg.roughness = cr;
        }
        const cm = parseNum(get(W.cmt));

        if (cm !== undefined) {
            cg.metalness = cm;
        }
        const cao = parseNum(get(W.cao));

        if (cao !== undefined) {
            cg.aoMapIntensity = cao;
        }
        const chc = get(W.chc);

        if (chc !== null && chc !== '') {
            cg.hoverColor = chc.startsWith('#') ? chc : `#${chc}`;
        }
        const chm = parseNum(get(W.chm));

        if (chm !== undefined) {
            cg.hoverMix = chm;
        }
        const che = parseNum(get(W.che));

        if (che !== undefined) {
            cg.hoverEmissive = che;
        }
    }

    const eb = d.emissiveBloomGui;
    const ebs = parseNum(get(W.ebs));

    if (ebs !== undefined) {
        eb.strength = ebs;
    }
    const ebr = parseNum(get(W.ebr));

    if (ebr !== undefined) {
        eb.radius = ebr;
    }
    const ebt = parseNum(get(W.ebt));

    if (ebt !== undefined) {
        eb.threshold = ebt;
    }

    const sbg = get(W.sbg);

    if (sbg !== null && sbg !== '') {
        d.sceneGui.background = sbg.startsWith('#') ? sbg : `#${sbg}`;
    }

    applyParticleRoadGuiFromSearchParams(search, d.particleRoadGui);
}

function toneMappingToParam(tm: ToneMapping): string | undefined {
    return TONE_NAME_BY_VALUE.get(tm);
}

export function worldTweaksSearchParams(d: WorldTweakUrlDeps, opts: { includeCity: boolean }): URLSearchParams {
    const def = createWorldGuiState();
    const out = new URLSearchParams();

    const setNumIfDiff = (key: string, cur: number, base: number) => {
        if (!numEq(cur, base)) {
            out.set(key, String(cur));
        }
    };

    const tmName = toneMappingToParam(d.rendererGui.toneMapping);
    const defTmName = toneMappingToParam(def.rendererGui.toneMapping);

    if (tmName !== defTmName && tmName !== undefined) {
        out.set(W.tm, tmName);
    }
    setNumIfDiff(W.te, d.rendererGui.toneMappingExposure, def.rendererGui.toneMappingExposure);

    setNumIfDiff(W.ei, d.envGui.intensity, def.envGui.intensity);
    setNumIfDiff(W.erx, d.envGui.rotationXDeg, def.envGui.rotationXDeg);
    setNumIfDiff(W.ery, d.envGui.rotationYDeg, def.envGui.rotationYDeg);
    setNumIfDiff(W.erz, d.envGui.rotationZDeg, def.envGui.rotationZDeg);

    const w = d.waterGui;
    const wDef = def.waterGui;

    setNumIfDiff(W.wns, w.normalScale, wDef.normalScale);
    setNumIfDiff(W.wrd, w.reflectionDistortion, wDef.reflectionDistortion);
    setNumIfDiff(W.wrx, w.repeatX, wDef.repeatX);
    setNumIfDiff(W.wry, w.repeatY, wDef.repeatY);
    setNumIfDiff(W.wsp, w.speed, wDef.speed);
    setNumIfDiff(W.wex, w.waterEnvRotationXDeg, wDef.waterEnvRotationXDeg);
    setNumIfDiff(W.wey, w.waterEnvRotationYDeg, wDef.waterEnvRotationYDeg);
    setNumIfDiff(W.wez, w.waterEnvRotationZDeg, wDef.waterEnvRotationZDeg);
    setNumIfDiff(W.wem, w.envIblIntensityMultiplier, wDef.envIblIntensityMultiplier);
    setNumIfDiff(W.wr, w.roughness, wDef.roughness);
    setNumIfDiff(W.wm, w.metalness, wDef.metalness);

    if (!colorEq(w.color, wDef.color)) {
        out.set(W.wc, normalizeHex(w.color));
    }

    const sp = d.spotLightParams;
    const spDef = def.spotLightParams;

    if (!colorEq(sp.color, spDef.color)) {
        out.set(W.spc, normalizeHex(sp.color));
    }
    setNumIfDiff(W.spi, sp.intensity, spDef.intensity);
    setNumIfDiff(W.spd, sp.decay, spDef.decay);
    setNumIfDiff(W.spa, sp.angleDeg, spDef.angleDeg);
    setNumIfDiff(W.spp, sp.penumbra, spDef.penumbra);

    setNumIfDiff(W.vat, d.volumetricGui.attenuation, def.volumetricGui.attenuation);
    setNumIfDiff(W.vap, d.volumetricGui.anglePower, def.volumetricGui.anglePower);
    setNumIfDiff(W.vds, d.volumetricGui.depthContactSoftness, def.volumetricGui.depthContactSoftness);
    setNumIfDiff(W.vbf, d.volumetricGui.coneBaseFade, def.volumetricGui.coneBaseFade);
    setNumIfDiff(W.vxr, d.volumetricGui.coneApexRadius, def.volumetricGui.coneApexRadius);
    setNumIfDiff(W.vrs, d.volumetricGui.resolutionScale, def.volumetricGui.resolutionScale);

    if (opts.includeCity && d.cityGui) {
        const cg = d.cityGui;
        const cgDef = def.cityGui;

        if (!colorEq(cg.color, cgDef.color)) {
            out.set(W.ccr, normalizeHex(cg.color));
        }
        setNumIfDiff(W.cmg, cg.roughness, cgDef.roughness);
        setNumIfDiff(W.cmt, cg.metalness, cgDef.metalness);
        setNumIfDiff(W.cao, cg.aoMapIntensity, cgDef.aoMapIntensity);

        if (!colorEq(cg.hoverColor, cgDef.hoverColor)) {
            out.set(W.chc, normalizeHex(cg.hoverColor));
        }
        setNumIfDiff(W.chm, cg.hoverMix, cgDef.hoverMix);
        setNumIfDiff(W.che, cg.hoverEmissive, cgDef.hoverEmissive);
    }

    const eb = d.emissiveBloomGui;
    const ebDef = def.emissiveBloomGui;

    setNumIfDiff(W.ebs, eb.strength, ebDef.strength);
    setNumIfDiff(W.ebr, eb.radius, ebDef.radius);
    setNumIfDiff(W.ebt, eb.threshold, ebDef.threshold);

    if (!colorEq(d.sceneGui.background, def.sceneGui.background)) {
        out.set(W.sbg, normalizeHex(d.sceneGui.background));
    }

    const pr = d.particleRoadGui;
    const prDef = def.particleRoadGui;

    setNumIfDiff(W.prz, pr.size, prDef.size);
    setNumIfDiff(W.prv, pr.speed, prDef.speed);
    setNumIfDiff(W.prm, pr.spacing, prDef.spacing);

    if (!colorEq(pr.color, prDef.color)) {
        out.set(W.prc, normalizeHex(pr.color));
    }

    return out;
}

export function replaceWorldTweakUrl(d: WorldTweakUrlDeps, opts: { includeCity: boolean }): void {
    const url = new URL(window.location.href);

    for (const k of [...url.searchParams.keys()]) {
        if (k.startsWith('wv_')) {
            url.searchParams.delete(k);
        }
    }
    const wv = worldTweaksSearchParams(d, opts);

    for (const [k, v] of wv) {
        url.searchParams.set(k, v);
    }
    const qs = url.searchParams.toString();
    const next = `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;

    window.history.replaceState(null, '', next);
}
