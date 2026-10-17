import { Module } from '../core/Module'
import { liveMenuLargeCounter, liveMenuSmallCounter } from '../core/LiveCounter'
import { ProfitCounter } from './ProfitCounter'
import { LiveTextCounter } from './LiveTextCounter'
import { MoneyGauge } from './MoneyGauge'

//Menu money block. Persistent — the menu lives in the header, outside the Barba container.
//  .money-counter-large-number — live drum counter (from 900 000 000)
//  .money-counter-small-number — live plain-text counter (from 1 000 000 000)
//  .money-counter-svg          — speedometer, rocks with the large counter's ticks

const LARGE_NUMBER_SELECTOR = '.money-counter-large-number'
const SMALL_NUMBER_SELECTOR = '.money-counter-small-number'

export class MenuMoney extends Module {

    setup() {
        let largeNumbers = [...document.querySelectorAll(LARGE_NUMBER_SELECTOR)]
        let smallNumbers = [...document.querySelectorAll(SMALL_NUMBER_SELECTOR)]

        this.children = [
            ...largeNumbers.map((element) => new ProfitCounter(element, liveMenuLargeCounter)),
            ...smallNumbers.map((element) => new LiveTextCounter(element, liveMenuSmallCounter)),
            new MoneyGauge(liveMenuLargeCounter),
        ].map((child) => child.mount())
    }

    destroy() {
        this.children?.forEach((child) => child.destroy())
        this.children = []
        super.destroy()
    }
}
