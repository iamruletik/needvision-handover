import {
    Fn,
    abs,
    clamp,
    convertToTexture,
    dot,
    float,
    min,
    mix,
    mod,
    pow,
    screenUV,
    smoothstep,
    step,
    texture,
    toneMapping,
    toneMappingExposure,
    vec2,
    vec4,
    workingToColorSpace,
} from 'three/tsl';
import type { Node, Texture, ToneMapping } from 'three/webgpu';
import { coverTextureUv } from '../../utils/tsl/uv-cover';

const MIRRORED = Fn(([v]: [Node<'vec2'>]) => {
    const m = mod(v, vec2(2, 2));
    const inv = vec2(2, 2).sub(m);
    const bx = step(float(1), m.x);
    const by = step(float(1), m.y);

    return vec2(mix(m.x, inv.x, bx), mix(m.y, inv.y, by));
});

const BARREL_DISTORTION = Fn(([coord, amt]: [Node<'vec2'>, Node<'float'>]) => {
    const cc = coord.sub(float(0.5));
    const dist = dot(cc, cc);

    return coord.add(cc.mul(dist).mul(amt));
});

const BARREL_INFLUENCE_BY_PROGRESS = Fn(([p]: [Node<'float'>]) =>
    min(p.mul(float(2)).saturate(), float(1).sub(p).mul(float(2)).saturate()),
);

export type ScrollTransitionTweaks = {
    borderSharpness: number;
    maxDistort: number;
    bendAmount: number;
    diveLiftMax: number;
    progBias: number;
    noiseInfluence: number;
    noiseTimeScale: number;
    noiseUvScale: number;
};

export const DEFAULT_SCROLL_TRANSITION_TWEAKS: ScrollTransitionTweaks = {
    borderSharpness: 20,
    maxDistort: 0.4,
    bendAmount: -0.15,
    diveLiftMax: -0.3,
    progBias: 0.05,
    noiseInfluence: 0.06,
    noiseTimeScale: 0.04,
    noiseUvScale: 0.1,
};

export type ScrollTransitionTweakUniformNodes = {
    borderSharpness: Node<'float'>;
    maxDistort: Node<'float'>;
    bendAmount: Node<'float'>;
    diveLiftMax: Node<'float'>;
    progBias: Node<'float'>;
    noiseInfluence: Node<'float'>;
    noiseTimeScale: Node<'float'>;
    noiseUvScale: Node<'float'>;
};

export function createScrollTransitionPostOutput(
    fxaaScene: Node,
    underwaterMap: Texture,
    noiseMap: Texture,
    uProgress: Node<'float'>,
    uTime: Node<'float'>,
    tweaks: ScrollTransitionTweakUniformNodes,
    underwaterImageSize: Node<'vec2'>,
    viewportPixelSize: Node<'vec2'>,
    sceneToneMapping: ToneMapping,
    outputColorSpace: string,
): Node {
    const sceneTex = convertToTexture(fxaaScene);
    const underwaterTex = texture(underwaterMap);
    const noiseTex = texture(noiseMap);

    const uMaxDistort = tweaks.maxDistort;
    const uBendAmount = tweaks.bendAmount;
    const diveLiftMax = tweaks.diveLiftMax;

    const sampleTransitionAtUv = Fn(([uvCoord]: [Node<'vec2'>]) => {
        const t = uTime.mul(tweaks.noiseTimeScale);
        const noiseUv = MIRRORED(vec2(uvCoord.x.add(t).mul(tweaks.noiseUvScale), uvCoord.y.add(t)));
        const noise = noiseTex.sample(noiseUv);
        const prog = uProgress.sub(tweaks.progBias).add(noise.g.mul(tweaks.noiseInfluence));
        const interpolation = pow(
            abs(smoothstep(float(0), float(1), prog.mul(2).sub(float(1).sub(uvCoord.y)).add(0.5))),
            tweaks.borderSharpness,
        );
        const pinchFrom = uvCoord.sub(0.5).mul(float(1).sub(interpolation)).add(0.5);
        const pinchTo = uvCoord.sub(0.5).mul(interpolation).add(0.5);
        const fromColor = sceneTex.sample(pinchFrom);
        const diveEase = float(1).sub(uProgress).mul(float(1).sub(uProgress));
        const diveY = pinchTo.y.add(diveLiftMax.mul(diveEase));
        const toUvScreen = vec2(pinchTo.x, clamp(diveY, float(0), float(1)));
        const toUv = coverTextureUv(underwaterImageSize, viewportPixelSize, toUvScreen);
        const toColor = underwaterTex.sample(toUv);
        const sceneTonemapped = toneMapping(sceneToneMapping, toneMappingExposure, fromColor.rgb);
        const mixedRgb = mix(sceneTonemapped.xyz, toColor.rgb, interpolation);

        return vec4(mixedRgb, fromColor.a);
    });

    const screenFxAt = Fn(([uv]: [Node<'vec2'>]) => {
        const barrelInfluence = BARREL_INFLUENCE_BY_PROGRESS(uProgress);

        return sampleTransitionAtUv(BARREL_DISTORTION(uv, uBendAmount.mul(uMaxDistort).mul(barrelInfluence)));
    });

    const out = Fn(() => {
        const uv = screenUV;
        const withFx = screenFxAt(uv);
        const blend = step(float(1e-6), uProgress);
        const sceneSample = sceneTex.sample(uv);
        const sceneTonemapped = toneMapping(sceneToneMapping, toneMappingExposure, sceneSample.rgb);
        const inner = mix(vec4(sceneTonemapped.xyz, sceneSample.a), withFx, blend);

        return workingToColorSpace(inner, outputColorSpace);
    });

    return out();
}
