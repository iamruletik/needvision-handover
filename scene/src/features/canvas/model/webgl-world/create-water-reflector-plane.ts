import { degToRad } from 'three/src/math/MathUtils.js';
import {
    Fn,
    TBNViewMatrix,
    normalViewGeometry,
    positionViewDirection,
    screenUV,
    texture,
    uniform,
    uv,
    vec4,
} from 'three/tsl';
import {
    Color,
    Euler,
    ImageBitmapLoader,
    Mesh,
    MeshStandardNodeMaterial,
    NoColorSpace,
    PlaneGeometry,
    RepeatWrapping,
    type Scene,
    Texture,
    Vector2,
} from 'three/webgpu';
import { staticUrl } from '@/shared/lib/static-url';
import type { Pointer } from '../../utils/Pointer';
import { reflector } from './nodes/ReflectorNode';

export const WATER_NORMAL_MAP_URL = staticUrl('/static/textures/normal-map.jpg');

export type WaterGuiParams = {
    normalScale: number;
    reflectionDistortion: number;
    repeatX: number;
    repeatY: number;
    speed: number;
    roughness: number;
    metalness: number;
    envIblIntensityMultiplier: number;
    waterEnvRotationXDeg: number;
    waterEnvRotationYDeg: number;
    waterEnvRotationZDeg: number;
    color: string;
};

export const DEFAULT_WATER_GUI: WaterGuiParams = {
    normalScale: 0.05,
    reflectionDistortion: 0.015,
    repeatX: 0.5,
    repeatY: 1,
    speed: 0.5,
    roughness: 0.1,
    metalness: 0,
    envIblIntensityMultiplier: 0.15,
    waterEnvRotationXDeg: 0,
    waterEnvRotationYDeg: 0,
    waterEnvRotationZDeg: 0,
    color: '#000000',
};

export type CreateWaterReflectorPlaneParams = {
    scene: Scene;
    waterEnvMap: Texture;
    floorY: number;
    planeWidth: number;
    planeDepth: number;
    pointerHandler?: Pointer;
    waterGui: WaterGuiParams;
    /** Только объекты с `userData.reflection === true` (и свет сцены) в RT отражения. */
    filterReflectionByUserData?: boolean;
};

export function createWaterReflectorPlane(params: CreateWaterReflectorPlaneParams): {
    mesh: Mesh;
    update: (elapsedTime: number) => void;
    applyWaterMaterial: () => void;
    setEnvMapIntensity: (intensity: number) => void;
    setWaterEnvMap: (tex: Texture) => void;
    dispose: () => void;
} {
    const { scene, waterEnvMap, planeWidth, planeDepth, pointerHandler, waterGui, filterReflectionByUserData } = params;

    const reflectionDistortionUniform = uniform(waterGui.reflectionDistortion);
    const waterTintUniform = uniform(new Color(waterGui.color));

    const reflection = reflector({
        resolutionScale: 0.5,
        bounces: false,
        ...(filterReflectionByUserData ? { filterReflectionByUserData: true } : {}),
    });

    const normalMap = new Texture();

    normalMap.colorSpace = NoColorSpace;
    normalMap.wrapS = normalMap.wrapT = RepeatWrapping;

    const loader = new ImageBitmapLoader();

    loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });

    loader.load(WATER_NORMAL_MAP_URL, (imageBitmap) => {
        normalMap.image = imageBitmap;
        normalMap.flipY = false;
        normalMap.needsUpdate = true;
    });

    const normalMapForReflection = texture(normalMap, uv());

    normalMapForReflection.updateMatrix = true;

    const material = new MeshStandardNodeMaterial({
        roughness: waterGui.roughness,
        metalness: waterGui.metalness,
        envMap: waterEnvMap,
        envMapIntensity: waterGui.envIblIntensityMultiplier,
        envMapRotation: new Euler(degToRad(-125), degToRad(-180), degToRad(39)),
        transparent: true,
        normalMap,
        normalScale: new Vector2(waterGui.normalScale, waterGui.normalScale),
    });

    const applyWaterMaterial = () => {
        material.normalScale.set(waterGui.normalScale, waterGui.normalScale);
        normalMap.repeat.set(waterGui.repeatX, waterGui.repeatY);
        reflectionDistortionUniform.value = waterGui.reflectionDistortion;
        material.roughness = waterGui.roughness;
        material.metalness = waterGui.metalness;
        material.color.set(new Color(waterGui.color));
        waterTintUniform.value.set(waterGui.color);

        const d2r = Math.PI / 180;

        material.envMapRotation.set(
            waterGui.waterEnvRotationXDeg * d2r,
            waterGui.waterEnvRotationYDeg * d2r,
            waterGui.waterEnvRotationZDeg * d2r,
            material.envMapRotation.order,
        );
        material.envMapIntensity = waterGui.envIblIntensityMultiplier;
    };

    applyWaterMaterial();

    const setEnvMapIntensity = (intensity: number) => {
        material.envMapIntensity = intensity;
    };

    material.colorNode = Fn(() => {
        const normalTS = normalMapForReflection.rgb.mul(2).sub(1);
        const nMap = (TBNViewMatrix as unknown as { mul: (v: typeof normalTS) => typeof normalTS })
            .mul(normalTS)
            .normalize();
        const nGeom = normalViewGeometry.normalize();
        const incident = positionViewDirection.negate();
        const rGeom = incident.reflect(nGeom);
        const rMap = incident.reflect(nMap);
        const deltaReflect = rMap.sub(rGeom);
        const baseReflectionUv = reflection.uvNode ?? screenUV.flipX();
        const reflectionUv = baseReflectionUv.add(deltaReflect.xy.mul(reflectionDistortionUniform));

        const reflectionRgb = reflection.sample(reflectionUv).rgb;
        const waterTint = waterTintUniform.mul(0.12);
        const rgb = waterTint.add(reflectionRgb);

        return vec4(rgb, 1);
    })();

    const mesh = new Mesh(new PlaneGeometry(planeWidth, planeDepth), material);

    mesh.frustumCulled = false;
    mesh.name = 'WaterReflector';
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = 70;
    mesh.position.y = -0.2;
    mesh.geometry.computeTangents();

    mesh.add(reflection.target);

    scene.add(mesh);
    pointerHandler?.setGroundMesh(mesh);
    pointerHandler?.setHorizontalPlaneFallbackY(mesh.position.y);

    return {
        mesh,
        update: (elapsedTime: number) => {
            normalMap.offset.x = elapsedTime * waterGui.speed;
        },
        applyWaterMaterial,
        setEnvMapIntensity,
        setWaterEnvMap: (tex: Texture) => {
            material.envMap = tex;
            (material as MeshStandardNodeMaterial & { waterEnvKey?: string }).waterEnvKey = tex.uuid;
            material.needsUpdate = true;
        },
        dispose: () => {
            pointerHandler?.setHorizontalPlaneFallbackY(null);
            reflection.dispose();
            normalMap.dispose();
            material.dispose();
            mesh.geometry.dispose();

            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
        },
    };
}
