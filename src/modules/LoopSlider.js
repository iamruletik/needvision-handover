import { gsap, Observer } from '../core/gsap'
import { Module } from '../core/Module'

//Swipeable infinite slider: a finger drags the row, release settles on the nearest slide.
//Nothing wraps the slides — each one carries its own x, wrapped into one loop period, so the row
//never ends and Webflow's layout (flex row, gap, padding, overflow hidden) stays as built.
//Too few slides to cover the row plus one slide → the set is cloned until it does.
//
//  new LoopSlider('.stage-slider-mobile', { media: '(max-width: 991px)' }).mount()
//
//Targets: selector, element or array of elements — each one is a separate slider (its direct children
//are the slides). Hidden targets (display: none) are skipped.

const DEFAULTS = {
    media: null, //only runs when this matches (checked once, on mount)
    dragMinimum: 5,
    //Seconds of release velocity carried into the snap — bigger = flings travel further
    velocityProjection: 0.2,
    settleDuration: 0.7,
    settleEase: 'power3.out',
    maxCloneRounds: 4,
}

const CLONE_ATTRIBUTE = 'data-loop-clone'

export class LoopSlider extends Module {

    constructor(targets, options = {}) {
        super()
        this.targets = targets
        this.options = { ...DEFAULTS, ...options }
    }

    setup() {
        this.sliders = []
        if (this.options.media && !window.matchMedia(this.options.media).matches) return

        this.sliders = this.resolveTargets()
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => this.createSlider(element))
            .filter(Boolean)
    }

    //Setup Helpers

    resolveTargets() {
        let { targets } = this
        if (!targets) return []
        if (typeof targets === 'string') return [...document.querySelectorAll(targets)]
        if (targets instanceof Element) return [targets]
        return [...targets].filter((target) => target instanceof Element)
    }

    createSlider(element) {
        let originals = [...element.children]
        if (originals.length < 2) return null

        let slider = { element, originals, slides: originals, offset: 0, activeIndex: 0, tween: null, isDraggingX: false, releaseVelocity: 0 }
        this.measure(slider)
        this.cloneUntilCovered(slider)
        this.render(slider)
        this.bindDrag(slider)
        this.bindResize(slider)
        return slider
    }

    //A slide leaving one edge must re-enter off the other: period ≥ row width + widest slide
    cloneUntilCovered(slider) {
        let rounds = 0
        while (slider.period < slider.element.clientWidth + Math.max(...slider.widths) && rounds < this.options.maxCloneRounds) {
            slider.originals.forEach((slide) => {
                let clone = slide.cloneNode(true)
                clone.setAttribute(CLONE_ATTRIBUTE, '')
                clone.setAttribute('aria-hidden', 'true')
                slider.element.appendChild(clone)
            })
            slider.slides = [...slider.element.children]
            this.measure(slider)
            rounds++
        }
    }

    //offsetLeft ignores transforms — layout positions stay readable while slides are moved
    measure(slider) {
        let { element, slides } = slider
        let style = getComputedStyle(element)
        let spacing = parseFloat(style.columnGap) || 0
        let base = slides[0].offsetLeft

        slider.paddingLeft = parseFloat(style.paddingLeft) || 0
        slider.positions = slides.map((slide) => slide.offsetLeft - base)
        slider.widths = slides.map((slide) => slide.offsetWidth)
        slider.setters = slides.map((slide) => gsap.quickSetter(slide, 'x', 'px'))

        let last = slides.length - 1
        slider.period = slider.positions[last] + slider.widths[last] + spacing
    }

    bindDrag(slider) {
        this.animate(Observer.create({
            target: slider.element,
            type: 'touch,pointer',
            dragMinimum: this.options.dragMinimum,
            lockAxis: true,
            onPress: () => {
                slider.tween?.kill()
                slider.isDraggingX = false
                slider.releaseVelocity = 0
            },
            onDrag: (self) => {
                if (self.axis !== 'x') return
                slider.isDraggingX = true
                slider.releaseVelocity = self.velocityX
                slider.offset += self.deltaX
                this.render(slider)
            },
            //Also after a vertical scroll or a tap — a press may have stopped a settle halfway
            onRelease: () => this.settle(slider, slider.isDraggingX ? slider.releaseVelocity : 0),
        }))
    }

    //Lazy images and rotation change sizes — re-measure, land back on the active slide
    bindResize(slider) {
        let resizeObserver = this.observe(new ResizeObserver(() => {
            slider.tween?.kill()
            this.measure(slider)
            slider.offset = -slider.positions[slider.activeIndex]
            this.render(slider)
        }))
        resizeObserver.observe(slider.element)
        slider.slides.forEach((slide) => resizeObserver.observe(slide))
    }

    //Closest resting offset to target: some slide's left edge on the row's start, any loop turn
    nearestAnchor(slider, target) {
        let best = { index: 0, offset: target, distance: Infinity }
        slider.positions.forEach((position, index) => {
            let turns = Math.round((target + position) / slider.period)
            let offset = -position + turns * slider.period
            let distance = Math.abs(offset - target)
            if (distance < best.distance) best = { index, offset, distance }
        })
        return best
    }

    //Animations

    //Each slide sits inside [fully off the left edge, one period later)
    render(slider) {
        let { slides, positions, widths, period, paddingLeft, offset, setters } = slider
        slides.forEach((slide, index) => {
            let minimum = -paddingLeft - widths[index]
            let position = gsap.utils.wrap(minimum, minimum + period, positions[index] + offset)
            setters[index](position - positions[index])
        })
    }

    settle(slider, velocity = 0) {
        let anchor = this.nearestAnchor(slider, slider.offset + velocity * this.options.velocityProjection)
        slider.activeIndex = anchor.index
        slider.tween?.kill()
        slider.tween = gsap.to(slider, {
            offset: anchor.offset,
            duration: this.options.settleDuration,
            ease: this.options.settleEase,
            onUpdate: () => this.render(slider),
        })
    }

    //Cleanup — clones gone, originals back in place

    destroy() {
        this.sliders?.forEach((slider) => {
            slider.tween?.kill()
            slider.element.querySelectorAll(`[${CLONE_ATTRIBUTE}]`).forEach((clone) => clone.remove())
            gsap.set(slider.originals, { clearProps: 'transform' })
        })
        this.sliders = []
        super.destroy()
    }
}
