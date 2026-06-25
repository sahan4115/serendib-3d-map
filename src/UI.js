import { DESTINATIONS, CATEGORIES } from './data/destinations.js'
import { emit } from './state.js'
import { url } from './embedded-assets.js'

const cat = (id) => CATEGORIES[id]

export class UI {
  constructor(root) {
    this.root = root
    root.classList.add('phase-loading')
    root.insertAdjacentHTML(
      'beforeend',
      `
      <div class="loader">
        <div class="loader__mark"><span class="loader__ring"></span><span class="loader__glyph">ශ්‍රී</span></div>
        <div class="loader__title eyebrow">Serendib</div>
        <div class="loader__bar"><i></i></div>
        <div class="loader__pct">0</div>
      </div>

      <header class="hdr">
        <button class="brand" data-home>
          <span class="brand__name">Serendib</span>
          <span class="brand__sub">THE ISLE OF CEYLON</span>
        </button>
        <div class="hdr__actions">
          <button class="hdr__cta uline" data-gallery>Gallery</button>
          <button class="hdr__cta uline" data-inquire>Plan a Journey</button>
        </div>
      </header>

      <section class="hero">
        <p class="eyebrow reveal" data-r="1">The Wonder of Asia</p>
        <h1 class="hero__title display reveal" data-r="2">Eight Wonders,<br/><em>One Island</em></h1>
        <p class="hero__sub reveal" data-r="3">Drift above Sri Lanka and wander from the highland tea country to the leopard plains and the southern shore.</p>
        <div class="hero__cta reveal" data-r="4">
          <button class="btn" data-enter><span>Explore the island</span></button>
        </div>
      </section>

      <div class="chrome">
        <div class="hint" data-hint>Drag to drift across the island · choose a marker</div>
        <button class="compass" data-home aria-label="Recentre">
          <svg viewBox="0 0 48 48"><g class="compass__rose"><circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1" opacity="0.4"/><path d="M24 6 L27 24 L24 28 L21 24 Z" fill="currentColor"/><path d="M24 42 L21 24 L24 20 L27 24 Z" fill="currentColor" opacity="0.4"/></g><text x="24" y="5.5" text-anchor="middle" font-size="5" fill="currentColor">N</text></svg>
        </button>
        <button class="daynight" data-time aria-label="Time of day"><span class="daynight__icon">☀</span></button>
        <div class="menu">
          <button class="menu__toggle"><span>Explore Sri Lanka</span><i>▾</i></button>
          <ul class="menu__list">
            ${DESTINATIONS.map(
              (d) =>
                `<li><button data-go="${d.id}"><span class="dot" style="background:${cat(d.category).color}"></span>${d.name}<em>${cat(d.category).label}</em></button></li>`
            ).join('')}
          </ul>
        </div>
      </div>

      <aside class="drawer">
        <button class="drawer__close" data-home>Close <span>✕</span></button>
        <div class="drawer__media"><img alt="" /><span class="drawer__cat"></span></div>
        <div class="drawer__body">
          <p class="eyebrow drawer__eyebrow"></p>
          <h2 class="drawer__title display"></h2>
          <p class="drawer__region"></p>
          <p class="drawer__desc"></p>
          <div class="drawer__nav">
            <button class="btn btn--solid" data-inquire><span>Plan this journey</span></button>
            <div class="drawer__steps">
              <button data-step="-1" aria-label="Previous">←</button>
              <button data-step="1" aria-label="Next">→</button>
            </div>
          </div>
        </div>
      </aside>

      <div class="gallery" data-gallery-overlay>
        <button class="gallery__close" data-gallery-close>Close <span>✕</span></button>
        <div class="gallery__inner">
          <p class="eyebrow gallery__eyebrow">Crafted in 3D · Blender + Cycles</p>
          <h2 class="gallery__title display">The Island, Rendered</h2>
          <div class="gallery__stage">
            <video class="gallery__media" data-gallery-video src="gallery/turntable.mp4" autoplay loop muted playsinline></video>
            <img class="gallery__media" data-gallery-img hidden alt="Serendib render" />
          </div>
          <div class="gallery__thumbs">
            <button class="gallery__thumb is-active" data-pick="video"><span class="gallery__play">▶</span>Turntable</button>
            <button class="gallery__thumb" data-pick="gallery/hero.jpg"><img src="gallery/hero.jpg" alt="" />Highlands</button>
            <button class="gallery__thumb" data-pick="gallery/island.jpg"><img src="gallery/island.jpg" alt="" />The Island</button>
            <button class="gallery__thumb" data-pick="gallery/region.jpg"><img src="gallery/region.jpg" alt="" />Forests</button>
            <button class="gallery__thumb" data-pick="gallery/aerial.jpg"><img src="gallery/aerial.jpg" alt="" />Aerial</button>
          </div>
          <p class="gallery__caption">Built in Blender from real elevation, satellite imagery, forest cover and the OpenStreetMap road network — lit and rendered in Cycles on the GPU.</p>
        </div>
      </div>

      <div class="toast" data-toast></div>
    `
    )

    this.$ = (s) => root.querySelector(s)
    this.loader = this.$('.loader')
    this.bar = this.$('.loader__bar i')
    this.pct = this.$('.loader__pct')
    this.menu = this.$('.menu')

    // events
    root.querySelectorAll('[data-home]').forEach((b) => b.addEventListener('click', () => emit('home')))
    this.$('[data-enter]').addEventListener('click', () => emit('enter'))
    this.$('[data-time]').addEventListener('click', () => emit('toggleTime'))
    root.querySelectorAll('[data-inquire]').forEach((b) =>
      b.addEventListener('click', () => this.toast('Our travel desk is being prepared — check back soon.'))
    )
    // gallery
    this.$('[data-gallery]').addEventListener('click', () => this.openGallery())
    this.$('[data-gallery-close]').addEventListener('click', () => this.closeGallery())
    this.$('[data-gallery-overlay]').addEventListener('click', (e) => {
      if (e.target === this.$('[data-gallery-overlay]')) this.closeGallery()
    })
    root.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => this.pickGallery(b))
    )
    this.$('.menu__toggle').addEventListener('click', () => this.menu.classList.toggle('open'))
    root.querySelectorAll('[data-go]').forEach((b) =>
      b.addEventListener('click', () => {
        this.menu.classList.remove('open')
        emit('focus', b.dataset.go)
      })
    )
    root.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => emit('step', Number(b.dataset.step)))
    )
  }

  setProgress(p) {
    const v = Math.round(p * 100)
    this.bar.style.width = v + '%'
    this.pct.textContent = v
  }

  ready() {
    this.root.classList.remove('phase-loading')
    this.root.classList.add('phase-intro')
    requestAnimationFrame(() => this.root.classList.add('intro-in'))
  }

  enterMap() {
    this.root.classList.remove('phase-intro', 'intro-in')
    this.root.classList.add('phase-map')
    setTimeout(() => this.$('[data-hint]')?.classList.add('hide'), 5200)
  }

  openDrawer(d) {
    const c = cat(d.category)
    this.$('.drawer__media img').src = url(d.image)
    this.$('.drawer__media img').alt = d.name
    const tag = this.$('.drawer__cat')
    tag.textContent = c.label
    tag.style.background = c.color
    this.$('.drawer__eyebrow').textContent = d.eyebrow
    this.$('.drawer__title').textContent = d.name
    this.$('.drawer__region').textContent = d.region
    this.$('.drawer__desc').textContent = d.description
    this.root.classList.add('drawer-open')
  }

  closeDrawer() {
    this.root.classList.remove('drawer-open')
  }

  setActiveMenu(id) {
    this.root.querySelectorAll('[data-go]').forEach((b) =>
      b.parentElement.classList.toggle('active', b.dataset.go === id)
    )
  }

  setTimeIcon(t) {
    this.$('.daynight__icon').textContent = t > 0.5 ? '☾' : '☀'
  }

  setHeading(azim) {
    const rose = this.$('.compass__rose')
    if (rose) rose.style.transform = `rotate(${-azim}rad)`
  }

  toast(msg) {
    const t = this.$('[data-toast]')
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(this._tt)
    this._tt = setTimeout(() => t.classList.remove('show'), 3200)
  }

  openGallery() {
    this.root.classList.add('gallery-open')
    const v = this.$('[data-gallery-video]')
    if (v && !v.hidden) v.play().catch(() => {})
  }

  closeGallery() {
    this.root.classList.remove('gallery-open')
    const v = this.$('[data-gallery-video]')
    if (v) v.pause()
  }

  pickGallery(btn) {
    this.root.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-active', b === btn))
    const v = this.$('[data-gallery-video]')
    const img = this.$('[data-gallery-img]')
    const pick = btn.dataset.pick
    if (pick === 'video') {
      img.hidden = true
      v.hidden = false
      v.play().catch(() => {})
    } else {
      v.pause()
      v.hidden = true
      img.src = pick
      img.hidden = false
    }
  }
}
