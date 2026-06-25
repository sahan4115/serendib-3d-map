import * as THREE from 'three'
import gsap from 'gsap'

/*
 * Camera as a target + spherical offset (tx,ty,tz, dist, polar, azim).
 *  - overview: near top-down, drag to pan across the island, wheel to zoom
 *  - focus:    GSAP-tweened low cinematic angle flown in onto a destination
 * polar is measured from vertical (0 = straight down).
 */
// north is at -Z (see Terrain flipY), so azim 0 views from the south: north-up,
// east-right, not mirrored.
const OVERVIEW = { dist: 168, polar: 0.32, azim: 0, ty: 0 }
const FOCUS = { dist: 30, polar: 1.06, azim: 0.06 }

export class CameraRig {
  constructor(exp) {
    this.exp = exp
    this.camera = exp.camera
    this.bounds = { x: exp.terrain.width * 0.52, z: exp.terrain.depth * 0.52 }

    this.rig = { tx: 0, ty: 0, tz: 6, dist: OVERVIEW.dist, polar: OVERVIEW.polar, azim: OVERVIEW.azim }
    this.mode = 'overview'
    this.animating = false

    this.vel = { x: 0, z: 0 }
    this._drag = null
    this._enabled = false

    this._bind()
    this.apply()
  }

  enable(on) {
    this._enabled = on
  }

  _bind() {
    const el = this.exp.canvas
    el.addEventListener('pointerdown', (e) => {
      if (!this._enabled || this.mode !== 'overview' || this.animating) return
      this._drag = { x: e.clientX, y: e.clientY, moved: 0 }
      this.vel.x = this.vel.z = 0
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    })
    el.addEventListener('pointermove', (e) => {
      if (!this._drag) return
      const dx = e.clientX - this._drag.x
      const dy = e.clientY - this._drag.y
      this._drag.x = e.clientX
      this._drag.y = e.clientY
      this._drag.moved += Math.abs(dx) + Math.abs(dy)
      this._pan(dx, dy)
    })
    const end = (e) => {
      if (!this._drag) return
      this._drag = null
      el.style.cursor = 'grab'
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {}
    }
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener(
      'wheel',
      (e) => {
        if (!this._enabled || this.mode !== 'overview' || this.animating) return
        e.preventDefault()
        this.rig.dist = THREE.MathUtils.clamp(this.rig.dist + e.deltaY * 0.08, 95, 220)
      },
      { passive: false }
    )
  }

  _groundBasis() {
    const a = this.rig.azim
    const forward = new THREE.Vector3(-Math.sin(a), 0, -Math.cos(a)) // camera -> target, on ground
    const right = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a))
    return { forward, right }
  }

  _pan(dx, dy) {
    const { forward, right } = this._groundBasis()
    const k = this.rig.dist * 0.0019
    const mx = -right.x * dx + forward.x * dy
    const mz = -right.z * dx + forward.z * dy
    this.rig.tx += mx * k
    this.rig.tz += mz * k
    this.vel.x = mx * k
    this.vel.z = mz * k
    this._clamp()
  }

  _clamp() {
    this.rig.tx = THREE.MathUtils.clamp(this.rig.tx, -this.bounds.x, this.bounds.x)
    this.rig.tz = THREE.MathUtils.clamp(this.rig.tz, -this.bounds.z, this.bounds.z)
  }

  apply() {
    const { tx, ty, tz, dist, polar, azim } = this.rig
    const sp = Math.sin(polar)
    const cp = Math.cos(polar)
    this.camera.position.set(
      tx + sp * Math.sin(azim) * dist,
      ty + cp * dist,
      tz + sp * Math.cos(azim) * dist
    )
    this.camera.lookAt(tx, ty, tz)
  }

  flyTo(worldPos, opts = {}) {
    gsap.killTweensOf(this.rig)
    this.animating = true
    this.mode = 'focus'
    gsap.to(this.rig, {
      tx: worldPos.x,
      ty: worldPos.y + (opts.lift ?? 1.4),
      tz: worldPos.z,
      dist: opts.dist ?? FOCUS.dist,
      polar: opts.polar ?? FOCUS.polar,
      azim: opts.azim ?? FOCUS.azim,
      duration: opts.duration ?? 2.0,
      ease: 'power3.inOut',
      onComplete: () => (this.animating = false),
    })
  }

  toOverview(opts = {}) {
    gsap.killTweensOf(this.rig)
    this.animating = true
    this.mode = 'overview'
    gsap.to(this.rig, {
      tx: 0,
      ty: 0,
      tz: 6,
      dist: OVERVIEW.dist,
      polar: OVERVIEW.polar,
      azim: OVERVIEW.azim,
      duration: opts.duration ?? 1.7,
      ease: 'power3.inOut',
      onComplete: () => (this.animating = false),
    })
  }

  // gentle intro push-in from very high
  introReveal() {
    this.rig.dist = 360
    this.rig.polar = 0.06
    gsap.to(this.rig, {
      dist: OVERVIEW.dist,
      polar: OVERVIEW.polar,
      duration: 2.6,
      ease: 'power2.out',
    })
  }

  update() {
    // momentum when not dragging in overview
    if (!this._drag && this.mode === 'overview' && !this.animating) {
      if (Math.abs(this.vel.x) > 1e-4 || Math.abs(this.vel.z) > 1e-4) {
        this.rig.tx += this.vel.x
        this.rig.tz += this.vel.z
        this.vel.x *= 0.92
        this.vel.z *= 0.92
        this._clamp()
      }
    }
    this.apply()
  }
}
