import type { HeaderLogoRect, IWorld } from './types';

let worldRef: IWorld | null = null;
let pendingRect: HeaderLogoRect | null | undefined;

function toRect(d: DOMRectReadOnly): HeaderLogoRect {
    return { x: d.x, y: d.y, width: d.width, height: d.height };
}

export function registerWorldForHeaderLogo(world: IWorld) {
    worldRef = world;

    if (pendingRect !== undefined) {
        world.setHeaderLogoRect(pendingRect);
        pendingRect = undefined;
    }
}

export function unregisterWorldForHeaderLogo() {
    worldRef = null;
}

function pushRect(rect: HeaderLogoRect | null) {
    if (worldRef) {
        worldRef.setHeaderLogoRect(rect);
    } else {
        pendingRect = rect;
    }
}

export function setupHeaderLogoRectObserver(logo: HTMLElement) {
    const report = () => {
        pushRect(toRect(logo.getBoundingClientRect()));
    };

    window.addEventListener('resize', report);
    requestAnimationFrame(report);

    return () => {
        window.removeEventListener('resize', report);
    };
}
