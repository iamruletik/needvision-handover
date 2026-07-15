import debounce from 'lodash.debounce';
import { Color, type Scene, type SpotLight, type ToneMapping, type WebGPURenderer } from 'three/webgpu';
import type { Pane } from 'tweakpane';
import type { EmissiveBloomGuiParams, createWorldPostProcessing } from './create-post-processing';
import type { SpotVolumetricConeUniformsJs } from './create-spot-volumetric-cone';
import type { WaterGuiParams } from './create-water-reflector-plane';
import type { CityGuiParams } from './load-city-glb';
import {
    HDRI_ENV_FILE_EXTENSIONS,
    fileExtensionFromName,
    isHdriEnvironmentFileExtension,
} from './load-hdri-environment';
import type { ParticleRoadTweakGui } from './objects/ParticleRoad';
import type { ScrollTransitionTweaks } from './scroll-transition-post-tsl';
import {
    TONE_MAPPING_OPTIONS,
    type WorldTweakUrlDeps,
    applyWorldTweaksFromSearchParams,
    replaceWorldTweakUrl,
} from './world-tweak-url';

export type WorldTweakpaneDeps = {
    pane: Pane;
    renderer: WebGPURenderer;
    rendererGui: {
        toneMapping: ToneMapping;
        toneMappingExposure: number;
    };
    spotLightParams: {
        color: string;
        intensity: number;
        decay: number;
        angleDeg: number;
        penumbra: number;
    };
    spotLight?: SpotLight;
    volumetricPass: { setResolutionScale(scale: number): void };
    volumetricGui: {
        attenuation: number;
        anglePower: number;
        resolutionScale: number;
        depthContactSoftness: number;
        coneBaseFade: number;
        coneApexRadius: number;
    };
    volumetricConeUniforms: SpotVolumetricConeUniformsJs;
    emissiveBloomGui: EmissiveBloomGuiParams;
    emissiveBloom: ReturnType<typeof createWorldPostProcessing>['emissiveBloom'];
    scrollTransitionGui: ScrollTransitionTweaks;
    scrollTransitionTweakUniforms: ReturnType<typeof createWorldPostProcessing>['scrollTransitionTweakUniforms'];
    scene: Scene;
    sceneGui: {
        background: string;
    };
    envGui: {
        intensity: number;
        rotationXDeg: number;
        rotationYDeg: number;
        rotationZDeg: number;
    };
    waterGui: WaterGuiParams;
    syncWater: () => void;
    invalidateRenderPipeline: () => void;
    cityGui?: CityGuiParams;
    syncCity?: () => void;
    onHdriFileSelected?: (file: File) => void | Promise<void>;
    onWaterHdriFileSelected?: (file: File) => void | Promise<void>;
    onSpotAngleChanged?: () => void;
    particleRoadGui: ParticleRoadTweakGui;
    syncParticleRoadFromGui: () => void;
    rebuildParticleRoads: () => void;
};

function applyAllWorldTweakDeps(deps: WorldTweakpaneDeps): void {
    const {
        renderer,
        rendererGui,
        scene,
        syncWater,
        spotLightParams,
        spotLight,
        volumetricGui,
        volumetricPass,
        volumetricConeUniforms,
        emissiveBloomGui,
        emissiveBloom,
        scrollTransitionGui,
        scrollTransitionTweakUniforms,
        syncCity,
        cityGui,
        invalidateRenderPipeline,
        sceneGui,
    } = deps;

    renderer.toneMapping = rendererGui.toneMapping;
    renderer.toneMappingExposure = rendererGui.toneMappingExposure;

    if (scene.background instanceof Color) {
        scene.background.set(sceneGui.background);
    } else {
        scene.background = new Color(sceneGui.background);
    }

    syncWater();

    if (spotLight) {
        spotLight.color.set(spotLightParams.color);
        spotLight.intensity = spotLightParams.intensity;
        spotLight.decay = spotLightParams.decay;
        spotLight.angle = (spotLightParams.angleDeg * Math.PI) / 180;
        spotLight.penumbra = spotLightParams.penumbra;
    }
    volumetricConeUniforms.attenuation.value = volumetricGui.attenuation;
    volumetricConeUniforms.anglePower.value = volumetricGui.anglePower;
    volumetricConeUniforms.depthContactSoftness.value = volumetricGui.depthContactSoftness;
    volumetricConeUniforms.coneBaseFade.value = volumetricGui.coneBaseFade;
    volumetricConeUniforms.coneApexRadius.value = volumetricGui.coneApexRadius;
    volumetricConeUniforms.lightColor.value.set(spotLightParams.color);
    volumetricPass.setResolutionScale(volumetricGui.resolutionScale);
    emissiveBloom.strength.value = emissiveBloomGui.strength;
    emissiveBloom.radius.value = emissiveBloomGui.radius;
    emissiveBloom.threshold.value = emissiveBloomGui.threshold;
    scrollTransitionTweakUniforms.borderSharpness.value = scrollTransitionGui.borderSharpness;
    scrollTransitionTweakUniforms.maxDistort.value = scrollTransitionGui.maxDistort;
    scrollTransitionTweakUniforms.bendAmount.value = scrollTransitionGui.bendAmount;
    scrollTransitionTweakUniforms.diveLiftMax.value = scrollTransitionGui.diveLiftMax;
    scrollTransitionTweakUniforms.progBias.value = scrollTransitionGui.progBias;
    scrollTransitionTweakUniforms.noiseInfluence.value = scrollTransitionGui.noiseInfluence;
    scrollTransitionTweakUniforms.noiseTimeScale.value = scrollTransitionGui.noiseTimeScale;
    scrollTransitionTweakUniforms.noiseUvScale.value = scrollTransitionGui.noiseUvScale;

    if (cityGui && syncCity) {
        syncCity();
    }
    invalidateRenderPipeline();
}

function toUrlDeps(deps: WorldTweakpaneDeps): WorldTweakUrlDeps {
    return {
        rendererGui: deps.rendererGui,
        envGui: deps.envGui,
        waterGui: deps.waterGui,
        spotLightParams: deps.spotLightParams,
        volumetricGui: deps.volumetricGui,
        cityGui: deps.cityGui,
        emissiveBloomGui: deps.emissiveBloomGui,
        sceneGui: deps.sceneGui,
        particleRoadGui: deps.particleRoadGui,
    };
}

export function setupWorldTweakpane(deps: WorldTweakpaneDeps): void {
    const {
        pane,
        renderer,
        rendererGui,
        spotLightParams,
        spotLight,
        volumetricGui,
        volumetricPass,
        volumetricConeUniforms,
        emissiveBloomGui,
        emissiveBloom,
        scrollTransitionGui,
        scrollTransitionTweakUniforms,
        scene,
        sceneGui,
        envGui,
        waterGui,
        syncWater,
        invalidateRenderPipeline,
        cityGui,
        syncCity,
        onHdriFileSelected,
        onWaterHdriFileSelected,
        onSpotAngleChanged,
        particleRoadGui,
        syncParticleRoadFromGui,
        rebuildParticleRoads,
    } = deps;

    const syncEmissiveBloomFromGui = () => {
        emissiveBloom.strength.value = emissiveBloomGui.strength;
        emissiveBloom.radius.value = emissiveBloomGui.radius;
        emissiveBloom.threshold.value = emissiveBloomGui.threshold;
    };

    const includeCity = Boolean(cityGui && syncCity);

    applyWorldTweaksFromSearchParams(new URLSearchParams(window.location.search), toUrlDeps(deps), {
        includeCity,
    });
    applyAllWorldTweakDeps(deps);

    const applyRendererFromGui = () => {
        renderer.toneMapping = rendererGui.toneMapping;
        renderer.toneMappingExposure = rendererGui.toneMappingExposure;
        invalidateRenderPipeline();
    };

    const rendererFolder = pane.addFolder({ title: 'Renderer' });

    rendererFolder
        .addBinding(rendererGui, 'toneMapping', { label: 'tone mapping', options: TONE_MAPPING_OPTIONS })
        .on('change', applyRendererFromGui);
    rendererFolder
        .addBinding(rendererGui, 'toneMappingExposure', { min: 0, max: 4, step: 0.05, label: 'exposure' })
        .on('change', applyRendererFromGui);

    const sceneFolder = pane.addFolder({ title: 'Scene' });

    sceneFolder.addBinding(sceneGui, 'background', { view: 'color', label: 'background' }).on('change', () => {
        if (scene.background instanceof Color) {
            scene.background.set(sceneGui.background);
        } else {
            scene.background = new Color(sceneGui.background);
        }
        invalidateRenderPipeline();
    });

    if (cityGui && syncCity) {
        const cityFolder = pane.addFolder({ title: 'City' });

        cityFolder.addBinding(cityGui, 'color', { view: 'color' }).on('change', syncCity);
        cityFolder.addBinding(cityGui, 'roughness', { min: 0, max: 1, step: 0.01 }).on('change', syncCity);
        cityFolder.addBinding(cityGui, 'metalness', { min: 0, max: 1, step: 0.01 }).on('change', syncCity);
        cityFolder
            .addBinding(cityGui, 'aoMapIntensity', { min: 0, max: 20, step: 0.01, label: 'AO intensity' })
            .on('change', syncCity);
        cityFolder.addBinding(cityGui, 'hoverColor', { view: 'color', label: 'hover color' }).on('change', syncCity);
        cityFolder
            .addBinding(cityGui, 'hoverMix', { min: 0, max: 1, step: 0.01, label: 'hover mix' })
            .on('change', syncCity);
        cityFolder
            .addBinding(cityGui, 'hoverEmissive', { min: 0, max: 1.25, step: 0.01, label: 'hover emissive' })
            .on('change', syncCity);
    }

    const particleRoadFolder = pane.addFolder({ title: 'Particle road' });

    particleRoadFolder
        .addBinding(particleRoadGui, 'size', { min: 0.05, max: 6, step: 0.05, label: 'size' })
        .on('change', () => {
            syncParticleRoadFromGui();
            invalidateRenderPipeline();
        });
    particleRoadFolder
        .addBinding(particleRoadGui, 'speed', { min: 0.001, max: 1, step: 0.005, label: 'speed' })
        .on('change', () => {
            syncParticleRoadFromGui();
            invalidateRenderPipeline();
        });
    particleRoadFolder.addBinding(particleRoadGui, 'color', { view: 'color', label: 'color' }).on('change', () => {
        syncParticleRoadFromGui();
        invalidateRenderPipeline();
    });
    particleRoadFolder
        .addBinding(particleRoadGui, 'spacing', { min: 0.025, max: 1, step: 0.005, label: 'spacing' })
        .on('change', () => {
            rebuildParticleRoads();
            invalidateRenderPipeline();
        });

    const applyEnvFromGui = () => {
        syncCity?.();
        syncWater();
    };

    const emissiveBloomFolder = pane.addFolder({ title: 'Emissive bloom' });

    emissiveBloomFolder
        .addBinding(emissiveBloomGui, 'strength', { min: 0, max: 2, step: 0.02, label: 'strength' })
        .on('change', () => {
            syncEmissiveBloomFromGui();
            invalidateRenderPipeline();
        });
    emissiveBloomFolder
        .addBinding(emissiveBloomGui, 'radius', { min: 0, max: 1, step: 0.01, label: 'radius' })
        .on('change', () => {
            syncEmissiveBloomFromGui();
            invalidateRenderPipeline();
        });
    emissiveBloomFolder
        .addBinding(emissiveBloomGui, 'threshold', { min: 0, max: 1, step: 0.01, label: 'threshold' })
        .on('change', () => {
            syncEmissiveBloomFromGui();
            invalidateRenderPipeline();
        });

    const envFolder = pane.addFolder({ title: 'Environment' });

    envFolder
        .addBinding(envGui, 'intensity', { min: 0, max: 4, step: 0.05, label: 'IBL intensity' })
        .on('change', applyEnvFromGui);
    const rotDegOpts = { min: -180, max: 180, step: 1 };

    envFolder
        .addBinding(envGui, 'rotationXDeg', { ...rotDegOpts, label: 'rotation X (deg)' })
        .on('change', applyEnvFromGui);
    envFolder
        .addBinding(envGui, 'rotationYDeg', { ...rotDegOpts, label: 'rotation Y (deg)' })
        .on('change', applyEnvFromGui);
    envFolder
        .addBinding(envGui, 'rotationZDeg', { ...rotDegOpts, label: 'rotation Z (deg)' })
        .on('change', applyEnvFromGui);

    if (onHdriFileSelected) {
        const fileInput = document.createElement('input');

        fileInput.type = 'file';
        fileInput.accept = HDRI_ENV_FILE_EXTENSIONS.map((x) => `.${x}`).join(',');
        fileInput.style.display = 'none';
        pane.element.appendChild(fileInput);

        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];

            fileInput.value = '';

            if (!file) {
                return;
            }
            const ext = fileExtensionFromName(file.name);

            if (!isHdriEnvironmentFileExtension(ext)) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[World tweakpane] Unsupported HDRI extension ".${ext}". Allowed: ${HDRI_ENV_FILE_EXTENSIONS.join(', ')}`,
                );

                return;
            }

            onHdriFileSelected(file);
        });

        envFolder.addButton({ title: 'Upload env map' }).on('click', () => fileInput.click());
    }

    const waterFolder = pane.addFolder({ title: 'Water' });

    if (onWaterHdriFileSelected) {
        const waterFileInput = document.createElement('input');

        waterFileInput.type = 'file';
        waterFileInput.accept = HDRI_ENV_FILE_EXTENSIONS.map((x) => `.${x}`).join(',');
        waterFileInput.style.display = 'none';
        pane.element.appendChild(waterFileInput);

        waterFileInput.addEventListener('change', () => {
            const file = waterFileInput.files?.[0];

            waterFileInput.value = '';

            if (!file) {
                return;
            }
            const ext = fileExtensionFromName(file.name);

            if (!isHdriEnvironmentFileExtension(ext)) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[World tweakpane] Unsupported HDRI extension ".${ext}". Allowed: ${HDRI_ENV_FILE_EXTENSIONS.join(', ')}`,
                );

                return;
            }

            onWaterHdriFileSelected(file);
        });

        waterFolder.addButton({ title: 'Upload water env map' }).on('click', () => waterFileInput.click());
    }
    waterFolder
        .addBinding(waterGui, 'normalScale', { min: 0, max: 2, step: 0.01, label: 'normal scale' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'reflectionDistortion', {
            min: 0,
            max: 0.1,
            step: 0.005,
            label: 'reflect distortion',
        })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'repeatX', { min: 0.05, max: 8, step: 0.01, label: 'repeat X' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'repeatY', { min: 0.05, max: 8, step: 0.01, label: 'repeat Y' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'speed', { min: -3, max: 3, step: 0.05, label: 'scroll speed' })
        .on('change', syncWater);
    const waterEnvRotDegOpts = { min: -180, max: 180, step: 1 };

    waterFolder
        .addBinding(waterGui, 'waterEnvRotationXDeg', { ...waterEnvRotDegOpts, label: 'env rot X (deg)' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'waterEnvRotationYDeg', { ...waterEnvRotDegOpts, label: 'env rot Y (deg)' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'waterEnvRotationZDeg', { ...waterEnvRotDegOpts, label: 'env rot Z (deg)' })
        .on('change', syncWater);
    waterFolder
        .addBinding(waterGui, 'envIblIntensityMultiplier', {
            min: 0,
            max: 8,
            step: 0.05,
            label: 'IBL × (water)',
        })
        .on('change', syncWater);
    waterFolder.addBinding(waterGui, 'roughness', { min: 0, max: 1, step: 0.01 }).on('change', syncWater);
    waterFolder.addBinding(waterGui, 'metalness', { min: 0, max: 1, step: 0.01 }).on('change', syncWater);
    waterFolder.addBinding(waterGui, 'color', { view: 'color' }).on('change', syncWater);

    const spotlightFolder = pane.addFolder({ title: 'Spotlight' });

    spotlightFolder.addBinding(spotLightParams, 'color', { view: 'color' }).on('change', () => {
        spotLight?.color.set(spotLightParams.color);
        volumetricConeUniforms.lightColor.value.set(spotLightParams.color);
    });
    spotlightFolder
        .addBinding(spotLightParams, 'intensity', {
            min: 0,
            max: 400,
            step: 1,
        })
        .on('change', () => {
            if (spotLight) {
                spotLight.intensity = spotLightParams.intensity;
            }
        });
    spotlightFolder
        .addBinding(spotLightParams, 'decay', {
            min: 0,
            max: 3,
            step: 0.1,
        })
        .on('change', () => {
            if (spotLight) {
                spotLight.decay = spotLightParams.decay;
            }
        });
    spotlightFolder
        .addBinding(spotLightParams, 'angleDeg', {
            min: 5,
            max: 90,
            step: 1,
            label: 'angle (deg)',
        })
        .on('change', () => {
            if (spotLight) {
                spotLight.angle = (spotLightParams.angleDeg * Math.PI) / 180;
            }
            onSpotAngleChanged?.();
        });
    spotlightFolder
        .addBinding(spotLightParams, 'penumbra', {
            min: 0,
            max: 1,
            step: 0.01,
        })
        .on('change', () => {
            if (spotLight) {
                spotLight.penumbra = spotLightParams.penumbra;
            }
        });

    const volumetricFolder = pane.addFolder({ title: 'Volumetric' });

    volumetricFolder
        .addBinding(volumetricGui, 'attenuation', {
            min: 0.5,
            max: 50,
            step: 0.1,
            label: 'attenuation',
        })
        .on('change', () => {
            volumetricConeUniforms.attenuation.value = volumetricGui.attenuation;
        });
    volumetricFolder
        .addBinding(volumetricGui, 'anglePower', {
            min: 0.5,
            max: 32,
            step: 0.5,
            label: 'angle power',
        })
        .on('change', () => {
            volumetricConeUniforms.anglePower.value = volumetricGui.anglePower;
        });
    volumetricFolder
        .addBinding(volumetricGui, 'depthContactSoftness', {
            min: 0.5,
            max: 40,
            step: 0.5,
            label: 'depth contact softness',
        })
        .on('change', () => {
            volumetricConeUniforms.depthContactSoftness.value = volumetricGui.depthContactSoftness;
        });
    volumetricFolder
        .addBinding(volumetricGui, 'coneBaseFade', {
            min: 0.1,
            max: 25,
            step: 0.1,
            label: 'cone base fade',
        })
        .on('change', () => {
            volumetricConeUniforms.coneBaseFade.value = volumetricGui.coneBaseFade;
        });
    volumetricFolder
        .addBinding(volumetricGui, 'coneApexRadius', {
            min: 0,
            max: 0.5,
            step: 0.01,
            label: 'cone apex radius',
        })
        .on('change', () => {
            volumetricConeUniforms.coneApexRadius.value = volumetricGui.coneApexRadius;
        });
    volumetricFolder
        .addBinding(volumetricGui, 'resolutionScale', {
            min: 0.05,
            max: 1,
            step: 0.05,
            label: 'pass resolution',
        })
        .on('change', () => {
            volumetricPass.setResolutionScale(volumetricGui.resolutionScale);
            invalidateRenderPipeline();
        });

    const applyScrollTransitionFromGui = () => {
        scrollTransitionTweakUniforms.borderSharpness.value = scrollTransitionGui.borderSharpness;
        scrollTransitionTweakUniforms.maxDistort.value = scrollTransitionGui.maxDistort;
        scrollTransitionTweakUniforms.bendAmount.value = scrollTransitionGui.bendAmount;
        scrollTransitionTweakUniforms.diveLiftMax.value = scrollTransitionGui.diveLiftMax;
        scrollTransitionTweakUniforms.progBias.value = scrollTransitionGui.progBias;
        scrollTransitionTweakUniforms.noiseInfluence.value = scrollTransitionGui.noiseInfluence;
        scrollTransitionTweakUniforms.noiseTimeScale.value = scrollTransitionGui.noiseTimeScale;
        scrollTransitionTweakUniforms.noiseUvScale.value = scrollTransitionGui.noiseUvScale;
        invalidateRenderPipeline();
    };

    const scrollFolder = pane.addFolder({ title: 'Scroll transition' });

    scrollFolder
        .addBinding(scrollTransitionGui, 'borderSharpness', {
            min: 1,
            max: 80,
            step: 0.5,
            label: 'border sharpness',
        })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'maxDistort', { min: 0, max: 1.5, step: 0.01, label: 'max distort' })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'bendAmount', { min: -0.5, max: 0.5, step: 0.005, label: 'bend amount' })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'diveLiftMax', { min: -1, max: 1, step: 0.01, label: 'dive lift' })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'progBias', { min: 0, max: 0.3, step: 0.005, label: 'prog bias' })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'noiseInfluence', {
            min: 0,
            max: 0.3,
            step: 0.005,
            label: 'noise influence',
        })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'noiseTimeScale', {
            min: 0,
            max: 0.2,
            step: 0.002,
            label: 'noise time ×',
        })
        .on('change', applyScrollTransitionFromGui);
    scrollFolder
        .addBinding(scrollTransitionGui, 'noiseUvScale', {
            min: 0.02,
            max: 0.5,
            step: 0.005,
            label: 'noise UV ×',
        })
        .on('change', applyScrollTransitionFromGui);

    const pushUrl = debounce(() => replaceWorldTweakUrl(toUrlDeps(deps), { includeCity }), 320);

    pane.on('change', pushUrl);
}
