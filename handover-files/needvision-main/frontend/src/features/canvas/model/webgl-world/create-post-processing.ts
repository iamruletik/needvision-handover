import BloomNode, { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import {
    Fn,
    convertToTexture,
    emissive,
    float,
    length,
    mix,
    mrt,
    output,
    pass,
    screenUV,
    smoothstep,
    uniform,
    vec3,
    vec4,
} from 'three/tsl';
import {
    BlendMode,
    type Layers,
    MaterialBlending,
    type MeshBasicNodeMaterial,
    type Node,
    type PerspectiveCamera,
    RenderPipeline,
    type Scene,
    type Texture,
    Vector2,
    type WebGPURenderer,
} from 'three/webgpu';
import { type SpotVolumetricConeUniformsJs, createSpotVolumetricConeMaterial } from './create-spot-volumetric-cone';
import { type ScrollTransitionTweaks, createScrollTransitionPostOutput } from './scroll-transition-post-tsl';

export type EmissiveBloomGuiParams = {
    strength: number;
    radius: number;
    threshold: number;
};

export type CreateWorldPostProcessingParams = {
    renderer: WebGPURenderer;
    scene: Scene;
    camera: PerspectiveCamera;
    volumetricLayer: Layers;
    volumetricLightingIntensity: Node<'float'>;
    resolutionScale?: number;
    volumetricAttenuation: number;
    volumetricAnglePower: number;
    volumetricDepthContactSoftness: number;
    volumetricConeBaseFade: number;
    volumetricConeApexRadius: number;
    volumetricLightColor: string | number;
    underwaterTexture: Texture;
    noiseTexture: Texture;
    scrollTransitionGui: ScrollTransitionTweaks;
    emissiveBloomGui: EmissiveBloomGuiParams;
};

export function createWorldPostProcessing(params: CreateWorldPostProcessingParams): {
    postProcessing: RenderPipeline;
    volumetricPass: { setResolutionScale(scale: number): void };
    volumetricMaterial: MeshBasicNodeMaterial;
    volumetricConeUniforms: SpotVolumetricConeUniformsJs;
    scrollTransitionProgress: ReturnType<typeof uniform>;
    scrollTransitionTime: ReturnType<typeof uniform>;
    scrollTransitionTweakUniforms: {
        borderSharpness: ReturnType<typeof uniform>;
        maxDistort: ReturnType<typeof uniform>;
        bendAmount: ReturnType<typeof uniform>;
        diveLiftMax: ReturnType<typeof uniform>;
        progBias: ReturnType<typeof uniform>;
        noiseInfluence: ReturnType<typeof uniform>;
        noiseTimeScale: ReturnType<typeof uniform>;
        noiseUvScale: ReturnType<typeof uniform>;
    };
    scrollTransitionUnderwaterImageSize: ReturnType<typeof uniform>;
    scrollTransitionViewportPixelSize: ReturnType<typeof uniform>;
    experienceRevealUniforms: {
        reveal: ReturnType<typeof uniform>;
        center: ReturnType<typeof uniform>;
        maxRadius: ReturnType<typeof uniform>;
        edgeSoftness: ReturnType<typeof uniform>;
    };
    emissiveBloom: BloomNode;
} {
    const {
        renderer,
        scene,
        camera,
        volumetricLayer,
        volumetricLightingIntensity,
        resolutionScale = 0.2,
        volumetricAttenuation,
        volumetricAnglePower,
        volumetricDepthContactSoftness,
        volumetricConeBaseFade,
        volumetricConeApexRadius,
        volumetricLightColor,
        underwaterTexture,
        noiseTexture,
        scrollTransitionGui,
        emissiveBloomGui,
    } = params;

    const scrollTransitionProgress = uniform(0);
    const scrollTransitionTime = uniform(0);

    const scrollTransitionTweakUniforms = {
        borderSharpness: uniform(scrollTransitionGui.borderSharpness),
        maxDistort: uniform(scrollTransitionGui.maxDistort),
        bendAmount: uniform(scrollTransitionGui.bendAmount),
        diveLiftMax: uniform(scrollTransitionGui.diveLiftMax),
        progBias: uniform(scrollTransitionGui.progBias),
        noiseInfluence: uniform(scrollTransitionGui.noiseInfluence),
        noiseTimeScale: uniform(scrollTransitionGui.noiseTimeScale),
        noiseUvScale: uniform(scrollTransitionGui.noiseUvScale),
    };

    const uwImg = underwaterTexture?.image as { width?: number; height?: number } | undefined;
    const uwW = typeof uwImg?.width === 'number' && uwImg.width > 0 ? uwImg.width : 1;
    const uwH = typeof uwImg?.height === 'number' && uwImg.height > 0 ? uwImg.height : 1;
    const scrollTransitionUnderwaterImageSize = uniform(new Vector2(uwW, uwH));

    const viewportPx = new Vector2();

    renderer.getSize(viewportPx);
    const scrollTransitionViewportPixelSize = uniform(viewportPx);

    const postProcessing = new RenderPipeline(renderer);

    postProcessing.outputColorTransform = false;

    const scenePass = pass(scene, camera);
    const sceneMrt = mrt({
        output,
        emissive,
    });

    sceneMrt.setBlendMode('emissive', new BlendMode(MaterialBlending));
    scenePass.setMRT(sceneMrt);
    const sceneDepth = scenePass.getTextureNode('depth');
    const sceneDepthSample = sceneDepth.sample(screenUV);

    const { material: volumetricMaterial, uniforms: volumetricConeUniforms } = createSpotVolumetricConeMaterial({
        sceneDepthSample,
        attenuation: volumetricAttenuation,
        anglePower: volumetricAnglePower,
        depthContactSoftness: volumetricDepthContactSoftness,
        coneBaseFade: volumetricConeBaseFade,
        coneApexRadius: volumetricConeApexRadius,
        lightColor: volumetricLightColor,
    });

    const volumetricPass = pass(scene, camera, { depthBuffer: false });

    volumetricPass.name = 'Volumetric Lighting';
    volumetricPass.setLayers(volumetricLayer);
    volumetricPass.setResolutionScale(resolutionScale);

    const emissiveBloom = bloom(
        scenePass.getTextureNode('emissive'),
        emissiveBloomGui.strength,
        emissiveBloomGui.radius,
        emissiveBloomGui.threshold,
    );

    const scenePassColor = scenePass.add(volumetricPass.mul(volumetricLightingIntensity)).add(emissiveBloom);

    const fxaaPass = fxaa(scenePassColor);

    const scrollTransitionOutput = createScrollTransitionPostOutput(
        fxaaPass,
        underwaterTexture,
        noiseTexture,
        scrollTransitionProgress,
        scrollTransitionTime,
        scrollTransitionTweakUniforms,
        scrollTransitionUnderwaterImageSize,
        scrollTransitionViewportPixelSize,
        renderer.toneMapping,
        renderer.outputColorSpace,
    );
    const scrollTransitionTex = convertToTexture(scrollTransitionOutput);

    const experienceRevealUniform = uniform(0);
    const experienceVignetteCenter = uniform(new Vector2(0.5, 0.5));
    const experienceVignetteMaxRadius = uniform(Math.SQRT2);
    const experienceVignetteEdgeSoftness = uniform(0.08);

    const experienceRevealUniforms = {
        reveal: experienceRevealUniform,
        center: experienceVignetteCenter,
        maxRadius: experienceVignetteMaxRadius,
        edgeSoftness: experienceVignetteEdgeSoftness,
    };

    const experienceRevealOutput = Fn(() => {
        const uv = screenUV;
        const c = scrollTransitionTex.sample(uv);
        const dist = length(uv.sub(experienceVignetteCenter));
        const t = experienceRevealUniform.mul(experienceVignetteMaxRadius);
        const mask = smoothstep(t.sub(experienceVignetteEdgeSoftness), t.add(experienceVignetteEdgeSoftness), dist);
        const sceneAlpha = experienceRevealUniform.mul(float(1).sub(mask));
        const rgb = mix(vec3(0), c.rgb, sceneAlpha);

        return vec4(rgb, c.a);
    });

    postProcessing.outputNode = experienceRevealOutput();

    return {
        postProcessing,
        volumetricPass,
        volumetricMaterial,
        volumetricConeUniforms,
        scrollTransitionProgress,
        scrollTransitionTime,
        scrollTransitionTweakUniforms,
        scrollTransitionUnderwaterImageSize,
        scrollTransitionViewportPixelSize,
        experienceRevealUniforms,
        emissiveBloom,
    };
}

export type { ScrollTransitionTweaks } from './scroll-transition-post-tsl';
export { DEFAULT_SCROLL_TRANSITION_TWEAKS } from './scroll-transition-post-tsl';
