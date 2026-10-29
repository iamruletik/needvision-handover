import { Module } from '../core/Module'
import { SplitBlurReveal } from './SplitBlurReveal'

//Section markers (.section-marker-wrap — number + label, a flex row, so its children are split)
//rise in via SplitBlurReveal when the section they sit in scrolls in. One reveal per marker,
//triggered by its closest <section> (falls back to the marker itself). Any page, skips silently.

const MARKER_SELECTOR = '.section-marker-wrap'
const SECTION_SELECTOR = 'section'
const TRIGGER_START = 'top 60%'

export class SectionMarkerReveal extends Module {

    setup() {
        this.reveals = [...document.querySelectorAll(MARKER_SELECTOR)]
            .filter((marker) => marker.children.length > 0)
            .map((marker) => new SplitBlurReveal([...marker.children], {
                trigger: marker.closest(SECTION_SELECTOR) ?? marker,
                start: TRIGGER_START,
            }).mount())
    }

    //Called once the screen is visible
    reveal() {
        this.reveals?.forEach((reveal) => reveal.reveal())
    }

    destroy() {
        this.reveals?.forEach((reveal) => reveal.destroy())
        this.reveals = []
        super.destroy()
    }
}
