import * as THREE from 'three'
import { DESTINATIONS, CATEGORIES } from './data/destinations.js'
import { emit } from './state.js'

/*
 * HTML markers projected from their 3D world positions each frame (crisp text,
 * easy hover/click — the same approach the reference site uses over its canvas).
 */
export class Markers {
  constructor(exp) {
    this.exp = exp
    this.layer = document.createElement('div')
    this.layer.className = 'markers'
    exp.uiRoot.appendChild(this.layer)

    const meta = exp.terrain.meta.destinations
    this.items = DESTINATIONS.filter((d) => meta[d.id]).map((d) => {
      const uv = meta[d.id]
      const world = exp.terrain.uvToWorld(uv.u, uv.v, 0.25)
      const cat = CATEGORIES[d.category]
      const el = document.createElement('button')
      el.className = 'marker'
      el.style.setProperty('--c', cat.color)
      el.innerHTML = `
        <span class="marker__dot"></span>
        <span class="marker__label">
          <span class="marker__cat">${cat.label}</span>
          <span class="marker__name">${d.name}</span>
        </span>`
      el.addEventListener('pointerdown', (e) => e.stopPropagation())
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        emit('focus', d.id)
      })
      this.layer.appendChild(el)
      return { d, world, el }
    })
    this._v = new THREE.Vector3()
    this._visible = false
  }

  setActive(id) {
    for (const it of this.items) it.el.classList.toggle('is-active', it.d.id === id)
  }

  setVisible(on) {
    this._visible = on
    this.layer.style.opacity = on ? '1' : '0'
  }

  update() {
    const cam = this.exp.camera
    const { w, h } = this.exp.sizes
    const camPos = cam.position
    for (const it of this.items) {
      // never interactive (or even positioned-as-clickable) while hidden
      if (!this._visible) {
        it.el.style.pointerEvents = 'none'
        continue
      }
      this._v.copy(it.world).project(cam)
      const inFront = this._v.z < 1
      if (!inFront) {
        it.el.style.opacity = '0'
        it.el.style.pointerEvents = 'none'
        continue
      }
      const x = (this._v.x * 0.5 + 0.5) * w
      const y = (-this._v.y * 0.5 + 0.5) * h
      // fade distant markers a touch for depth
      const dist = camPos.distanceTo(it.world)
      const op = THREE.MathUtils.clamp(1.2 - dist / 320, 0.25, 1)
      it.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`
      it.el.style.opacity = String(op)
      it.el.style.pointerEvents = 'auto'
    }
  }
}
