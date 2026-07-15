import { MathUtils, Scene, SpotLight, Vector3 } from 'three/webgpu';
import { remap } from '@/shared/lib/math/remap';
import {
    COLOR,
    LAYER_VOLUMETRIC_LIGHTING,
    SCROLL_SPOT_RAMP_END,
    SCROLL_SPOT_RAMP_START,
    SPOTLIGHT_POSITION,
    SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE,
} from './constants';

export const SCROLL_SPOT_ANGLE_DEG_TARGET = 50;
export const SCROLL_SPOT_DECAY_TARGET = 0.5;

export function getScrollSpotRampT(scroll: number): number {
    return MathUtils.clamp(remap(scroll, [SCROLL_SPOT_RAMP_START, SCROLL_SPOT_RAMP_END], [0, 1]), 0, 1);
}

export function getSpotConeStaticBlendT(scroll: number): number {
    if (scroll <= SCROLL_SPOT_RAMP_START) return 0;

    if (scroll >= SCROLL_SPOT_RAMP_END) return 1;
    const tLinear = getScrollSpotRampT(scroll);

    return MathUtils.smoothstep(tLinear, 0, 1);
}

export function getSpotAngleDecayForScroll(
    scroll: number,
    baseAngleDeg: number,
    baseDecay: number,
): { angleRad: number; decay: number } {
    const baseAngleRad = (baseAngleDeg * Math.PI) / 180;
    const endAngleRad = (SCROLL_SPOT_ANGLE_DEG_TARGET * Math.PI) / 180;

    if (scroll < SCROLL_SPOT_RAMP_START) {
        return { angleRad: baseAngleRad, decay: baseDecay };
    }

    if (scroll >= SCROLL_SPOT_RAMP_END) {
        return { angleRad: endAngleRad, decay: SCROLL_SPOT_DECAY_TARGET };
    }

    const t = getScrollSpotRampT(scroll);

    return {
        angleRad: MathUtils.lerp(baseAngleRad, endAngleRad, t),
        decay: MathUtils.lerp(baseDecay, SCROLL_SPOT_DECAY_TARGET, t),
    };
}

export type SpotLightConfig = {
    color: string;
    intensity: number;
    decay: number;
    angleDeg: number;
    penumbra: number;
};

export type SetupSceneLightsParams = {
    scene: Scene;
    spotLightParams: SpotLightConfig;
    spotLightTargetSmooth: Vector3;
    pointerScenePointer: Vector3;
};

export function setupSceneLights(params: SetupSceneLightsParams): SpotLight {
    const { scene, spotLightParams, spotLightTargetSmooth, pointerScenePointer } = params;

    const spotLight = new SpotLight(COLOR, spotLightParams.intensity);

    spotLight.color.set(spotLightParams.color);
    spotLight.position.copy(SPOTLIGHT_POSITION);
    spotLight.angle = (spotLightParams.angleDeg * Math.PI) / 180;
    spotLight.penumbra = spotLightParams.penumbra;
    spotLight.decay = spotLightParams.decay;
    spotLight.distance = 0;
    spotLight.castShadow = true;
    spotLight.shadow.intensity = 0.3;
    spotLight.shadow.mapSize.width = 256;
    spotLight.shadow.mapSize.height = 256;
    spotLight.shadow.camera.near = 2;
    spotLight.shadow.camera.far = SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE;
    spotLight.shadow.focus = 1;
    spotLight.layers.enable(LAYER_VOLUMETRIC_LIGHTING);
    scene.add(spotLight);
    scene.add(spotLight.target);

    spotLightTargetSmooth.copy(pointerScenePointer);
    spotLight.target.position.copy(spotLightTargetSmooth);
    spotLight.target.updateMatrixWorld();

    return spotLight;
}
