import { gsap, Observer } from '../core/gsap'
import { Module } from '../core/Module'

//Infinite photo gallery — every [data-gallery="root"] stage on any page gets its own instance
//(case pages, the home team slider). The stage is the "infinite-slider" Webflow component;
//its photos come from the nearest hidden pool (.casepage_gallery-images) around it.
//
//A row of real photos (the pool) gets poured into a fixed number of columns in a single CSS
//grid row: 1 large "feature" column plus N small "thumb" columns on each side, dividers
//sitting as real grid columns between them. How many columns fit is computed from the actual
//viewport width, not hardcoded — the gallery always spans the full page, edge to edge.
//
//Everything lives in ONE shared render pass (renderColumns): each column's width/height/
//radius/border is looked up from an offset-keyed geometry table and written straight to the
//element — the grid's own auto-column-sizing handles horizontal position, so there is no
//manual x/tick math to keep in sync. The whole track is then shifted with a single translateX
//so whichever offset is "closest to center" lands at the visual middle. Dividers are just grid
//columns too — once built they are never touched again.
//
//Infinite loop: every column has a floating "offset" (-sideCount..+sideCount from center)
//tracked in elementOffset[]. commitStep() shifts every offset by one; the column that would
//fall off one edge teleports (invisibly, past the visible fit — see WRAP_BUFFER_LANES) to the
//opposite edge and picks up the next photo in that direction. Arrow/dot clicks and drag all
//drive the same shared `progress` scalar through the same renderColumns()/commitStep() pair.
//
//Fewer real photos than fit on screen? They repeat in order to fill every slot.
//
//Events on the stage element — how outside UI (the team info panel) talks to a gallery:
//  out  'gallery:settle'  detail { index, count, data, isInitial } — once a move settles;
//                         index/count are in REAL photos (repeats folded back), data is the
//                         pool image's data-* attributes. Last one also kept on stage.galleryState
//  in   'gallery:step'    detail { direction: 1 | -1 }
//  in   'gallery:go'      detail { index } — real photo index, jumps without animation
//  in   'gallery:glide'   detail { lanes, duration } — one continuous drag-like move across
//                         several photos (lanes < 0 = backwards), e.g. a "this drags" intro
const STAGE_SELECTOR = '[data-gallery="root"]'
const POOL_SELECTOR = '.casepage_gallery-images'
const POOL_IMAGE_SELECTOR = '.casepage_gallery-image_actual'

const SETTLE_EVENT = 'gallery:settle'
const STEP_EVENT = 'gallery:step'
const GO_EVENT = 'gallery:go'
const GLIDE_EVENT = 'gallery:glide'

const GLIDE_DEFAULT_DURATION = 1
const GLIDE_EASE = 'power3.inOut'
//The landing photo is known when a glide starts — settle is announced this far into it.
//0 = right away, so the team texts write themselves in while the photos still glide
const GLIDE_SETTLE_AT = 0

const ANIMATION_DURATION = 0.9 //arrow/dot clicks
const ANIMATION_EASE = 'power3.inOut'
const DRAG_EASE_DURATION = 0.5 //catch-up lag, both live dragging and the release settle
const DRAG_CATCHUP_EASE = 'power3'
const DRAG_SETTLE_EASE = 'power3.out'
const WRAP_BUFFER_LANES = 1 //extra hidden lane per side, kept off-screen, where wrap teleports actually happen
const MIN_SIDE_SLOTS = 1
const MAX_DOTS = 12 //past this many cards, dots become a proportional progress row, not 1:1 clickable
const CURSOR_FOLLOW_DURATION = 0.25
const CURSOR_FADE_DURATION = 0.2
const INSET_VAR = '--space--xl' //existing design token, so the gutter matches the rest of the page
const CONTROLS_CLEARANCE_RATIO = 0.5 //extra breathing room above the controls bar, as a fraction of its own height

function cleanClone(source) {
    let clone = source.cloneNode(true)
    clone.removeAttribute('id')
    clone.removeAttribute('data-w-id')
    return clone
}

//The nearest ancestor holding a pool — the case page keeps it elsewhere in the same section,
//the home team slider next to the stage. Falls back to the whole page
function findPoolImages(stage) {
    let ancestor = stage.parentElement
    while (ancestor) {
        let pool = ancestor.querySelector(POOL_SELECTOR)
        if (pool) return [...pool.querySelectorAll(POOL_IMAGE_SELECTOR)]
        ancestor = ancestor.parentElement
    }
    return [...document.querySelectorAll(`${POOL_SELECTOR} ${POOL_IMAGE_SELECTOR}`)]
}

export class GallerySlider extends Module {

    setup() {
        this.galleries = [...document.querySelectorAll(STAGE_SELECTOR)]
            .map((stage) => new GalleryStage(stage).mount())
    }

    destroy() {
        this.galleries?.forEach((gallery) => gallery.destroy())
        this.galleries = []
        super.destroy()
    }
}

class GalleryStage extends Module {

    constructor(stage) {
        super()
        this.stage = stage
    }

    setup() {
        this.track = this.stage.querySelector('.casepage_gallery-track')
        this.pool = findPoolImages(this.stage)
        if (!this.track || this.pool.length === 0) return

        this.strips = [...this.track.querySelectorAll('.casepage_gallery-strip')]
        this.featureTemplate = this.track.querySelector('.casepage_gallery-feature')
        this.thumbTemplate = this.track.querySelector('.casepage_gallery-thumb')
        this.tickTemplate = this.track.querySelector('.casepage_gallery-tick')
        if (this.strips.length < 2 || !this.featureTemplate || !this.thumbTemplate || !this.tickTemplate) return

        this.activeIndex = 0
        this.progress = 0
        this.isAnimating = false
        this.isDragging = false

        this.applyFullBleed()
        this.computeSlotLayout()
        this.buildPhotoList()
        this.buildSlotElements()
        this.layoutSlots()
        this.syncDots()
        this.snapTo(0)
        this.emitSettle(true)

        this.bindArrows()
        this.bindDots()
        this.bindCursor()
        this.bindExternalControls()
        if (this.cardCount > 1) this.bindDrag()
    }

    //Layout — break the whole stage (track + controls) out to the full page width, so
    //.casepage_gallery-controls (absolutely positioned right:0/bottom:0 against the
    //stage) lands at the real viewport edge. Margin-based breakout (NOT left:50%,
    //which offsets relative to the containing block's own width, not the viewport)

    applyFullBleed() {
        let inset = getComputedStyle(document.documentElement).getPropertyValue(INSET_VAR).trim() || '2.5rem'
        this.stage.style.cssText += `
            position: relative;
            width: 100vw;
            margin-left: calc(-50vw + 50%);
            margin-right: calc(-50vw + 50%);
            box-sizing: border-box;
            padding-left: ${inset};
            padding-right: ${inset};
        `
    }

    //Read sizes, gaps and border/radius from the still-untouched authored elements
    //— the only DOM measurement this module does, all taken before anything moves

    computeSlotLayout() {
        let stripStyles = getComputedStyle(this.strips[0])
        let stripGap = parseFloat(stripStyles.columnGap || stripStyles.gap) || 0
        let trackStyles = getComputedStyle(this.track)
        let sidePadding = (parseFloat(trackStyles.paddingLeft) || 0) + (parseFloat(trackStyles.paddingRight) || 0)

        let featureRect = this.featureTemplate.getBoundingClientRect()
        let thumbRect = this.thumbTemplate.getBoundingClientRect()
        let tickRect = this.tickTemplate.getBoundingClientRect()
        let featureStyles = getComputedStyle(this.featureTemplate)
        let thumbStyles = getComputedStyle(this.thumbTemplate)

        //Thumbs sit above the controls bar, not flush with the stage bottom — feature
        //stays flush (controls sit beside it, not underneath it)
        let controls = this.stage.querySelector('.casepage_gallery-controls')
        let controlsHeight = controls ? controls.getBoundingClientRect().height : 0
        this.controlsClearance = controlsHeight * (1 + CONTROLS_CLEARANCE_RATIO)

        //Repeating unit on each side: one thumb + its divider + the two gaps around it
        let cellPitch = thumbRect.width + tickRect.width + stripGap * 2
        let sideBudget = (window.innerWidth - sidePadding - featureRect.width) / 2 - stripGap - tickRect.width - stripGap
        let sideCount = Math.floor((sideBudget + stripGap) / cellPitch)

        //visibleSideCount = what actually fits on screen; sideCount adds one extra lane
        //per side beyond that, off-screen, so wrap teleports never happen in view
        this.visibleSideCount = Math.max(MIN_SIDE_SLOTS, sideCount)
        this.sideCount = this.visibleSideCount + WRAP_BUFFER_LANES
        this.slotCount = this.sideCount * 2 + 1
        this.centralSlot = this.sideCount

        this.stripGap = stripGap
        this.featureSize = { width: featureRect.width, height: featureRect.height }
        this.thumbSize = { width: thumbRect.width, height: thumbRect.height }
        this.tickSize = { width: tickRect.width, height: tickRect.height }
        //borderTopLeftRadius/borderTopWidth (not the shorthand) always resolve to one clean number
        this.featureRadius = parseFloat(featureStyles.borderTopLeftRadius) || 0
        this.thumbRadius = parseFloat(thumbStyles.borderTopLeftRadius) || 0
        this.featureBorderWidth = parseFloat(featureStyles.borderTopWidth) || 0
        this.borderColor = featureStyles.borderTopColor || 'transparent'

        //Pixel distance the finger has to travel to advance exactly one lane
        this.dragPitch = cellPitch
    }

    //Photo pool — read real src/alt (+ data-* for outside UI) from the hidden pool, repeat in
    //order if there are fewer photos than slots to fill. sourceIndex folds repeats back

    buildPhotoList() {
        let sources = this.pool.map((img, sourceIndex) => ({
            src: img.currentSrc || img.src,
            srcset: img.getAttribute('srcset') || '',
            alt: img.getAttribute('alt') || '',
            data: { ...img.dataset },
            sourceIndex,
        }))
        this.sourceCount = sources.length

        if (sources.length >= this.slotCount) {
            this.photos = sources
        } else {
            this.photos = []
            for (let i = 0; i < this.slotCount; i++) this.photos.push(sources[i % sources.length])
        }
        this.cardCount = this.photos.length
    }

    //Rebuilds the gallery as a flat grid row directly inside .casepage_gallery-track,
    //content and divider columns strictly alternating (content,gap,content,...,content)
    //— that alternation is fixed for the element's whole lifetime; only column WIDTHS
    //change later, never which physical slot holds an image vs a divider.

    buildSlotElements() {
        let anchor = this.strips[0]

        let baseThumb = cleanClone(this.thumbTemplate)
        baseThumb.style.borderStyle = 'solid'
        baseThumb.style.borderColor = this.borderColor
        baseThumb.style.borderWidth = '0px'
        baseThumb.style.borderRadius = `${this.thumbRadius}px`

        let feature = cleanClone(baseThumb)
        feature.classList.remove('casepage_gallery-thumb')
        feature.classList.add('casepage_gallery-feature')
        feature.style.borderWidth = `${this.featureBorderWidth}px`
        feature.style.borderRadius = `${this.featureRadius}px`

        this.featureTemplate.remove()

        this.slotImages = []
        this.ticks = []

        for (let i = 0; i < this.sideCount; i++) {
            let thumb = cleanClone(baseThumb)
            this.slotImages.push(thumb)
            this.track.insertBefore(thumb, anchor)

            let tick = cleanClone(this.tickTemplate)
            this.ticks.push(tick)
            this.track.insertBefore(tick, anchor)
        }

        this.slotImages.push(feature)
        this.track.insertBefore(feature, anchor)

        for (let i = 0; i < this.sideCount; i++) {
            let tick = cleanClone(this.tickTemplate)
            this.ticks.push(tick)
            this.track.insertBefore(tick, anchor)

            let thumb = cleanClone(baseThumb)
            this.slotImages.push(thumb)
            this.track.insertBefore(thumb, anchor)
        }

        this.strips.forEach((strip) => strip.remove())
    }

    //Turns the track into a single-row CSS grid. `left:50%` puts the track's own left
    //edge at the stage's horizontal center once, statically — renderColumns() then only
    //has to shift it left by however far the "current center" sits from that left edge.

    layoutSlots() {
        this.track.style.cssText += `
            display: grid;
            column-gap: ${this.stripGap}px;
            align-items: end;
            width: max-content;
            height: ${this.featureSize.height}px;
            position: relative;
            left: 50%;
        `

        //Every offset gets a PERMANENT track number — lane 0 is always screen-center.
        //grid-row is pinned explicitly — without it, out-of-DOM-order grid-columns make
        //the browser auto-place items onto rows 2, 3... (a diagonal staircase)
        this.slotImages.forEach((el) => {
            el.style.cssText += 'margin: 0; max-width: none; min-width: 0; width: 100%; grid-row: 1;'
        })

        //Dividers never migrate — one style write ever, then they move with their neighbors
        let tickLift = -(this.controlsClearance + (this.thumbSize.height - this.tickSize.height) / 2)
        this.ticks.forEach((tick, i) => {
            tick.style.cssText += `margin: 0; grid-row: 1; grid-column: ${(i + 1) * 2}; transform: translateY(${tickLift}px);`
        })

        //radius/borderWidth interpolate with the size while dragging through fractional offsets
        let thumbGeometry = { width: this.thumbSize.width, height: this.thumbSize.height, liftY: -this.controlsClearance, radius: this.thumbRadius, borderWidth: 0 }
        this.geometryByOffset = {
            0: { width: this.featureSize.width, height: this.featureSize.height, liftY: 0, radius: this.featureRadius, borderWidth: this.featureBorderWidth },
        }
        for (let k = 1; k <= this.sideCount; k++) {
            this.geometryByOffset[k] = { ...thumbGeometry }
            this.geometryByOffset[-k] = { ...thumbGeometry }
        }
    }

    //State

    wrapIndex(n) {
        return ((n % this.cardCount) + this.cardCount) % this.cardCount
    }

    applyCard(el, cardIndex) {
        let photo = this.photos[cardIndex]
        if (!photo) return
        el.src = photo.src
        if (photo.srcset) el.srcset = photo.srcset
        else el.removeAttribute('srcset')
        el.alt = photo.alt
    }

    //Tells outside UI which real photo is centered now
    //photoIndex — defaults to the centered photo; a glide passes where it's about to land
    emitSettle(isInitial = false, photoIndex = this.activeIndex) {
        let photo = this.photos[photoIndex]
        if (!photo) return
        let detail = { index: photo.sourceIndex, count: this.sourceCount, data: photo.data, isInitial }
        this.stage.galleryState = detail
        this.stage.dispatchEvent(new CustomEvent(SETTLE_EVENT, { detail }))
    }

    //Interpolates the offset-keyed geometry table at a fractional offset

    lerpGeometry(offset) {
        let lower = Math.floor(offset)
        let upper = Math.ceil(offset)
        let a = this.geometryByOffset[lower]
        if (lower === upper) return a

        let b = this.geometryByOffset[upper]
        let t = offset - lower
        return {
            width: a.width + (b.width - a.width) * t,
            height: a.height + (b.height - a.height) * t,
            liftY: a.liftY + (b.liftY - a.liftY) * t,
            radius: a.radius + (b.radius - a.radius) * t,
            borderWidth: a.borderWidth + (b.borderWidth - a.borderWidth) * t,
        }
    }

    //Content lanes at odd positions, a fixed divider lane between each pair at even positions
    //(1-indexed, matching CSS's grid-column numbering)
    trackIndexForOffset(offset) {
        return (offset + this.sideCount) * 2 + 1
    }

    //The one shared paint pass — writes every LANE's current width into an explicit
    //grid-template-columns string, sets each occupant's height/shape, and re-centers the
    //track between the lane at offset 0 and its neighbor in the direction of travel.

    renderColumns() {
        let adjacentSign = this.progress > 0 ? 1 : (this.progress < 0 ? -1 : 0)
        let zeroCenter = 0
        let adjacentCenter = 0
        let cumulative = 0
        let templateParts = []

        for (let offset = -this.sideCount; offset <= this.sideCount; offset++) {
            if (offset > -this.sideCount) {
                //Real CSS column-gap already inserts stripGap on both sides of this divider track
                templateParts.push(`${this.tickSize.width}px`)
                cumulative += this.stripGap + this.tickSize.width + this.stripGap
            }

            let k = this.slotByOffset[offset]
            let el = this.slotImages[k]
            let continuousOffset = offset - this.progress
            let clampedOffset = Math.max(-this.sideCount, Math.min(this.sideCount, continuousOffset))
            let geometry = this.lerpGeometry(clampedOffset)

            let center = cumulative + geometry.width / 2
            if (offset === 0) zeroCenter = center
            if (offset === adjacentSign) adjacentCenter = center
            cumulative += geometry.width
            templateParts.push(`${geometry.width}px`)

            let overflow = Math.abs(continuousOffset) - this.visibleSideCount
            let opacity = overflow <= 0 ? 1 : Math.max(0, 1 - overflow)
            let isCentral = Math.round(clampedOffset) === 0

            gsap.set(el, {
                height: geometry.height,
                y: geometry.liftY,
                borderRadius: geometry.radius,
                borderWidth: geometry.borderWidth,
                opacity,
                zIndex: isCentral ? 2 : 1,
            })
        }

        this.track.style.gridTemplateColumns = templateParts.join(' ')

        let centerReference = adjacentSign === 0 ? zeroCenter : zeroCenter + (adjacentCenter - zeroCenter) * Math.abs(this.progress)
        gsap.set(this.track, { x: -centerReference })
    }

    //Instant positioning — used at init and for direct dot jumps (no in-between animation)

    snapTo(index) {
        this.activeIndex = this.wrapIndex(index)
        this.elementOffset = []
        this.elementCard = []
        this.slotByOffset = {}

        this.slotImages.forEach((el, k) => {
            let offset = k - this.centralSlot
            let cardIndex = this.wrapIndex(this.activeIndex + offset)
            let isCentral = offset === 0

            this.elementOffset[k] = offset
            this.elementCard[k] = cardIndex
            this.slotByOffset[offset] = k
            el.style.gridColumn = this.trackIndexForOffset(offset)

            el.classList.toggle('casepage_gallery-feature', isCentral)
            el.classList.toggle('casepage_gallery-thumb', !isCentral)
            this.applyCard(el, cardIndex)
        })

        this.progress = 0
        this.renderColumns()
        this.updateDots()
    }

    //Advances every image's settled offset by one lane (wrap-aware — an offset that would fall
    //off one edge teleports, invisibly past the visible fit, to the opposite edge and picks up
    //the next photo in that direction). Shared by the arrow/dot step and continuous drag alike.

    commitStep(direction) {
        this.activeIndex = this.wrapIndex(this.activeIndex + direction)
        this.slotByOffset = {}

        this.slotImages.forEach((el, k) => {
            let newOffset = this.elementOffset[k] - direction
            let wraps = newOffset < -this.sideCount || newOffset > this.sideCount

            if (wraps) {
                newOffset = direction > 0 ? this.sideCount : -this.sideCount
                this.elementCard[k] = this.wrapIndex(this.activeIndex + newOffset)
                this.applyCard(el, this.elementCard[k])
            }

            let isCentral = newOffset === 0
            el.classList.toggle('casepage_gallery-feature', isCentral)
            el.classList.toggle('casepage_gallery-thumb', !isCentral)
            this.elementOffset[k] = newOffset
            this.slotByOffset[newOffset] = k
            el.style.gridColumn = this.trackIndexForOffset(newOffset)
        })
    }

    //Animated one-step navigation. direction: +1 = next, -1 = previous. Tweens the shared
    //`progress` scalar through renderColumns() exactly like a drag would.

    step(direction) {
        if (this.isAnimating || this.isDragging || this.cardCount <= 1) return
        this.isAnimating = true

        let proxy = { value: 0 }
        this.stepTween?.kill()
        this.stepTween = gsap.to(proxy, {
            value: direction,
            duration: ANIMATION_DURATION,
            ease: ANIMATION_EASE,
            onUpdate: () => { this.progress = proxy.value; this.renderColumns() },
            onComplete: () => {
                this.commitStep(direction)
                this.progress = 0
                this.renderColumns()
                this.updateDots()
                this.isAnimating = false
                this.emitSettle()
            },
        })
    }

    //Glide — several lanes in one continuous move, through the same drag pipeline
    //(onDragProgress commits each lane as it's crossed), settling once at the end

    glide(lanes, duration = GLIDE_DEFAULT_DURATION) {
        if (this.isAnimating || this.isDragging || this.cardCount <= 1 || !lanes) return
        this.isAnimating = true

        this.dragProxy = { value: 0 }
        this.dragCommittedLanes = 0
        let hasSettled = false
        let settleEarly = () => {
            if (hasSettled) return
            hasSettled = true
            this.emitSettle(false, this.wrapIndex(this.activeIndex + lanes - this.dragCommittedLanes))
        }

        this.glideTween?.kill()
        this.glideTween = gsap.to(this.dragProxy, {
            value: lanes,
            duration,
            ease: GLIDE_EASE,
            onUpdate: () => {
                this.onDragProgress()
                if (this.glideTween?.progress() >= GLIDE_SETTLE_AT) settleEarly()
            },
            onComplete: () => {
                this.progress = 0
                this.renderColumns()
                this.updateDots()
                this.isAnimating = false
                //Always — a full loop lands on the same photo, and the requester waits for this
                settleEarly()
            },
        })
    }

    //Drag — continuous scrub. onDrag accumulates a raw target in lane units; a quickTo eases
    //the shared `progress` toward it (the "catch up" lag). Crossing a whole lane commits it.
    //Release snaps the target to the nearest lane and settles with a one-shot tween.

    bindDrag() {
        this.animate(Observer.create({
            target: this.track,
            type: 'touch,pointer',
            onPress: () => this.startDrag(),
            onDrag: (self) => this.updateDrag(self.deltaX),
            onRelease: () => this.endDrag(),
        }))
    }

    startDrag() {
        if (this.isAnimating) return
        if (this.dragProxy) gsap.killTweensOf(this.dragProxy)

        this.isDragging = true
        this.dragStartIndex = this.activeIndex
        this.dragProxy = { value: 0 }
        this.dragCommittedLanes = 0
        this.dragRawTarget = 0
        this.dragMoveTo = gsap.quickTo(this.dragProxy, 'value', {
            duration: DRAG_EASE_DURATION,
            ease: DRAG_CATCHUP_EASE,
            onUpdate: () => this.onDragProgress(),
        })
    }

    updateDrag(deltaX) {
        if (!this.isDragging) return
        this.dragRawTarget += -deltaX / this.dragPitch
        this.dragMoveTo(this.dragRawTarget)
    }

    onDragProgress() {
        let localFraction = this.dragProxy.value - this.dragCommittedLanes

        while (localFraction >= 1) { this.commitStep(1); this.dragCommittedLanes += 1; localFraction -= 1 }
        while (localFraction <= -1) { this.commitStep(-1); this.dragCommittedLanes -= 1; localFraction += 1 }

        this.progress = localFraction
        this.renderColumns()
    }

    endDrag() {
        if (!this.isDragging) return
        this.isDragging = false
        this.isAnimating = true

        gsap.killTweensOf(this.dragProxy)
        let settledTarget = Math.round(this.dragRawTarget)

        this.animate(gsap.to(this.dragProxy, {
            value: settledTarget,
            duration: DRAG_EASE_DURATION,
            ease: DRAG_SETTLE_EASE,
            onUpdate: () => this.onDragProgress(),
            onComplete: () => {
                this.progress = 0
                this.renderColumns()
                this.updateDots()
                this.isAnimating = false
                //A tap or a drag that settled back on the same photo isn't a change
                if (this.activeIndex !== this.dragStartIndex) this.emitSettle()
            },
        }))
    }

    bindArrows() {
        let prev = this.stage.querySelector('[data-gallery="prev"]')
        let next = this.stage.querySelector('[data-gallery="next"]')
        if (prev) this.listen(prev, 'click', (event) => { event.preventDefault(); this.step(-1) })
        if (next) this.listen(next, 'click', (event) => { event.preventDefault(); this.step(1) })
    }

    //Outside controls (team nav) — same guards as the stage's own arrows / dots
    bindExternalControls() {
        this.listen(this.stage, STEP_EVENT, (event) => {
            let direction = event.detail?.direction === -1 ? -1 : 1
            this.step(direction)
        })
        this.listen(this.stage, GO_EVENT, (event) => {
            let index = event.detail?.index
            if (!Number.isInteger(index) || index < 0 || index >= this.sourceCount) return
            if (this.isAnimating || this.isDragging) return
            if (this.photos[this.activeIndex]?.sourceIndex === index) return
            this.snapTo(index) //first occurrence of a real photo is its own index
            this.emitSettle()
        })
        this.listen(this.stage, GLIDE_EVENT, (event) => {
            let lanes = Math.round(event.detail?.lanes ?? 0)
            let duration = event.detail?.duration
            this.glide(lanes, Number.isFinite(duration) && duration > 0 ? duration : GLIDE_DEFAULT_DURATION)
        })
    }

    //Dots — 1:1 and clickable up to MAX_DOTS; beyond that, a proportional progress row only

    syncDots() {
        this.dotsContainer = this.stage.querySelector('[data-gallery="dots"]')
        let template = this.dotsContainer?.querySelector('.casepage_gallery-dot')
        if (!this.dotsContainer || !template) {
            this.dots = []
            return
        }

        let dotCount = Math.min(this.cardCount, MAX_DOTS)
        this.dotsContainer.innerHTML = ''
        this.dots = []
        for (let i = 0; i < dotCount; i++) {
            let dot = cleanClone(template)
            dot.classList.remove('is-active')
            this.dotsContainer.appendChild(dot)
            this.dots.push(dot)
        }
    }

    bindDots() {
        if (this.cardCount > MAX_DOTS) return //progress-only display, not individually addressable

        this.dots.forEach((dot, index) => {
            this.listen(dot, 'click', () => {
                if (this.isAnimating || this.isDragging || index === this.activeIndex) return
                this.snapTo(index)
                this.emitSettle()
            })
        })
    }

    updateDots() {
        if (this.dots.length === 0) return
        let activeDotIndex = Math.floor((this.activeIndex / this.cardCount) * this.dots.length)
        this.dots.forEach((dot, index) => dot.classList.toggle('is-active', index === activeDotIndex))
    }

    //Cursor — .casepage_gallery-hint becomes a custom cursor that follows the
    //pointer while hovering the drag zone (inert on touch, no persistent pointer there)

    bindCursor() {
        let cursor = this.stage.querySelector('.casepage_gallery-hint')
        if (!cursor) return

        cursor.style.cssText += `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            opacity: 0 !important;
            transform: translate(-50%, -50%) !important;
        `
        this.track.style.cursor = 'none'

        const moveX = gsap.quickTo(cursor, 'left', { duration: CURSOR_FOLLOW_DURATION, ease: 'power3.out' })
        const moveY = gsap.quickTo(cursor, 'top', { duration: CURSOR_FOLLOW_DURATION, ease: 'power3.out' })

        this.listen(this.track, 'mouseenter', () => {
            gsap.to(cursor, { opacity: 1, duration: CURSOR_FADE_DURATION })
        })
        this.listen(this.track, 'mouseleave', () => {
            gsap.to(cursor, { opacity: 0, duration: CURSOR_FADE_DURATION })
        })
        this.listen(this.track, 'mousemove', (event) => {
            moveX(event.clientX)
            moveY(event.clientY)
        })
    }

    destroy() {
        this.stepTween?.kill()
        this.glideTween?.kill()
        if (this.dragProxy) gsap.killTweensOf(this.dragProxy)
        super.destroy()
    }
}
