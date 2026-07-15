import { Vector3 } from 'three/webgpu';

export const COLOR = '#ffd6b8';

export const LAYER_VOLUMETRIC_LIGHTING = 10;
export const LAYER_REFLECTION_CONTENT = 12;
export const SPOTLIGHT_TARGET_LERP = 5;
export const SPOTLIGHT_TARGET_POINTER_DAMP_LAMBDA = 38;
export const SPOTLIGHT_TARGET_ABOVE_WATER_Y = 0.06;

export const CITY_FLOOR_Y = -3;

export const SPOTLIGHT_POSITION = new Vector3(-0.28, 7.6, 0);
export const SPOTLIGHT_VOLUMETRIC_MAX_DISTANCE = 20;

export const SCROLL_TRANSITION_START = 0.6;
export const SCROLL_TRANSITION_END = 0.75;

export const SCROLL_WATER_IBL_RAMP_END = 0.25;
export const SCROLL_VIDEO_START = SCROLL_TRANSITION_START;
export const SCROLL_VIDEO_END = 1;

export const SCROLL_WEBGL_COMPLETE_EPS = 1e-5;

export const SCROLL_SPOT_RAMP_START = 0.3;
export const SCROLL_SPOT_RAMP_END = 0.6;

export const HEADER_LOGO_SPOT_SCREEN_ANCHOR_X = 0.456;
export const HEADER_LOGO_SPOT_SCREEN_ANCHOR_Y = 0.8;

export const SCROLL_CITY_RAYCAST_MAX = SCROLL_SPOT_RAMP_START;

export const SCROLL_SPOT_TARGET_START = new Vector3(0, 0, 0);
export const SCROLL_SPOT_TARGET_END = new Vector3(0, 0, 5);

export const CITY_HOVER_TRANSITION_DAMP_LAMBDA = 2;

/** Сколько кадров подряд держать прошлый id здания при промахе луча (быстрый ховер / зазор между мешами). */
export const CITY_HOVER_RAY_STICKY_FRAMES = 10;

export const CITY_HOVER_FILL_SOFT = 0.06;

export const CITY_HOVER_RADIAL_EDGE_MIN = 0.55;
export const CITY_HOVER_RADIAL_EDGE_FRACTION = 0.12;

export const HOVER_FOG_REVEAL_DAMP_LAMBDA = 1;

export const HOVER_FOG_RADIUS = 30;

export const CITY_HOVER_RADIAL_MASK_MAX = HOVER_FOG_RADIUS;
