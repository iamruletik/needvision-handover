import { Module } from '../core/Module'
import { HeroReveal } from './home/HeroReveal'
import { BentoStats } from './home/BentoStats'
import { BentoGraph } from './home/BentoGraph'
import { PartnerReveal } from './home/PartnerReveal'
import { HeaderStagesInvert } from './home/HeaderStagesInvert'
import { SplitBlurReveal } from '../modules/SplitBlurReveal'
import { FadeMoveReveal } from './contacts/FadeMoveReveal'

//Manifesto lead text rises word by word — ~30 words, so a tight stagger
const MANIFESTO_WORD_STAGGER = 0.03

//Home page — mounted only when the Barba namespace is "home"

export class HomePage extends Module {

    setup() {

        this.children = [
            new HeroReveal(),
            new BentoStats(),
            new BentoGraph(),
            //Labels around the hero image — same trigger as HeroImageReveal, so they come in as it expands
            new SplitBlurReveal('.hero_feature-label', {
                trigger: '.hero-image-wrapper',
                start: 'center center',
            }),
            //Manifesto — lead text (sticky header) and body paragraph, each on its own scroll trigger.
            //Lead lines are Webflow spans with padding-left indents, one span per line
            new SplitBlurReveal('.manifesto_lead-text', { by: 'words', stagger: MANIFESTO_WORD_STAGGER }),
            new SplitBlurReveal('.manifesto_p-text'),
            new FadeMoveReveal('.manifesto_action', { offsetY: 0 }),
            //Logo section — the huge statement, the paragraph under it (markers: SectionMarkerReveal)
            new SplitBlurReveal('.section-logo .huge-logo_text'),
            new SplitBlurReveal('.section-logo .logo_text-wrap .logo_p-text'),
            new FadeMoveReveal('.section-logo .button-grey', { offsetY: 0 }),
            new PartnerReveal(),
            new HeaderStagesInvert(),
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
