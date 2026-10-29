import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { COLOR_ZONE_TARGETS, setZoneColor, clearZoneColor } from '../../modules/colorZoneTargets'

//Home header — and, separately, the floating CTA at the bottom — go black from .stages until the
//footer. Same mechanism as the company page's HeaderColorZones: each target's variable pair set
//inline on <html> while the zone spans that target's line (colorZoneTargets.js). Leaving the zone
//either way removes the pair, so the home CSS rule (white, main.css "Header Color per Page")
//takes over again.
//Zone ends at .pre-footer-offset — the transparent spacer in flow in front of the fixed footer,
//so it reaches each line exactly when the footer does.

const SECTION_SELECTOR = '.stages'
const END_SELECTOR = '.pre-footer-offset'

const STAGES_COLOR = { color: 'var(--main-colours--black)', inverted: 'var(--main-colours--white)' }

export class HeaderStagesInvert extends Module {

    setup() {
        let section = document.querySelector(SECTION_SELECTOR)
        if (!section) return
        let endElement = document.querySelector(END_SELECTOR)

        COLOR_ZONE_TARGETS.forEach((target) => {
            this.animate(ScrollTrigger.create({
                trigger: section,
                start: () => `top ${target.line()}`,
                endTrigger: endElement ?? section,
                end: () => `${endElement ? 'top' : 'bottom'} ${target.line()}`,
                invalidateOnRefresh: true,
                onToggle: (self) => {
                    if (self.isActive) setZoneColor(target, STAGES_COLOR)
                    else clearZoneColor(target)
                },
            }))
        })
    }

    //Cleanup — hand every pair back to the per-page CSS rule

    destroy() {
        super.destroy()
        COLOR_ZONE_TARGETS.forEach((target) => clearZoneColor(target))
    }
}
