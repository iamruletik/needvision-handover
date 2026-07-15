import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { type GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
    abs,
    attribute,
    convert,
    float,
    length,
    lessThan,
    materialColor,
    max,
    mix,
    mul,
    positionWorld,
    select,
    smoothstep,
    sub,
    uniform,
} from 'three/tsl';
import {
    BufferAttribute,
    Color,
    DoubleSide,
    FrontSide,
    Group,
    ImageBitmapLoader,
    type Material,
    Mesh,
    MeshStandardNodeMaterial,
    type Node,
    type Object3D,
    PerspectiveCamera,
    Texture,
    type UniformNode,
    Vector3,
    WebGPURenderer,
} from 'three/webgpu';
import {
    batchCityBuildingMeshes,
    batchMeshesBySharedMaterial,
    computeBuildingCenters,
    computeBuildingMaxRadiusFromCenter,
} from './batch-city-meshes';
import { CITY_HOVER_RADIAL_EDGE_FRACTION, CITY_HOVER_RADIAL_EDGE_MIN, CITY_HOVER_RADIAL_MASK_MAX } from './constants';
import { setupCityMeshBvhForRaycast } from './setup-city-mesh-bvh';

function tslVec3(node: Node): Node<'vec3'> {
    return convert(node, 'vec3') as Node<'vec3'>;
}

export const CITY_GLB_URL = '/static/gltf/city5.3_opt.glb';

export const CITY_DRACO_DECODER_PATH = '/static/draco/';

/** Имена узлов, которые участвуют в отражении воды (помечаются до батча по материалу) */
export const CITY_REFLECTION_NODE_NAMES = [
    'Palm_ALL',
    'yacht',
    'BatchedCityBuildings',
    'Cylinder002_Baked',
    'Cube003_Baked',
] as const;

/**
 * Прокси Plane* -> здание для hover
 */
const CITY_PLANE_HOVER_LINKS: ReadonlyArray<readonly [readonly string[], string]> = [
    [['Plane'], 'city002'],
    [['Plane002'], 'city003'],
    [['Plane003'], 'city005'],
    [['Plane004'], 'city004'],
    [['Plane005'], 'city006'],
    [['Plane006'], 'city007'],
    [['Plane007'], 'city008'],
    [['Plane008'], 'city009'],
    [['Plane009'], 'city'],
    [['Plane010'], 'city010'],
    [['Plane011'], 'city001'],
    [['Plane012'], 'city011'],
];

function collectCityPlaneHoverTargets(
    root: Object3D,
    buildingIdByCityMeshName: ReadonlyMap<string, number>,
): { meshes: Mesh[]; idByMeshName: ReadonlyMap<string, number> } {
    const meshes: Mesh[] = [];
    const idByMeshName = new Map<string, number>();

    for (const [planeNames, cityMeshName] of CITY_PLANE_HOVER_LINKS) {
        const buildingId = buildingIdByCityMeshName.get(cityMeshName);
        let planeMesh: Mesh | undefined;

        for (const planeName of planeNames) {
            const obj = root.getObjectByName(planeName);

            if (obj instanceof Mesh) {
                planeMesh = obj;
                break;
            }
        }

        if (planeMesh !== undefined && buildingId !== undefined) {
            planeMesh.visible = true;

            if (planeMesh.material) {
                if (Array.isArray(planeMesh.material)) {
                    planeMesh.material = planeMesh.material.map((m) => {
                        const m2 = m.clone();

                        m2.visible = true;
                        m2.side = DoubleSide;

                        return m2;
                    });
                } else {
                    planeMesh.material = planeMesh.material.clone();
                    planeMesh.material.visible = true;
                    planeMesh.material.side = DoubleSide;
                }
            }
            meshes.push(planeMesh);
            idByMeshName.set(planeMesh.name, buildingId);
        }
    }

    return { meshes, idByMeshName };
}

function markCityReflectionNodes(root: Object3D): void {
    for (const name of CITY_REFLECTION_NODE_NAMES) {
        const obj = root.getObjectByName(name);

        if (obj !== undefined) {
            obj.userData.reflection = true;
        }
    }
}

export type CityGuiParams = {
    color: string;
    roughness: number;
    metalness: number;
    aoMapIntensity: number;
    hoverColor: string;
    hoverMix: number;
    hoverEmissive: number;
};

export type CityEnvGuiParams = {
    intensity: number;
    rotationXDeg: number;
    rotationYDeg: number;
    rotationZDeg: number;
};

export type CityFloatUniform = UniformNode<'float', number>;
export type CityVec3Uniform = UniformNode<'vec3', Vector3>;
export type CityColorUniform = UniformNode<'color', Color>;

export type CityGltfHoverUniforms = {
    hoverPrevIdUniform: CityFloatUniform;
    hoverCurrIdUniform: CityFloatUniform;
    hoverTransitionBlendUniform: CityFloatUniform;
    hoverFillPrevUniform: CityFloatUniform;
    hoverFillCurrUniform: CityFloatUniform;
    hoverColorUniform: CityColorUniform;
    hoverMixMaxUniform: CityFloatUniform;
    hoverFogCenterPrev: CityVec3Uniform;
    hoverFogCenterCurr: CityVec3Uniform;
    hoverRadialExtentPrev: CityFloatUniform;
    hoverRadialExtentCurr: CityFloatUniform;
    hoverColoringActiveUniform: CityFloatUniform;
};

function cityBuildingHoverMixNode(hover: CityGltfHoverUniforms): Node<'float'> {
    const {
        hoverPrevIdUniform: prevU,
        hoverCurrIdUniform: currU,
        hoverTransitionBlendUniform: blendU,
        hoverFillPrevUniform: fillPrevU,
        hoverFillCurrUniform: fillCurrU,
        hoverMixMaxUniform: mixMaxU,
        hoverFogCenterPrev: centerPrevU,
        hoverFogCenterCurr: centerCurrU,
        hoverRadialExtentPrev: extentPrevU,
        hoverRadialExtentCurr: extentCurrU,
    } = hover;

    const bid = attribute('buildingId', 'float' as const);
    const eps = float(5e-3);
    const onPrev = lessThan(abs(bid.sub(prevU)), eps);
    const onCurr = lessThan(abs(bid.sub(currU)), eps);
    const maskPrev = select(onPrev, float(1), float(0));
    const maskCurr = select(onCurr, float(1), float(0));

    const P = positionWorld;
    const minEdge = float(CITY_HOVER_RADIAL_EDGE_MIN);
    const edgeFrac = float(CITY_HOVER_RADIAL_EDGE_FRACTION);
    const fEps = float(1e-4);

    const distToCenter = (center: Node<'vec3'>) => length(sub(P, center));

    const radialFill = (d: Node<'float'>, f: Node<'float'>, R: Node<'float'>) => {
        const t = f.mul(R);
        const wEdge = max(R.mul(edgeFrac), minEdge);
        const body = float(1).sub(smoothstep(t, t.add(wEdge), d));

        return select(lessThan(f, fEps), float(0), body);
    };

    const dPrev = distToCenter(centerPrevU);
    const dCurr = distToCenter(centerCurrU);
    const layerPrev = radialFill(dPrev, fillPrevU, extentPrevU);
    const layerCurr = radialFill(dCurr, fillCurrU, extentCurrU);
    const oneM = blendU.oneMinus();
    const termPrev = mul(mul(maskPrev, layerPrev), oneM);
    const termCurr = mul(mul(maskCurr, layerCurr), blendU);
    const radialHover = float(termPrev.add(termCurr));

    return mul(mixMaxU, radialHover);
}

function cityBuildingColorNode(hover: CityGltfHoverUniforms, baseColorUniform: CityColorUniform): Node<'vec3'> {
    const hoverMix = mul(cityBuildingHoverMixNode(hover), hover.hoverColoringActiveUniform);

    return mix(tslVec3(baseColorUniform), tslVec3(hover.hoverColorUniform), hoverMix);
}

function cityBuildingEmissiveNode(hover: CityGltfHoverUniforms, hoverEmissiveUniform: CityFloatUniform): Node<'vec3'> {
    const hoverMix = mul(cityBuildingHoverMixNode(hover), hover.hoverColoringActiveUniform);

    return mul(tslVec3(hover.hoverColorUniform), mul(hoverMix, hoverEmissiveUniform));
}

/**
 * Вешает PMREM на все MeshStandardNodeMaterial города + intensity/rotation.
 * cityEnvKey ломает кэш WebGPU при смене текстуры с теми же sampler-параметрами.
 */
export function applyCityEnvMapToMeshes(
    root: Object3D,
    envMap: Texture | null | undefined,
    envGui: CityEnvGuiParams,
): void {
    if (!envMap) {
        return;
    }

    const d2r = Math.PI / 180;

    root.traverse((obj) => {
        if (!(obj instanceof Mesh)) {
            return;
        }

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

        for (const mat of mats) {
            if (!(mat instanceof MeshStandardNodeMaterial)) {
                continue;
            }

            mat.envMap = envMap;
            mat.envMapIntensity = envGui.intensity;
            mat.envMapRotation.set(
                envGui.rotationXDeg * d2r,
                envGui.rotationYDeg * d2r,
                envGui.rotationZDeg * d2r,
                mat.envMapRotation.order,
            );
            (mat as MeshStandardNodeMaterial & { cityEnvKey?: string }).cityEnvKey = envMap.uuid;
            mat.needsUpdate = true;
        }
    });
}

function applyCityGltfMaterials(
    root: Object3D,
    renderer: WebGPURenderer,
    cityGui: CityGuiParams,
    hover: CityGltfHoverUniforms,
    hoverEmissiveUniform: CityFloatUniform,
): { baseColorUniform: CityColorUniform } {
    const baseColorUniform = uniform(new Color().set(cityGui.color));
    const diffuse = tslVec3(materialColor);

    root.traverse((obj) => {
        if (!(obj instanceof Mesh)) {
            return;
        }

        const mapMaterial = (mat: Material | undefined): Material | undefined => {
            if (!mat || mat.userData.cityGltfMaterialsApplied) {
                return mat;
            }

            const nodeMat = renderer.library.fromMaterial(mat);

            if (!nodeMat) {
                return mat;
            }

            if (nodeMat !== mat) {
                mat.dispose();
            }

            nodeMat.colorNode = diffuse;
            nodeMat.userData.cityGltfMaterialsApplied = true;

            return nodeMat;
        };

        if (Array.isArray(obj.material)) {
            obj.material = obj.material.map((m) => mapMaterial(m)!) as Material[];
        } else {
            const next = mapMaterial(obj.material);

            if (next) {
                obj.material = next;
            }
        }

        const matsForAo = Array.isArray(obj.material) ? obj.material : [obj.material];

        for (const m of matsForAo) {
            if (m instanceof MeshStandardNodeMaterial) {
                m.aoMap = m.map;
                m.aoMapIntensity = cityGui.aoMapIntensity;
            }
        }

        const uv = obj.geometry.getAttribute('uv');

        if (uv && !obj.geometry.getAttribute('uv2')) {
            obj.geometry.setAttribute('uv2', uv);
        }

        if (obj.material instanceof MeshStandardNodeMaterial) {
            obj.material.color.copy(baseColorUniform.value);

            if (obj.geometry.getAttribute('buildingId')) {
                obj.material.colorNode = cityBuildingColorNode(hover, baseColorUniform);
                obj.material.emissiveNode = cityBuildingEmissiveNode(hover, hoverEmissiveUniform);
            } else {
                obj.material.colorNode = mul(tslVec3(baseColorUniform), diffuse);
            }
            obj.material.roughness = cityGui.roughness;
            obj.material.metalness = cityGui.metalness;
            obj.material.side = FrontSide;
        }
    });

    return { baseColorUniform };
}

function createSyncCityMaterials(
    root: Object3D,
    cityGui: CityGuiParams,
    baseColorUniform: CityColorUniform,
    hoverColorUniform: CityColorUniform,
    hoverMixMaxUniform: CityFloatUniform,
    hoverEmissiveUniform: CityFloatUniform,
    getCityEnv: () => { map: Texture; envGui: CityEnvGuiParams },
) {
    return () => {
        baseColorUniform.value.set(cityGui.color);
        hoverColorUniform.value.set(cityGui.hoverColor);
        hoverMixMaxUniform.value = cityGui.hoverMix;
        hoverEmissiveUniform.value = cityGui.hoverEmissive;

        root.traverse((obj) => {
            if (!(obj instanceof Mesh)) {
                return;
            }

            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

            for (const mat of mats) {
                if (!(mat instanceof MeshStandardNodeMaterial)) {
                    continue;
                }

                mat.color.set(cityGui.color);
                mat.roughness = cityGui.roughness;
                mat.metalness = cityGui.metalness;
                mat.aoMapIntensity = cityGui.aoMapIntensity;
            }
        });

        const { map, envGui } = getCityEnv();

        applyCityEnvMapToMeshes(root, map, envGui);
    };
}

export async function loadCityGlb(
    renderer: WebGPURenderer,
    cityGui: CityGuiParams,
    url: string = CITY_GLB_URL,
    setCamera: (camera: PerspectiveCamera) => void,
    getCityEnv: () => { map: Texture; envGui: CityEnvGuiParams },
): Promise<{
    group: Group;
    syncCityMaterials: () => void;
    batchedCityMesh: Mesh | null;
    hoverPrevIdUniform: CityFloatUniform;
    hoverCurrIdUniform: CityFloatUniform;
    hoverTransitionBlendUniform: CityFloatUniform;
    hoverFillPrevUniform: CityFloatUniform;
    hoverFillCurrUniform: CityFloatUniform;
    buildingCentersById: ReadonlyMap<number, Vector3>;
    buildingMaxRadiusById: ReadonlyMap<number, number>;
    hoverFogCenterPrev: CityVec3Uniform;
    hoverFogCenterCurr: CityVec3Uniform;
    hoverRadialExtentPrev: CityFloatUniform;
    hoverRadialExtentCurr: CityFloatUniform;
    hoverColoringActiveUniform: CityFloatUniform;
    cityPlaneHoverMeshes: Mesh[];
    cityPlaneHoverBuildingIdByMeshName: ReadonlyMap<string, number>;
}> {
    const dracoLoader = new DRACOLoader();

    dracoLoader.setDecoderPath(CITY_DRACO_DECODER_PATH);

    const loader = new GLTFLoader();

    loader.setDRACOLoader(dracoLoader);

    let gltf: GLTF;

    try {
        gltf = await loader.loadAsync(url);
    } finally {
        dracoLoader.dispose();
    }

    const root = gltf.scene;

    const { batchedMesh: batchedCityMesh, buildingIdByCityMeshName } = batchCityBuildingMeshes(root);
    const { meshes: cityPlaneHoverMeshes, idByMeshName: cityPlaneHoverBuildingIdByMeshName } =
        collectCityPlaneHoverTargets(root, buildingIdByCityMeshName);

    const buildingCentersByIdLocal: Map<number, Vector3> = batchedCityMesh
        ? computeBuildingCenters(batchedCityMesh.geometry)
        : new Map();

    const buildingCentersById = new Map<number, Vector3>();

    root.updateWorldMatrix(true, false);

    for (const [id, center] of buildingCentersByIdLocal) {
        buildingCentersById.set(id, center.clone().applyMatrix4(root.matrixWorld));
    }

    const buildingMaxRadiusById: ReadonlyMap<number, number> = batchedCityMesh
        ? computeBuildingMaxRadiusFromCenter(batchedCityMesh.geometry, buildingCentersById)
        : new Map();

    markCityReflectionNodes(root);
    batchMeshesBySharedMaterial(root);

    const hoverPrevIdUniform = uniform(-1, 'float');
    const hoverCurrIdUniform = uniform(-1, 'float');
    const hoverTransitionBlendUniform = uniform(1, 'float');
    const hoverFillPrevUniform = uniform(0, 'float');
    const hoverFillCurrUniform = uniform(0, 'float');
    const hoverColorUniform = uniform(new Color().set(cityGui.hoverColor));
    const hoverMixMaxUniform = uniform(cityGui.hoverMix, 'float');
    const hoverEmissiveUniform = uniform(cityGui.hoverEmissive, 'float');
    const hoverFogCenterPrev = uniform(new Vector3());
    const hoverFogCenterCurr = uniform(new Vector3());
    const hoverRadialExtentPrev = uniform(CITY_HOVER_RADIAL_MASK_MAX, 'float');
    const hoverRadialExtentCurr = uniform(CITY_HOVER_RADIAL_MASK_MAX, 'float');
    const hoverColoringActiveUniform = uniform(0, 'float');

    root.traverse((obj) => {
        if (obj instanceof PerspectiveCamera) {
            setCamera(obj);
        }

        if (obj instanceof Mesh) {
            if (!obj.geometry.getAttribute('uv')) {
                const count = obj.geometry.getAttribute('position').count;

                obj.geometry.setAttribute('uv', new BufferAttribute(new Float32Array(count * 2), 2));
            }

            if (obj.name.startsWith('Plane')) {
                obj.position.y += 0.05;
            }
        }
    });

    const hoverUniforms: CityGltfHoverUniforms = {
        hoverPrevIdUniform,
        hoverCurrIdUniform,
        hoverTransitionBlendUniform,
        hoverFillPrevUniform,
        hoverFillCurrUniform,
        hoverColorUniform,
        hoverMixMaxUniform,
        hoverFogCenterPrev,
        hoverFogCenterCurr,
        hoverRadialExtentPrev,
        hoverRadialExtentCurr,
        hoverColoringActiveUniform,
    };

    const cityAoBitmapLoader = new ImageBitmapLoader();

    cityAoBitmapLoader.setOptions({ premultiplyAlpha: 'none' });

    const { baseColorUniform } = applyCityGltfMaterials(root, renderer, cityGui, hoverUniforms, hoverEmissiveUniform);

    if (batchedCityMesh) {
        setupCityMeshBvhForRaycast(batchedCityMesh);
    }

    const syncCityMaterials = createSyncCityMaterials(
        root,
        cityGui,
        baseColorUniform,
        hoverColorUniform,
        hoverMixMaxUniform,
        hoverEmissiveUniform,
        getCityEnv,
    );

    return {
        group: root,
        syncCityMaterials,
        batchedCityMesh,
        hoverPrevIdUniform,
        hoverCurrIdUniform,
        hoverTransitionBlendUniform,
        hoverFillPrevUniform,
        hoverFillCurrUniform,
        buildingCentersById,
        buildingMaxRadiusById,
        hoverFogCenterPrev,
        hoverFogCenterCurr,
        hoverRadialExtentPrev,
        hoverRadialExtentCurr,
        hoverColoringActiveUniform,
        cityPlaneHoverMeshes,
        cityPlaneHoverBuildingIdByMeshName,
    };
}
