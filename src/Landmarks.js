import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DESTINATIONS } from './data/destinations.js'
import { state, emit } from './state.js'
import { url } from './embedded-assets.js'

/*
 * 3D landmark models (built in Blender) placed on the island at each
 * destination's real position. They double as raycast-clickable markers:
 * a tap on a model flies the camera in and opens its drawer.
 */
export class Landmarks {
  constructor(exp) {
    this.exp = exp
    this.group = new THREE.Group()
    exp.scene.add(this.group)
    this.clickTargets = []
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()

    const loader = new GLTFLoader()
    const meta = exp.terrain.meta.destinations
    for (const d of DESTINATIONS) {
      if (!d.model || !meta[d.id]) continue
      const uv = meta[d.id]
      const pos = exp.terrain.uvToWorld(uv.u, uv.v, d.model.sink ?? 0)
      loader.load(url(d.model.url), (gltf) => {
        const obj = gltf.scene
        obj.position.copy(pos)
        obj.scale.setScalar(d.model.scale ?? 1)
        if (d.model.rotY) obj.rotation.y = d.model.rotY
        obj.traverse((o) => {
          if (o.isMesh) {
            o.userData.destId = d.id
            o.castShadow = o.receiveShadow = true
            this.clickTargets.push(o)
          }
        })
        obj.userData.destId = d.id
        this.group.add(obj)
        d._model3d = obj
      })
    }

    this._bindClick()
  }

  _bindClick() {
    const el = this.exp.canvas
    let dx = 0,
      dy = 0
    el.addEventListener('pointerdown', (e) => {
      dx = e.clientX
      dy = e.clientY
    })
    el.addEventListener('click', (e) => {
      if (state.phase !== 'map') return
      if (Math.abs(e.clientX - dx) + Math.abs(e.clientY - dy) > 8) return // was a drag
      const r = el.getBoundingClientRect()
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
      this.pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
      this.raycaster.setFromCamera(this.pointer, this.exp.camera)
      const hits = this.raycaster.intersectObjects(this.clickTargets, true)
      if (!hits.length) return
      let o = hits[0].object
      while (o && !o.userData.destId) o = o.parent
      if (o) emit('focus', o.userData.destId)
    })
  }
}
