import { Module } from '../core/Module'

//Cases page — mounted only when the Barba namespace is "cases"

export class CasesPageScript extends Module {

    setup() {
        console.log('[page] CASES')

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
        console.log('[page] CASES destroyed')
    }
}
