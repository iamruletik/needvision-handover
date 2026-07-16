import { uniform } from 'three/tsl';
import { Camera, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three/webgpu';

export class Pointer {
    canvasDomWidth: number;
    canvasDomHeight: number;
    camera: Camera;
    delta = 0;
    rayCaster = new Raycaster();
    initPlane = new Plane(new Vector3(0, 0, 1));
    iPlane = new Plane(new Vector3(0, 0, 1));
    private groundMesh: Object3D | null = null;
    /** Если луч не попал в groundMesh (край квада), проецируем на эту горизонтальную плоскость (мир Y). */
    private horizontalPlaneFallbackY: number | null = null;
    private readonly groundPlaneHorizontal = new Plane(new Vector3(0, 1, 0), 0);
    clientPointer = new Vector2();
    pointer = new Vector2();
    scenePointer = new Vector3();
    uPointer = uniform(new Vector3());
    uPointerVelocity = uniform(new Vector3());
    prevScenePointer = new Vector3();

    constructor(canvasDomWidth: number, canvasDomHeight: number, camera: Camera, plane: Plane) {
        this.canvasDomWidth = canvasDomWidth;
        this.canvasDomHeight = canvasDomHeight;
        this.camera = camera;
        this.initPlane = plane;
        this.iPlane = plane.clone();
        this.clientPointer.set(canvasDomWidth * 0.5, canvasDomHeight * 0.5);
    }

    setGroundMesh(mesh: Object3D | null) {
        this.groundMesh = mesh;
    }

    setHorizontalPlaneFallbackY(y: number | null) {
        this.horizontalPlaneFallbackY = y;
    }

    updateScreenPointer(): void {
        const e = {
            clientX: this.clientPointer.x,
            clientY: this.clientPointer.y,
        };

        this.pointer.set((e.clientX / this.canvasDomWidth) * 2 - 1, -(e.clientY / this.canvasDomHeight) * 2 + 1);
        this.rayCaster.setFromCamera(this.pointer, this.camera);

        if (this.groundMesh) {
            const hits = this.rayCaster.intersectObject(this.groundMesh, false);

            if (hits.length > 0) {
                this.scenePointer.copy(hits[0].point);
            } else if (this.horizontalPlaneFallbackY !== null) {
                this.groundPlaneHorizontal.constant = -this.horizontalPlaneFallbackY;
                this.rayCaster.ray.intersectPlane(this.groundPlaneHorizontal, this.scenePointer);
            }
        } else {
            this.rayCaster.ray.intersectPlane(this.iPlane, this.scenePointer);
        }

        const velocity = this.scenePointer.clone().sub(this.prevScenePointer);

        const damp = Math.exp(-0.8 * this.delta);

        this.uPointerVelocity.value.multiplyScalar(damp).add(velocity.multiplyScalar(1 - damp));

        this.uPointer.value.copy(this.scenePointer);

        this.prevScenePointer.copy(this.scenePointer);
    }

    update(delta: number): void {
        this.delta = delta;

        if (!this.groundMesh) {
            this.iPlane.normal.copy(this.initPlane.normal).applyEuler(this.camera.rotation);
        }
        this.updateScreenPointer();
    }

    intersectWith(plane: Plane, target: Vector3): Vector3 | null {
        this.rayCaster.setFromCamera(this.pointer, this.camera);

        return this.rayCaster.ray.intersectPlane(plane, target);
    }

    updatePosition(x: number, y: number) {
        this.clientPointer.set(x, y);
    }

    updateCanvasDomSize(canvasDomWidth: number, canvasDomHeight: number) {
        const sx = canvasDomWidth / this.canvasDomWidth;
        const sy = canvasDomHeight / this.canvasDomHeight;

        this.clientPointer.x *= sx;
        this.clientPointer.y *= sy;
        this.canvasDomWidth = canvasDomWidth;
        this.canvasDomHeight = canvasDomHeight;
    }
}
