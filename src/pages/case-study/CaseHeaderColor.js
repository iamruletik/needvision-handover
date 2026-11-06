import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'
import { HEADER_TARGET, setZoneColor, clearZoneColor } from '../../modules/colorZoneTargets'

//Case study header color — white over the hero (photo), black once the page content
//(.casepage_shell, the container's own — the hero has another one inside its body) reaches the
//header line. Same mechanism as company HeaderColorZones: entering a zone from either direction
//sets the pair inline on <html>. Past the content (next-case runway) nothing is active, so the
//header keeps black until the swap; destroy() hands the pair back to the per-page CSS rule
//(white), which is what the next hero needs.

const BLACK = { color: 'var(--main-colours--black)', inverted: 'var(--main-colours--white)' }
const WHITE = { color: 'var(--main-colours--white)', inverted: 'var(--main-colours--black)' }

const ZONES = [
    { section: '[data-barba="container"] .casepage_hero', color: WHITE },
    { section: '[data-barba="container"] > .casepage_shell', color: BLACK },
]

export class CaseHeaderColor extends Module {

    setup() {
        ZONES.forEach(({ section, color }) => {
            let element = document.querySelector(section)
            if (!element) return

            this.animate(ScrollTrigger.create({
                trigger: element,
                start: () => `top ${HEADER_TARGET.line()}`,
                end: () => `bottom ${HEADER_TARGET.line()}`,
                invalidateOnRefresh: true,
                onToggle: (self) => {
                    if (self.isActive) setZoneColor(HEADER_TARGET, color)
                },
            }))
        })
    }

    destroy() {
        super.destroy()
        clearZoneColor(HEADER_TARGET)
    }
}
