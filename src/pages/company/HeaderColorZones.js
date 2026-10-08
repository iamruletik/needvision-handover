import { ScrollTrigger } from '../../core/gsap'
import { Module } from '../../core/Module'

//Company page header color follows whichever section sits under the header.
//Each zone is active while its section spans HEADER_LINE (a line near the top of the
//screen, roughly where the header sits); entering a zone from either direction sets
//--main-colours--header-color inline on <html>, overriding the per-page :has() rule
//in main.css. destroy() removes it, so other pages fall back to their CSS color.
//
//Footer is position:fixed and gets uncovered from below — it can't be measured, so its
//zone starts when the last content section (cards wrapper) ends at HEADER_LINE.

const HEADER_COLOR_PROPERTY = '--main-colours--header-color'
const HEADER_LINE = '40px' //from the top of the viewport

const ZONES = [
    { section: '.companypage_hero', color: 'var(--main-colours--black)' },
    { section: '.companypage_image', color: 'var(--main-colours--white)' },
    { section: '.companypage_tabs-section', color: 'var(--main-colours--black)' },
    { section: '.companypage_steps-container', color: 'var(--main-colours--white)' },
    { section: '.companypage_cards-wrapper', color: 'var(--main-colours--black)' },
]

const FOOTER_COLOR = 'var(--main-colours--orange)'
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

    setColor(color) {
        this.root.style.setProperty(HEADER_COLOR_PROPERTY, color)
    }

    //Cleanup — hand the color back to the per-page CSS rule

    destroy() {
        super.destroy()
        this.root?.style.removeProperty(HEADER_COLOR_PROPERTY)
    }
}
