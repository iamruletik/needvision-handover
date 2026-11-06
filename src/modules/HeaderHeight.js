import { Module } from '../core/Module'

//Rendered height of the fixed header (.header-wrapper) as --layout--header-height, inline on
//<body> — the Webflow variable Layout/header-height, whose Webflow value is only the default
//before JS runs. Sections that clear the header (e.g. .cases-section) pad by it in Webflow.
//<body>, not <html>: Webflow's Mobile variable mode re-declares every variable on body at
//its breakpoint, which would shadow a value set on <html>.
//Persistent — the header lives outside the Barba container. A ResizeObserver keeps it current:
//compact / spread, breakpoints, font loading. The menu panel is absolute, so it never counts.

const HEADER_SELECTOR = '.header-wrapper'
const HEIGHT_PROPERTY = '--layout--header-height'

export class HeaderHeight extends Module {

    setup() {
        this.header = document.querySelector(HEADER_SELECTOR)
        if (!this.header || !('ResizeObserver' in window)) return

        this.observe(new ResizeObserver(() => this.writeHeight())).observe(this.header)
        this.writeHeight()
    }

    //offsetHeight — layout height, unaffected by transforms on the header's children
    writeHeight() {
        document.body.style.setProperty(HEIGHT_PROPERTY, `${this.header.offsetHeight}px`)
    }

    destroy() {
        super.destroy()
        document.body.style.removeProperty(HEIGHT_PROPERTY)
    }
}
