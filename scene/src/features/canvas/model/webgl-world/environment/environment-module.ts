import type { Texture } from 'three/webgpu';
import type { World } from '../../World';
import {
    fileExtensionFromName,
    isHdriEnvironmentFileExtension,
    loadHdriEnvironmentMap,
} from '../load-hdri-environment';

export class EnvironmentModule {
    envMap?: Texture;
    waterEnvMap?: Texture;

    constructor(private readonly world: World) {}

    setEnvMap(map: Texture) {
        this.envMap = map;
    }

    setWaterEnvMap(map: Texture) {
        this.waterEnvMap = map;
    }

    async applySceneHdriFromUploadedFile(file: File) {
        const ext = fileExtensionFromName(file.name);

        if (!isHdriEnvironmentFileExtension(ext)) {
            return;
        }

        const objectUrl = URL.createObjectURL(file);

        try {
            const newEnv = await loadHdriEnvironmentMap(this.world.renderer, objectUrl, file.name);

            if (this.envMap !== this.waterEnvMap) {
                this.envMap?.dispose();
            }

            this.envMap = newEnv;
            this.world.syncCityMaterials?.();
            this.world.postFx.markNeedsUpdate();
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    async applyWaterHdriFromUploadedFile(file: File) {
        const ext = fileExtensionFromName(file.name);

        if (!isHdriEnvironmentFileExtension(ext)) {
            return;
        }

        const objectUrl = URL.createObjectURL(file);

        try {
            const newEnv = await loadHdriEnvironmentMap(this.world.renderer, objectUrl, file.name);

            if (this.waterEnvMap !== this.envMap) {
                this.waterEnvMap?.dispose();
            }

            this.waterEnvMap = newEnv;

            this.world.waterSurface.getWater()?.setWaterEnvMap(newEnv);
            this.world.waterSurface.getWater()?.applyWaterMaterial();
            this.world.postFx.markNeedsUpdate();
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    disposeSharedEnv() {
        if (this.envMap !== this.waterEnvMap) {
            this.envMap?.dispose();
            this.waterEnvMap?.dispose();
        } else {
            this.envMap?.dispose();
        }

        this.envMap = undefined;
        this.waterEnvMap = undefined;
    }
}
