import { ScrollTrigger } from '../core/gsap'
import { Module } from '../core/Module'
import { COLOR_ZONE_TARGETS } from './colorZoneTargets'

//Header and floating CTA go orange over the footer, on every page that has one. Each target gets
//its own class on <html> once .pre-footer-offset (the spacer in front of the fixed footer) passes
//that target's line. main.css "Footer Zone Color" sets the variable pair with !important, so it
//wins over the per-page :has() rules and the inline pairs the page zone modules write
//(HeaderColorZones, HeaderStagesInvert) — no ordering fights at the shared scroll position.

//The header target also announces it on document — HeaderCompact spreads the header over the footer.

const SPACER_SELECTOR = '.pre-footer-offset'

const CLASS_BY_TARGET = {
    'header': 'is-footer-under-header',
    'floating-cta': 'is-footer-under-floating-cta',
}

//detail: { isOverFooter }
export const FOOTER_ZONE_EVENT = 'footer-zone-header'
const EVENT_TARGET_NAME = 'header'

export class FooterHeaderColor extends Module {

    setup() {
        let spacer = document.querySelector(SPACER_SELECTOR)
        if (!spacer) return

        COLOR_ZONE_TARGETS.forEach((target) => {
            let className = CLASS_BY_TARGET[target.name]
            if (!className) return

            this.animate(ScrollTrigger.create({
                trigger: spacer,
                start: () => `top ${target.line()}`,
                invalidateOnRefresh: true,
                //No end: leaving forward never clears it — only scrolling back above the start
                onEnter: () => this.setOverFooter(target, className, true),
                onLeaveBack: () => this.setOverFooter(target, className, false),
            }))
        })
    }

    setOverFooter(target, className, isOverFooter) {
        document.documentElement.classList.toggle(className, isOverFooter)
        if (target.name === EVENT_TARGET_NAME) this.announce(isOverFooter)
    }

    announce(isOverFooter) {
        document.dispatchEvent(new CustomEvent(FOOTER_ZONE_EVENT, { detail: { isOverFooter } }))
    }

    //Page leaves — header back to scroll-driven before the next page mounts
    destroy() {
        super.destroy()
        Object.values(CLASS_BY_TARGET).forEach((className) => document.documentElement.classList.remove(className))
        this.announce(false)
    }
}
