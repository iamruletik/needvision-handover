import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Partner logo grid feels alive: every few seconds 3-4 random visible slots
//fade out and come back with a logo from the hidden pool. Repeats across
//different slots are allowed — only a same-logo-to-same-slot no-op swap is not.

const FADE_DURATION = 0.6
const MIN_SWAP_COUNT = 3
const MAX_SWAP_COUNT = 4
const MIN_INTERVAL_MS = 3000
const MAX_INTERVAL_MS = 5500
const FIRST_SWAP_DELAY_MS = 2000

export class LogoGridSwap extends Module {

    setup() {
        this.visibleSlots = [...document.querySelectorAll('.logo-grid_img-visible')]
        let poolImages = [...document.querySelectorAll('.logo-hidden-pool .logo-grid_img')]
        if (this.visibleSlots.length === 0 || poolImages.length === 0) return

        this.poolSources = poolImages.map((image) => image.src)
        this.currentSources = this.visibleSlots.map((image) => image.src)

        this.later(() => this.swapBatch(), FIRST_SWAP_DELAY_MS)
    }

    pickDifferentLogo(excludeSource) {
        let candidates = this.poolSources.filter((source) => source !== excludeSource)
        if (candidates.length === 0) return null
        return candidates[Math.floor(Math.random() * candidates.length)]
    }

    swapBatch() {
        let swapCount = Math.min(
            gsap.utils.random(MIN_SWAP_COUNT, MAX_SWAP_COUNT, 1),
            this.visibleSlots.length
        )

        //Different random slots each round, no slot twice per round
        let slotIndexes = gsap.utils.shuffle(this.visibleSlots.map((slot, index) => index)).slice(0, swapCount)

        slotIndexes.forEach((slotIndex) => {
            let slot = this.visibleSlots[slotIndex]
            let nextSource = this.pickDifferentLogo(this.currentSources[slotIndex])
            if (!nextSource) return

            this.animate(gsap.to(slot, {
                opacity: 0,
                duration: FADE_DURATION,
                ease: 'power1.inOut',
                onComplete: () => {
                    //Kill srcset/sizes or the responsive sources override our src
                    slot.src = nextSource
                    slot.removeAttribute('srcset')
                    slot.removeAttribute('sizes')
                    this.currentSources[slotIndex] = nextSource

                    gsap.to(slot, { opacity: 1, duration: FADE_DURATION, ease: 'power1.inOut' })
                },
            }))
        })

        //Unconditionally — the loop never skips a beat even when the pool is thin
        this.later(() => this.swapBatch(), gsap.utils.random(MIN_INTERVAL_MS, MAX_INTERVAL_MS))
    }
}
