import { Module } from '../core/Module'
import { formatAmount, findNumberTextNode } from '../core/LiveCounter'

//Live number as plain text — same LiveCounter source as the drum counter, but the value
//simply swaps each second (no drums). Only the text node holding the number is updated;
//other children of the element (e.g. a separate $ sign) are never touched.
//Never goes backwards within a visit: a later clock correction only ever holds the number.

export class LiveTextCounter extends Module {

    constructor(element, counter) {
        super()
        this.element = element
        this.counter = counter
    }

    setup() {
        if (!this.element || !this.counter) return

        let numberText = findNumberTextNode(this.element)
        if (!numberText) {
            console.warn('LiveTextCounter: no number found in', this.element)
            return
        }

        this.textNode = numberText.node
        this.originalText = numberText.node.data
        this.prefix = numberText.prefix
        this.suffix = numberText.suffix
        this.lastValue = 0
        this.render()

        //Tick on whole-second boundaries, then every second
        this.later(() => {
            this.render()
            this.every(() => this.render(), 1000)
        }, this.counter.msUntilNextSecond())
    }

    render() {
        this.lastValue = Math.max(this.counter.current(), this.lastValue)
        this.textNode.data = this.prefix + formatAmount(this.lastValue) + this.suffix
    }

    //Cleanup — original text back

    destroy() {
        super.destroy()
        if (this.textNode && this.originalText !== undefined) this.textNode.data = this.originalText
    }
}
