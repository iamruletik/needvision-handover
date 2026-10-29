import type { HeaderLogoRect, IWorld } from './types';

// Spotlight anchor: the host page's element the spotlight sits on (the dot in the header logo).
// Its rect is measured every frame while a world is registered — the logo moves (header compact
// Flip, header reveal), not only on resize — and pushed to the world only when it changes,
// so the worker sees a message per actual move, not per frame. No world (scene destroyed,
// other pages) → no loop.

const RECT_CHANGE_EPSILON_PX = 0.1;

let worldRef: IWorld | null = null;
let pendingRect: HeaderLogoRect | null | undefined;
let findAnchor: (() => Element | null) | null = null;
let lastRect: HeaderLogoRect | null = null;
let frameId = 0;

function toRect(d: DOMRectReadOnly): HeaderLogoRect {
    return { x: d.x, y: d.y, width: d.width, height: d.height };
}

function isSameRect(a: HeaderLogoRect | null, b: HeaderLogoRect | null) {
    if (!a || !b) {
        return a === b;
    }

    return (
        Math.abs(a.x - b.x) < RECT_CHANGE_EPSILON_PX &&
        Math.abs(a.y - b.y) < RECT_CHANGE_EPSILON_PX &&
        Math.abs(a.width - b.width) < RECT_CHANGE_EPSILON_PX &&
        Math.abs(a.height - b.height) < RECT_CHANGE_EPSILON_PX
    );
}

function pushRect(rect: HeaderLogoRect | null) {
    if (worldRef) {
        worldRef.setHeaderLogoRect(rect);
    } else {
        pendingRect = rect;
    }
}

function measure() {
    const anchor = findAnchor?.() ?? null;
    const rect = anchor ? toRect(anchor.getBoundingClientRect()) : null;

    if (isSameRect(rect, lastRect)) {
        return;
    }

    lastRect = rect;
    pushRect(rect);
}

function startTracking() {
    if (frameId || !findAnchor) {
        return;
    }

    const step = () => {
        measure();
        frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
}

function stopTracking() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastRect = null; // a re-registered world gets a fresh push
}

export function registerWorldForHeaderLogo(world: IWorld) {
    worldRef = world;

    if (pendingRect !== undefined) {
        world.setHeaderLogoRect(pendingRect);
        pendingRect = undefined;
    }

    startTracking();
}

export function unregisterWorldForHeaderLogo() {
    worldRef = null;
    stopTracking();
}

// anchorLookup is re-run every frame — survives the element being replaced
export function setupHeaderLogoRectObserver(anchorLookup: () => Element | null) {
    findAnchor = anchorLookup;
    measure();

    if (worldRef) {
        startTracking();
    }

    return () => {
        stopTracking();
        findAnchor = null;
    };
}
