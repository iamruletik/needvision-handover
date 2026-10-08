import { Module } from '../core/Module'

//Case study pages (3, one template) — mounted only when the Barba namespace is "case-study"

export class CaseStudyPage extends Module {

    setup() {
        console.log('[page] CASE STUDY')

        this.children = [].map((child) => child.mount())
    }

    //Called by main.js once the preloader / eye transition has finished
    reveal() {
        this.children?.forEach((child) => child.reveal?.())
    }

    destroy() {
        this.children?.forEach((child) => child.destroy())
        this.children = []
        super.destroy()
        console.log('[page] CASE STUDY destroyed')
    }
}
