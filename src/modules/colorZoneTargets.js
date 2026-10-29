import { gsap } from '../core/gsap'

//Who follows a page's color zones, and where each one decides which section it's over.
//A zone module (HeaderColorZones, HeaderStagesInvert) builds its triggers once per target:
//  header       — the line it sits on near the top of the screen
//  floating CTA — the bottom button's own center line; it crosses sections at its own time
//Each target writes its own pair of variables inline on <html> (main.css "Header Color per Page"
//and "Floating CTA colors" hold the per-page defaults).

const HEADER_LINE = '40px' //from the top of the viewport — roughly where the header sits
const FLOATING_CTA_SELECTOR = '.floating-button-wrapper .call-to-action'
const FLOATING_CTA_FALLBACK_LINE = '96%'

export const HEADER_TARGET = {
    name: 'header',
    line: () => HEADER_LINE,
    colorProperty: '--main-colours--header-color',
    invertedProperty: '--main-colours--small-header-color',
}

export const FLOATING_CTA_TARGET = {
    name: 'floating-cta',
    line: floatingCtaLine,
    colorProperty: '--floating-cta--header-color',
    invertedProperty: '--floating-cta--small-header-color',
}

export const COLOR_ZONE_TARGETS = [HEADER_TARGET, FLOATING_CTA_TARGET]

//The button's center, at rest — FloatingButtonReveal may still have it parked below the screen.
//Called by ScrollTrigger on every refresh
function floatingCtaLine() {
    let cta = document.querySelector(FLOATING_CTA_SELECTOR)
    if (!cta) return FLOATING_CTA_FALLBACK_LINE
    let content = cta.closest('.floating-button-content')
    let parkedOffset = content ? Number(gsap.getProperty(content, 'y')) || 0 : 0
    let rect = cta.getBoundingClientRect()
    return `${Math.round(rect.top + rect.height / 2 - parkedOffset)}px`
}

export function setZoneColor(target, { color, inverted }) {
    let root = document.documentElement
    root.style.setProperty(target.colorProperty, color)
    root.style.setProperty(target.invertedProperty, inverted)
}

//Back to the per-page CSS rule
export function clearZoneColor(target) {
    let root = document.documentElement
    root.style.removeProperty(target.colorProperty)
    root.style.removeProperty(target.invertedProperty)
}
