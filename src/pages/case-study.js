import { Module } from '../core/Module'
import { CaseHeaderColor } from './case-study/CaseHeaderColor'
import { CaseHeroReveal } from './case-study/CaseHeroReveal'
import { CaseHeroScroll } from './case-study/CaseHeroScroll'
import { NextCaseTransition } from './case-study/NextCaseTransition'

//Case study pages (3, one template) — mounted only when the Barba namespace is "case-study"

export class CaseStudyPage extends Module {

    constructor(smoothScroll) {
        super()
        this.smoothScroll = smoothScroll
    }

    setup() {
        this.children = [
            new CaseHeroReveal(),
            new CaseHeroScroll(this.smoothScroll),
            new CaseHeaderColor(),
            new NextCaseTransition(),
        ].map((child) => child.mount())
    }

    //Called by main.js once the preloader / eye transition has finished
    reveal(options) {
        this.children?.forEach((child) => child.reveal?.(options))
    }

    destroy() {
        this.children?.forEach((child) => child.destroy())
        this.children = []
        super.destroy()
    }
}
