import { Module } from '../core/Module'

//Home page — mounted only when the Barba namespace is "home"

export class HomePage extends Module {

    setup() {
        console.log('[page] HOME')

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
        console.log('[page] HOME destroyed')
    }
}
