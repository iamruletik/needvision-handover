//Who follows a page's color zones, and where it decides which section it's over.
//A zone module (HeaderColorZones, HeaderStagesInvert) builds its triggers once per target:
//  header — the line it sits on near the top of the screen
//(The floating CTA used to be a target too — it's always orange now, main.css "Floating CTA colors".)
//Each target writes its own pair of variables inline on <body> (main.css "Header Color per Page"
//holds the per-page defaults, also on body). Not <html>: below 991px Webflow re-declares its
//variables on body, which would shadow anything set higher up.

const HEADER_LINE = '40px' //from the top of the viewport — roughly where the header sits

export const HEADER_TARGET = {
    name: 'header',
    line: () => HEADER_LINE,
    colorProperty: '--main-colours--header-color',
    invertedProperty: '--main-colours--small-header-color',
}

export const COLOR_ZONE_TARGETS = [HEADER_TARGET]

export function setZoneColor(target, { color, inverted }) {
    let root = document.body
    root.style.setProperty(target.colorProperty, color)
    root.style.setProperty(target.invertedProperty, inverted)
}

//Back to the per-page CSS rule
export function clearZoneColor(target) {
    let root = document.body
    root.style.removeProperty(target.colorProperty)
    root.style.removeProperty(target.invertedProperty)
}
