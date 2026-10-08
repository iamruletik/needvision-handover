import { Module } from '../core/Module'

//Privacy policy page — mounted only when the Barba namespace is "privacy"

export class PrivacyPage extends Module {

    setup() {
        console.log('[page] PRIVACY')

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
        console.log('[page] PRIVACY destroyed')
    }
}
