import { Module } from '../core/Module'
import { SplitBlurReveal } from '../modules/SplitBlurReveal'
import { FadeMoveReveal } from './contacts/FadeMoveReveal'
import { MaskRiseReveal } from './not-found/MaskRiseReveal'

//404 page — mounted only when the Barba namespace is "404"
//One screen, nothing scrolls — every child plays on reveal(), timing set below.
//The light on the image is FooterLight, a page module (main.css "Footer Interactive Image" lets
//it run here); the running headline is Marquee (data-marquee on the embed in Webflow).

const PAGE_SELECTOR = '._404_main'

const CHIP_DELAY = 0.3
const BOTTOM_DELAY = 0.4
const BOTTOM_OFFSET_Y = 60
const BOTTOM_STAGGER = 0.1

export class NotFoundPage extends Module {

    setup() {

        this.children = [
            new SplitBlurReveal(`${PAGE_SELECTOR} ._404_message`, { trigger: null }),
            new MaskRiseReveal(`${PAGE_SELECTOR} .casepage_chip`, { delay: CHIP_DELAY }),
            //Labels + presentation button in one reveal — the stagger follows DOM order
            new FadeMoveReveal(
                `${PAGE_SELECTOR} .small-label-text, ` +
                `${PAGE_SELECTOR} .contacts-download-presentation`, {
                waitForScroll: false,
                offsetY: BOTTOM_OFFSET_Y,
                delay: BOTTOM_DELAY,
                stagger: BOTTOM_STAGGER,
            }),
        ].map((child) => child.mount())
    }

    //Called by main.js once the preloader / eye transition has finished
    reveal() {
        this.children?.forEach((child) => child.reveal?.())
    }

    destroy() {
        this.children?.forEach((child) => child.destroy())
        this.children = []
        super.destroy()
    }
}
