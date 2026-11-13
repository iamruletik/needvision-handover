import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { COLOR_ZONE_TARGETS, setZoneColor, clearZoneColor } from '../../modules/colorZoneTargets'

//Company page header color follows whichever section sits under its line (colorZoneTargets.js;
//the floating CTA is always orange). Entering a zone from either direction sets the variable pair
//inline on <body>, overriding the per-page :has() rule in main.css. destroy() removes it, so other
//pages fall back to their CSS colors.
//Over the footer: FooterHeaderColor.js (all pages) overrides with orange.

//Each color comes with its opposite for the inverted variable (pill text, menu)
const BLACK = { color: 'var(--main-colours--black)', inverted: 'var(--main-colours--white)' }
const WHITE = { color: 'var(--main-colours--white)', inverted: 'var(--main-colours--black)' }

const ZONES = [
    { section: '.companypage_hero', color: BLACK },
    { section: '.companypage_image', color: WHITE },
    { section: '.companypage_tabs-section', color: BLACK },
    { section: '.companypage_steps-container', color: WHITE },
    { section: '.companypage_cards-wrapper', color: BLACK },
]

export class HeaderColorZones extends Module {

    setup() {
        COLOR_ZONE_TARGETS.forEach((target) => {
            ZONES.forEach(({ section, color }) => {
                let element = document.querySelector(section)
                if (!element) return

                this.animate(ScrollTrigger.create({
                    trigger: element,
                    start: () => `top ${target.line()}`,
                    end: () => `bottom ${target.line()}`,
                    invalidateOnRefresh: true,
                    onToggle: (self) => {
                        if (self.isActive) setZoneColor(target, color)
                    },
                }))
            })
        })
    }

    //Cleanup — hand every pair back to the per-page CSS rule

    destroy() {
        super.destroy()
        COLOR_ZONE_TARGETS.forEach((target) => clearZoneColor(target))
    }
}
