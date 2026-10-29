import { gsap } from '../core/gsap'
import { Module } from '../core/Module'

//Partner logo grid feels alive: every few seconds 3-4 random visible slots
//fade out and come back with a logo from the hidden pool. Repeats across
//different slots are allowed — only a same-logo-to-same-slot no-op swap is not.
//One fade timeline per slot and one pending batch call at a time — both replaced, never
//accumulated, so a long visit doesn't grow anything; destroy() kills whatever is in flight.

const FADE_DURATION = 0.6
const FADE_EASE = 'power1.inOut'
const MIN_SWAP_COUNT = 3
const MAX_SWAP_COUNT = 4
const MIN_INTERVAL_SECONDS = 3
const MAX_INTERVAL_SECONDS = 5.5
const FIRST_SWAP_DELAY_SECONDS = 2

export class LogoGridSwap extends Module {

    setup() {
        this.visibleSlots = [...document.querySelectorAll('.logo-grid_img-visible')]
        let poolImages = [...document.querySelectorAll('.logo-hidden-pool .logo-grid_img')]
        if (this.visibleSlots.length === 0 || poolImages.length === 0) return

        this.poolSources = poolImages.map((image) => image.src)
        this.currentSources = this.visibleSlots.map((image) => image.src)
        this.slotTimelines = new Map()
        this.nextBatchCall = null

        this.scheduleBatch(FIRST_SWAP_DELAY_SECONDS)
    }

    //Helpers

    pickDifferentLogo(excludeSource) {
        let candidates = this.poolSources.filter((source) => source !== excludeSource)
        if (candidates.length === 0) return null
        return candidates[Math.floor(Math.random() * candidates.length)]
    }

    scheduleBatch(delaySeconds) {
        this.nextBatchCall?.kill()
        this.nextBatchCall = gsap.delayedCall(delaySeconds, () => this.swapBatch())
    }

    //Kill srcset/sizes or the responsive sources override our src
    setSlotSource(slotIndex, source) {
        let slot = this.visibleSlots[slotIndex]
        slot.src = source
        slot.removeAttribute('srcset')
        slot.removeAttribute('sizes')
        this.currentSources[slotIndex] = source
    }

    //Animations

    swapBatch() {
        let swapCount = Math.min(
            gsap.utils.random(MIN_SWAP_COUNT, MAX_SWAP_COUNT, 1),
            this.visibleSlots.length
        )

        //Different random slots each round, no slot twice per round
        let slotIndexes = gsap.utils.shuffle(this.visibleSlots.map((slot, index) => index)).slice(0, swapCount)
        slotIndexes.forEach((slotIndex) => this.swapSlot(slotIndex))

        //Unconditionally — the loop never skips a beat even when the pool is thin
        this.scheduleBatch(gsap.utils.random(MIN_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS))
    }

    //Out, swap, in — one timeline, replacing the slot's previous one
    swapSlot(slotIndex) {
        let slot = this.visibleSlots[slotIndex]
        let nextSource = this.pickDifferentLogo(this.currentSources[slotIndex])
        if (!nextSource) return

        this.slotTimelines.get(slot)?.kill()
        let timeline = gsap.timeline({ onComplete: () => this.slotTimelines.delete(slot) })
            .to(slot, { opacity: 0, duration: FADE_DURATION, ease: FADE_EASE })
            .add(() => this.setSlotSource(slotIndex, nextSource))
            .to(slot, { opacity: 1, duration: FADE_DURATION, ease: FADE_EASE })
        this.slotTimelines.set(slot, timeline)
    }

    //Cleanup — nothing left running, slots fully visible

    destroy() {
        this.nextBatchCall?.kill()
        this.nextBatchCall = null
        this.slotTimelines?.forEach((timeline) => timeline.kill())
        this.slotTimelines?.clear()
        if (this.visibleSlots?.length) gsap.set(this.visibleSlots, { clearProps: 'opacity' })
        super.destroy()
    }
}
