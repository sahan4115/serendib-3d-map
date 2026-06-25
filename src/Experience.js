import * as THREE from 'three'
import gsap from 'gsap'
import { Environment } from './World/Environment.js'
import { Terrain } from './World/Terrain.js'
import { Ocean } from './World/Ocean.js'
import { Clouds } from './World/Clouds.js'
import { Birds } from './World/Birds.js'
import { CameraRig } from './CameraRig.js'
import { Markers } from './Markers.js'
import { Landmarks } from './Landmarks.js'
import { UI } from './UI.js'
import { DESTINATIONS } from './data/destinations.js'
import { state, on } from './state.js'

export class Experience {
  constructor(canvas, uiRoot) {
    this.canvas = canvas
    this.uiRoot = uiRoot
    this.sizes = { w: window.innerWidth, h: window.innerHeight }
    this.clock = new THREE.Clock()
    this._timeProxy = { v: 0 }
  }

  async init() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(this.sizes.w, this.sizes.h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(46, this.sizes.w / this.sizes.h, 0.1, 2000)

    this.ui = new UI(this.uiRoot)

    this.manager = new THREE.LoadingManager()
    this.manager.onProgress = (url, loaded, total) => this.ui.setProgress(loaded / total)

    this.environment = new Environment(this)
    this.terrain = new Terrain(this)
    await this.terrain.load()
    this.ocean = new Ocean(this)
    this.clouds = new Clouds(this)
    this.birds = new Birds(this)
    this.environment.setTimeOfDay(0)

    this.rig = new CameraRig(this)
    this.markers = new Markers(this)
    this.markers.setVisible(false)
    this.landmarks = new Landmarks(this)

    this.canvas.style.cursor = 'grab'
    this._wire()

    window.addEventListener('resize', () => this.resize())
    this.renderer.setAnimationLoop(() => this.tick())

    // a beat for the loader to fill, then reveal the intro
    this.ui.setProgress(1)
    gsap.delayedCall(0.45, () => {
      this.ui.ready()
      state.phase = 'intro'
    })

    window.__lanka = this
  }

  _wire() {
    on('enter', () => {
      state.phase = 'map'
      this.ui.enterMap()
      this.markers.setVisible(true)
      this.rig.enable(true)
      this.rig.introReveal()
      this.clouds.setCover(0.5, 3.2)
    })
    on('focus', (id) => this.focus(id))
    on('home', () => this.home())
    on('toggleTime', () => this.toggleTime())
    on('step', (dir) => this.step(dir))
  }

  focus(id) {
    const d = DESTINATIONS.find((x) => x.id === id)
    const uv = this.terrain.meta.destinations[id]
    if (!d || !uv) return
    const world = this.terrain.uvToWorld(uv.u, uv.v, 0)
    state.phase = 'focused'
    state.active = id
    this.rig.enable(false)
    this.rig.flyTo(world, { azim: d.azim ?? 0.06, dist: 27, polar: 1.04, lift: 1.6 })
    this.markers.setActive(id)
    this.ui.openDrawer(d)
    this.ui.setActiveMenu(id)
  }

  home() {
    if (state.phase === 'intro' || state.phase === 'loading') return
    state.phase = 'map'
    state.active = null
    this.rig.enable(true)
    this.rig.toOverview()
    this.markers.setActive(null)
    this.markers.setVisible(true)
    this.ui.closeDrawer()
    this.ui.setActiveMenu(null)
  }

  step(dir) {
    const i = DESTINATIONS.findIndex((x) => x.id === state.active)
    if (i < 0) return
    const n = DESTINATIONS.length
    this.focus(DESTINATIONS[(i + dir + n) % n].id)
  }

  toggleTime() {
    const t = state.timeOfDay > 0.5 ? 0 : 1
    state.timeOfDay = t
    gsap.to(this._timeProxy, {
      v: t,
      duration: 1.6,
      ease: 'sine.inOut',
      onUpdate: () => this.environment.setTimeOfDay(this._timeProxy.v),
    })
    this.ui.setTimeIcon(t)
  }

  resize() {
    this.sizes.w = window.innerWidth
    this.sizes.h = window.innerHeight
    this.camera.aspect = this.sizes.w / this.sizes.h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.sizes.w, this.sizes.h)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  tick() {
    const t = this.clock.getElapsedTime()
    this.ocean.update(t)
    if (this.clouds) this.clouds.update(t)
    if (this.birds) this.birds.update(t)
    this.rig.update()
    this.markers.update()
    this.ui.setHeading(this.rig.rig.azim)
    this.renderer.render(this.scene, this.camera)
  }
}
