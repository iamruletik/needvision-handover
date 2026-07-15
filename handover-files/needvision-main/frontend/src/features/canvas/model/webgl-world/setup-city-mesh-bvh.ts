import { MeshBVH, acceleratedRaycast, disposeBoundsTree } from 'three-mesh-bvh';
import type { Mesh } from 'three/webgpu';

/**
 * Ускоренный raycast по батчу зданий (BVH + AABB на узлах дерева).
 */
export function setupCityMeshBvhForRaycast(mesh: Mesh): void {
    mesh.raycast = acceleratedRaycast as Mesh['raycast'];
    const geom = mesh.geometry;

    if (geom.boundsTree) {
        disposeBoundsTree.call(geom);
    }

    geom.boundsTree = new MeshBVH(geom);
}

export function disposeCityMeshBvh(mesh: Mesh | null): void {
    if (!mesh) {
        return;
    }

    disposeBoundsTree.call(mesh.geometry);
}
