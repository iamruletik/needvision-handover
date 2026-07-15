import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    BufferGeometry,
    Float32BufferAttribute,
    InstancedMesh,
    type Material,
    Mesh,
    type Object3D,
    SkinnedMesh,
    Vector3,
} from 'three/webgpu';

export const CITY_BUILDING_NAME_RE = /^city\d*(_\d+)?$/i;
export const CITY_PLANE_PROXY_NAME_RE = /^plane\d*$/i;

export function snapCityBuildingId(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) {
        return -1;
    }
    const n = Math.round(raw);

    return n > 0 ? n : -1;
}

function matchesCityBuildingName(mesh: Mesh): boolean {
    const labels = [mesh.name, mesh.userData?.name].filter((s): s is string => typeof s === 'string' && s.length > 0);

    return labels.some((l) => CITY_BUILDING_NAME_RE.test(l));
}

export type BatchCityBuildingsResult = {
    batchedMesh: Mesh | null;
    buildingIdByCityMeshName: ReadonlyMap<string, number>;
};

/**
 * Сливает меши зданий в один draw call. Геометрия в мировых координатах, меш под корнем сцены.
 */
export function batchCityBuildingMeshes(root: Object3D): BatchCityBuildingsResult {
    const candidates: Mesh[] = [];

    root.traverse((obj) => {
        if (obj instanceof Mesh && matchesCityBuildingName(obj)) {
            candidates.push(obj);
        }
    });

    if (candidates.length === 0) {
        return { batchedMesh: null, buildingIdByCityMeshName: new Map() };
    }

    candidates.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const buildingIdByCityMeshName = new Map<string, number>();
    const geometries: BufferGeometry[] = [];

    root.updateWorldMatrix(true, false);
    const invRootMatrix = root.matrixWorld.clone().invert();

    for (let i = 0; i < candidates.length; i++) {
        const mesh = candidates[i];
        const buildingId = i + 1;

        buildingIdByCityMeshName.set(mesh.name, buildingId);
        mesh.updateWorldMatrix(true, false);
        const geom = mesh.geometry.clone();

        // Apply matrix relative to root to avoid double transform when added back to root
        const relativeMatrix = mesh.matrixWorld.clone().premultiply(invRootMatrix);

        geom.applyMatrix4(relativeMatrix);

        const pos = geom.attributes.position;
        const vc = pos.count;
        let minY = Infinity;
        let maxY = -Infinity;

        for (let j = 0; j < vc; j++) {
            const y = pos.getY(j);

            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }

        const span = maxY - minY;
        const normArr = new Float32Array(vc);

        if (span < 1e-6) {
            normArr.fill(0.5);
        } else {
            const denom = span + 1e-6;

            for (let j = 0; j < vc; j++) {
                normArr[j] = (pos.getY(j) - minY) / denom;
            }
        }

        geom.setAttribute('buildingNormY', new Float32BufferAttribute(normArr, 1));
        const arr = new Float32Array(vc);

        arr.fill(buildingId);
        geom.setAttribute('buildingId', new Float32BufferAttribute(arr, 1));
        geometries.push(geom);
    }

    const merged = mergeGeometries(geometries, false);

    for (const g of geometries) {
        g.dispose();
    }

    if (!merged) {
        // eslint-disable-next-line no-console
        console.error('[batchCityBuildingMeshes] mergeGeometries failed');

        return { batchedMesh: null, buildingIdByCityMeshName };
    }

    const refMaterial = candidates[0].material;
    const material = Array.isArray(refMaterial) ? refMaterial[0] : refMaterial;

    const batched = new Mesh(merged, material);

    batched.name = 'BatchedCityBuildings';
    batched.position.set(0, 0, 0);
    batched.rotation.set(0, 0, 0);
    batched.scale.set(1, 1, 1);
    batched.updateMatrix();

    for (const mesh of candidates) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
    }

    root.add(batched);

    return { batchedMesh: batched, buildingIdByCityMeshName };
}

export function computeBuildingCenters(geometry: BufferGeometry): Map<number, Vector3> {
    const pos = geometry.getAttribute('position');
    const bidAttr = geometry.getAttribute('buildingId');
    const out = new Map<number, Vector3>();

    if (!pos || !bidAttr || pos.itemSize < 3) {
        return out;
    }

    const minById = new Map<number, Vector3>();
    const maxById = new Map<number, Vector3>();
    const n = pos.count;

    for (let i = 0; i < n; i++) {
        const id = Math.round(bidAttr.getX(i));

        if (id <= 0) {
            continue;
        }

        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        let mn = minById.get(id);
        let mx = maxById.get(id);

        if (!mn || !mx) {
            mn = new Vector3(x, y, z);
            mx = mn.clone();
            minById.set(id, mn);
            maxById.set(id, mx);
        } else {
            mn.x = Math.min(mn.x, x);
            mn.y = Math.min(mn.y, y);
            mn.z = Math.min(mn.z, z);
            mx.x = Math.max(mx.x, x);
            mx.y = Math.max(mx.y, y);
            mx.z = Math.max(mx.z, z);
        }
    }

    for (const [id, mn] of minById) {
        const mx = maxById.get(id);

        if (!mx) {
            continue;
        }

        out.set(id, new Vector3().addVectors(mn, mx).multiplyScalar(0.5));
    }

    return out;
}

/**
 * Max расстояние от центра AABB (см. `computeBuildingCenters`) до любой вершины здания — для
 * радиальной hover-маски, чтобы волна при fill→1 накрывала весь меш.
 */
export function computeBuildingMaxRadiusFromCenter(
    geometry: BufferGeometry,
    centers: ReadonlyMap<number, Vector3>,
): Map<number, number> {
    const pos = geometry.getAttribute('position');
    const bidAttr = geometry.getAttribute('buildingId');
    const out = new Map<number, number>();

    if (!pos || !bidAttr || pos.itemSize < 3) {
        return out;
    }

    const p = new Vector3();
    const n = pos.count;

    for (let i = 0; i < n; i++) {
        const id = Math.round(bidAttr.getX(i));

        if (id <= 0) {
            continue;
        }

        const c = centers.get(id);

        if (c === undefined) {
            continue;
        }

        p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const d = p.distanceTo(c);

        out.set(id, Math.max(d, out.get(id) ?? 0));
    }

    return out;
}

function getSingleSharedMaterial(mesh: Mesh): Material | null {
    const m = mesh.material;

    if (!m) {
        return null;
    }

    if (Array.isArray(m)) {
        if (m.length === 0) {
            return null;
        }
        const first = m[0];

        for (let i = 1; i < m.length; i++) {
            if (m[i] !== first) {
                return null;
            }
        }

        return first;
    }

    return m;
}

function canBatchMeshWithSharedMaterial(mesh: Mesh): boolean {
    if (mesh.name === 'FOG') {
        return false;
    }

    if (CITY_PLANE_PROXY_NAME_RE.test(mesh.name)) {
        return false;
    }

    if (mesh instanceof InstancedMesh || mesh instanceof SkinnedMesh) {
        return false;
    }

    if (mesh.geometry.getAttribute('buildingId')) {
        return false;
    }
    const geom = mesh.geometry;

    if (geom.morphAttributes && Object.keys(geom.morphAttributes).length > 0) {
        return false;
    }

    if (mesh.morphTargetInfluences && mesh.morphTargetInfluences.length > 0) {
        return false;
    }

    return getSingleSharedMaterial(mesh) !== null;
}

/** То же условие, что у ReflectorNode при пометке drawable: reflection на предке (markCityReflectionNodes). */
function isMeshInReflectionSubtree(mesh: Mesh): boolean {
    let o: Object3D | null = mesh;

    while (o !== null) {
        if ((o.userData as { reflection?: boolean }).reflection === true) {
            return true;
        }
        o = o.parent;
    }

    return false;
}

/**
 * Сливает оставшиеся меши с одним и тем же экземпляром материала в один draw call на материал.
 * Вызывать после {@link batchCityBuildingMeshes}. Геометрия в мировых координатах.
 */
export function batchMeshesBySharedMaterial(root: Object3D): Mesh[] {
    const candidates: Mesh[] = [];

    root.traverse((obj) => {
        if (obj instanceof Mesh && canBatchMeshWithSharedMaterial(obj)) {
            candidates.push(obj);
        }
    });

    /** Одна и та же `Material`: меши с разным членством в отражении нельзя сливать — RT по userData/reflector. */
    const byMaterialAndReflection = new Map<string, Mesh[]>();

    for (const mesh of candidates) {
        const mat = getSingleSharedMaterial(mesh);

        if (!mat) {
            continue;
        }
        const refl = isMeshInReflectionSubtree(mesh);
        const key = `${mat.uuid}\0refl:${refl}`;
        let list = byMaterialAndReflection.get(key);

        if (!list) {
            list = [];
            byMaterialAndReflection.set(key, list);
        }
        list.push(mesh);
    }

    const created: Mesh[] = [];

    for (const [, group] of byMaterialAndReflection) {
        if (group.length < 2) {
            continue;
        }

        group.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const geometries: BufferGeometry[] = [];

        root.updateWorldMatrix(true, false);
        const invRootMatrix = root.matrixWorld.clone().invert();

        for (const mesh of group) {
            mesh.updateWorldMatrix(true, false);
            const geom = mesh.geometry.clone();
            const relativeMatrix = mesh.matrixWorld.clone().premultiply(invRootMatrix);

            geom.applyMatrix4(relativeMatrix);
            geometries.push(geom);
        }

        const merged = mergeGeometries(geometries, false);

        for (const g of geometries) {
            g.dispose();
        }

        if (!merged) {
            // eslint-disable-next-line no-console
            console.error('[batchMeshesBySharedMaterial] mergeGeometries failed');
            continue;
        }

        const refMaterial = group[0].material;
        const material = Array.isArray(refMaterial) ? refMaterial[0] : refMaterial;

        const batched = new Mesh(merged, material);

        batched.name = `BatchedSharedMat_${created.length}`;
        batched.userData.reflection = isMeshInReflectionSubtree(group[0]);
        batched.position.set(0, 0, 0);
        batched.rotation.set(0, 0, 0);
        batched.scale.set(1, 1, 1);
        batched.updateMatrix();
        batched.frustumCulled = false;

        for (const mesh of group) {
            mesh.removeFromParent();
            mesh.geometry.dispose();
        }

        root.add(batched);
        created.push(batched);
    }

    return created;
}
