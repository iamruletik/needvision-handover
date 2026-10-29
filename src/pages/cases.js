import { Module } from '../core/Module'
import { CaseRowFill } from './cases/CaseRowFill'
import { CaseRowsReveal } from './cases/CaseRowsReveal'
import { CaseRowSort } from './cases/CaseRowSort'

//Cases page — mounted only when the Barba namespace is "cases"

export class CasesPageScript extends Module {

    setup() {
        //Sort first — the fill picks up the top row, the reveal staggers in the sorted order
        this.children = [new CaseRowSort(), new CaseRowFill(), new CaseRowsReveal()].map((child) => child.mount())
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
