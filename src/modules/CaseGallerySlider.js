import { gsap, Observer } from '../core/gsap'
import { Module } from '../core/Module'

//Case-study photo gallery. A row of real photos (.casepage_gallery-images, hidden
//data pool) gets poured into a fixed number of columns in a single CSS grid row:
//1 large "feature" column plus N small "thumb" columns on each side, dividers
//sitting as real grid columns between them. How many columns fit is computed from
//the actual viewport width, not hardcoded — the gallery always spans the full
//page, edge to edge, regardless of how narrow/wide the screen is.
//
//Everything lives in ONE shared render pass (renderColumns): each column's width/
//height/radius/border is looked up from an offset-keyed geometry table and written
//straight to the element — the grid's own auto-column-sizing handles horizontal
//position, so there is no manual x/tick math to keep in sync. The whole track is
//then shifted with a single translateX so whichever offset is "closest to center"
//lands at the visual middle. Dividers are just grid columns too — once built they
//are never touched again; they move for free whenever their neighboring columns resize.
//
//Infinite loop: every column has a floating "offset" (-sideCount..+sideCount from
//center) tracked in elementOffset[]. commitStep() shifts every offset by one; the
//column that would fall off one edge teleports (invisibly, past the visible fit —
//see WRAP_BUFFER_LANES) to the opposite edge and picks up the next photo in that
//direction. Arrow/dot clicks and drag both drive the same shared `progress` scalar
//through the same renderColumns()/commitStep() pair — one code path, so a divider
//or image can never end up out of sync with what's on screen.
//
//Fewer real photos than fit on screen? They repeat in order to fill every slot.
//More photos than fit? The extra ones are only reached by dragging/paging further.

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

export class CaseGallerySlider extends Module {

    setup() {
        this.stage = document.querySelector('.casepage_gallery-stage')
        this.track = document.querySelector('.casepage_gallery-track')
        this.pool = [...document.querySelectorAll('.casepage_gallery-images .casepage_gallery-image_actual')]
        if (!this.stage || !this.track || this.pool.length === 0) return

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

        this.bindArrows()
        this.bindDots()
        this.bindCursor()
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
        let controls = document.querySelector('.casepage_gallery-controls')
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

    //Photo pool — read real src/alt from the hidden data pool, repeat in order if
    //there are fewer photos than slots to fill

    buildPhotoList() {
        let sources = this.pool.map((img) => ({
            src: img.currentSrc || img.src,
            srcset: img.getAttribute('srcset') || '',
            alt: img.getAttribute('alt') || '',
        }))

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
    //change later, never which physical slot holds an image vs a divider. A divider
    //therefore never needs its own position logic: it moves for free whenever its
    //neighboring image columns resize, because that's just how CSS grid works.

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

        //DOM order no longer matters for layout (every element gets an explicit
        //grid-column — see layoutSlots), only for where the clones physically land
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
    //has to shift it left by however far the "current center" sits from that left edge,
    //instead of juggling the stage's absolute width every frame.

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

        //Every offset gets a PERMANENT track number — lane 0 is always screen-center,
        //lane -sideCount is always the far-left buffer, etc. An image's grid-column is
        //reassigned to match its current offset on every commit (a style write, not a
        //DOM move), which is what lets it "teleport" across the whole strip on a wrap
        //instead of being stuck wherever it happens to sit in the DOM.
        //grid-row is pinned explicitly everywhere below — without it, a grid item with
        //only grid-column set still goes through row auto-placement, and since these
        //column numbers get reassigned out of DOM order on every commit, the browser
        //can decide two items "collide" and stack one onto row 2, 3... (the diagonal
        //staircase this caused)
        this.slotImages.forEach((el) => {
            el.style.cssText += 'margin: 0; max-width: none; min-width: 0; width: 100%; grid-row: 1;'
        })

        //Dividers never migrate — a tick's lane is fixed forever at build time, so it
        //needs exactly one style write, ever, and then moves for free whenever its
        //neighboring image lanes resize
        let tickLift = -(this.controlsClearance + (this.thumbSize.height - this.tickSize.height) / 2)
        this.ticks.forEach((tick, i) => {
            tick.style.cssText += `margin: 0; grid-row: 1; grid-column: ${(i + 1) * 2}; transform: translateY(${tickLift}px);`
        })

        //radius/borderWidth live on the geometry table too, not just width/height —
        //dragging scrubs continuously through fractional offsets, so the thumb<->feature
        //shape morph has to interpolate the same way the size does. liftY replaces the
        //old absolute-position "bottom" offset — a translateY off the grid's own
        //bottom-aligned resting position (align-items:end)
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

    //Every offset has a permanent grid-column track number — content lanes at odd
    //positions, a fixed divider lane between each pair at even positions (1-indexed,
    //matching CSS's grid-column numbering)
    trackIndexForOffset(offset) {
        return (offset + this.sideCount) * 2 + 1
    }

    //The one shared paint pass — reads elementOffset[]/progress, writes every LANE's
    //current width into an explicit grid-template-columns string (lanes are fixed;
    //which physical image occupies one only changes at a commit, via grid-column —
    //see snapTo/commitStep), sets each occupant's height/shape, and re-centers the
    //track. Used for instant snaps, the arrow/dot tween's onUpdate, and live drag
    //alike, so a divider or image can never end up out of step with the DOM.
    //
    //Track centering: walks lanes -sideCount..sideCount accumulating pixel position
    //(a divider lane's width plus the uniform column-gap sits between every pair),
    //and tracks the on-screen center of the lane currently at offset 0 and the lane
    //one step over in the direction of travel — the point exactly between them,
    //weighted by the leftover fraction, is what gets centered.

    renderColumns() {
        let adjacentSign = this.progress > 0 ? 1 : (this.progress < 0 ? -1 : 0)
        let zeroCenter = 0
        let adjacentCenter = 0
        let cumulative = 0
        let templateParts = []

        for (let offset = -this.sideCount; offset <= this.sideCount; offset++) {
            if (offset > -this.sideCount) {
                //Real CSS column-gap (set once in layoutSlots) already inserts stripGap
                //on both sides of this divider track — only push its own track size here
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

    //Advances every image's settled offset by one lane (wrap-aware — an offset that
    //would fall off one edge teleports, invisibly past the visible fit, to the
    //opposite edge and picks up the next photo in that direction). Shared by the
    //discrete arrow/dot step and continuous drag alike — one place that can get the
    //wrap math wrong instead of two.

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

    //Animated one-step navigation (arrows). direction: +1 = next, -1 = previous. Tweens
    //the shared `progress` scalar through renderColumns() exactly like a drag would —
    //the wrap fade/teleport falls out of renderColumns' own opacity formula for free,
    //no separate fade choreography needed here.

    step(direction) {
        if (this.isAnimating || this.isDragging || this.cardCount <= 1) return
        this.isAnimating = true

        let proxy = { value: 0 }
        this.animate(gsap.to(proxy, {
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
            },
        }))
    }

    //Drag — continuous scrub. onDrag accumulates a raw target (dragRawTarget, in lane
    //units — dragPitch is the pixel span of one lane); a gsap.quickTo eases the shared
    //`progress` toward that target instead of jumping straight to it, which is what
    //gives the motion its "catch up" lag instead of tracking the finger exactly 1:1.
    //Crossing a whole lane commits it (commitStep, same wrap rule as an arrow click).
    //Release snaps the target to the nearest lane and hands off to a one-shot tween
    //that eases the rest of the way and finalizes state on completion.

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
            },
        }))
    }

    bindArrows() {
        let prev = document.querySelector('[data-gallery="prev"]')
        let next = document.querySelector('[data-gallery="next"]')
        if (prev) this.listen(prev, 'click', (event) => { event.preventDefault(); this.step(-1) })
        if (next) this.listen(next, 'click', (event) => { event.preventDefault(); this.step(1) })
    }

    //Dots — 1:1 and clickable up to MAX_DOTS; beyond that, a proportional progress row only

    syncDots() {
        this.dotsContainer = document.querySelector('[data-gallery="dots"]')
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
        let cursor = document.querySelector('.casepage_gallery-hint')
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
}
