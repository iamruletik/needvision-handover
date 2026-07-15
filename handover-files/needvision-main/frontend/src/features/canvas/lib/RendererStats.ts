import type { Material, Object3D, WebGPURenderer } from 'three/webgpu';

function countMaterials(root: Object3D): { unique: number; slots: number } {
    const unique = new Set<Material>();
    let slots = 0;

    root.traverse((object) => {
        const m = (object as { material?: Material | Material[] }).material;

        if (m == null) {
            return;
        }
        const list = Array.isArray(m) ? m : [m];

        for (const mat of list) {
            slots += 1;
            unique.add(mat);
        }
    });

    return { unique: unique.size, slots };
}

function formatHeapMb(): string {
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };

    if (perf.memory?.usedJSHeapSize != null) {
        return `${(perf.memory.usedJSHeapSize / 1048576).toFixed(1)} MB`;
    }

    return '—';
}

export class RendererStats {
    readonly element: HTMLDivElement;

    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'renderer-stats';
    }

    update(renderer: WebGPURenderer, scene: Object3D): void {
        const { render, memory } = renderer.info;
        const { unique, slots } = countMaterials(scene);
        const materialsLine =
            unique === slots
                ? `Materials (shaders): ${unique}`
                : `Materials (shaders): ${unique} unique · ${slots} slots`;

        this.element.textContent = [
            `Draw calls: ${render.drawCalls}`,
            `Triangles: ${render.triangles}`,
            materialsLine,
            `Memory: ${formatHeapMb()}`,
            `Geometries: ${memory.geometries}`,
            `Textures: ${memory.textures}`,
        ].join('\n');
    }

    dispose(): void {
        this.element.remove();
    }
}
