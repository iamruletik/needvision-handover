import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Company page header color follows whichever section sits under the header.
//Each zone is active while its section spans HEADER_LINE (a line near the top of the
//screen, roughly where the header sits); entering a zone from either direction sets
//--main-colours--header-color and its opposite --main-colours--small-header-color inline on
//<html>, overriding the per-page :has() rule in main.css. destroy() removes both, so other
//pages fall back to their CSS colors.
//
//Footer is position:fixed and gets uncovered from below — it can't be measured, so its
//zone starts when the last content section (cards wrapper) ends at HEADER_LINE.

const HEADER_COLOR_PROPERTY = '--main-colours--header-color'
const SMALL_HEADER_COLOR_PROPERTY = '--main-colours--small-header-color'
const HEADER_LINE = '40px' //from the top of the viewport

//Each color comes with its opposite for small-header-color (pill text, menu)
const BLACK = { color: 'var(--main-colours--black)', inverted: 'var(--main-colours--white)' }
const WHITE = { color: 'var(--main-colours--white)', inverted: 'var(--main-colours--black)' }
const ORANGE = { color: 'var(--main-colours--orange)', inverted: 'var(--main-colours--black)' }

const ZONES = [
    { section: '.companypage_hero', color: BLACK },
    { section: '.companypage_image', color: WHITE },
    { section: '.companypage_tabs-section', color: BLACK },
    { section: '.companypage_steps-container', color: WHITE },
    { section: '.companypage_cards-wrapper', color: BLACK },
]

const FOOTER_COLOR = ORANGE
const LAST_CONTENT_SELECTOR = '.companypage_cards-wrapper'

export class HeaderColorZones extends Module {

    setup() {
        this.root = document.documentElement

        ZONES.forEach(({ section, color }) => {
            let element = document.querySelector(section)
            if (!element) return

            this.animate(ScrollTrigger.create({
                trigger: element,
                start: `top ${HEADER_LINE}`,
                end: `bottom ${HEADER_LINE}`,
                onToggle: (self) => {
                    if (self.isActive) this.setColor(color)
                },
            }))
        })

        this.createFooterZone()
    }

    //Past the end of the last section = footer under the header; scrolling back hands
    //the color back to the last section
    createFooterZone() {
        let lastContent = document.querySelector(LAST_CONTENT_SELECTOR)
        if (!lastContent) return

        let lastContentColor = ZONES.find((zone) => zone.section === LAST_CONTENT_SELECTOR)?.color

        this.animate(ScrollTrigger.create({
            trigger: lastContent,
            start: `bottom ${HEADER_LINE}`,
            onEnter: () => this.setColor(FOOTER_COLOR),
            onLeaveBack: () => {
                if (lastContentColor) this.setColor(lastContentColor)
            },
        }))
    }

    setColor({ color, inverted }) {
        this.root.style.setProperty(HEADER_COLOR_PROPERTY, color)
        this.root.style.setProperty(SMALL_HEADER_COLOR_PROPERTY, inverted)
    }

    //Cleanup — hand both colors back to the per-page CSS rule

    destroy() {
        super.destroy()
        this.root?.style.removeProperty(HEADER_COLOR_PROPERTY)
        this.root?.style.removeProperty(SMALL_HEADER_COLOR_PROPERTY)
    }
}
