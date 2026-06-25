import * as THREE from 'three'
import { CFG } from '../config.js'
import { META, url } from '../embedded-assets.js'

/*
 * The island. A high-res plane displaced on the GPU from the 24-bit-encoded
 * heightmap, surfaced with the stylised satellite albedo + a DEM normal map,
 * and clipped to the coastline by the land mask. A CPU copy of the heightmap
 * answers getHeightAt(u,v) so markers sit exactly on the surface.
 */
function loadImage(url, manager) {
  return new Promise((resolve, reject) => {
    new THREE.ImageLoader(manager).load(url, resolve, undefined, reject)
  })
}

export class Terrain {
  constructor(exp) {
    this.exp = exp
  }

  async load() {
    const manager = this.exp.manager
    this.meta = META
    this.aspect = this.meta.aspect // w / h

    const texLoader = new THREE.TextureLoader(manager)
    const loadTex = (u) => new Promise((res) => texLoader.load(u, res))
    const [albedo, normal, mask, heightImg] = await Promise.all([
      loadTex(url('/terrain/albedo.jpg')),
      loadTex(url('/terrain/normal.png')),
      loadTex(url('/terrain/mask.png')),
      loadImage(url('/terrain/height.png'), manager),
    ])

    const maxAniso = this.exp.renderer.capabilities.getMaxAnisotropy()
    albedo.colorSpace = THREE.SRGBColorSpace
    albedo.anisotropy = maxAniso
    // flipY:true flips the maps north<->south so that, viewed from the south
    // (camera azim 0), the island reads north-up AND east-right (no mirroring).
    for (const t of [albedo, normal, mask]) {
      t.flipY = true
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
    }

    // The encoded height's R channel ~= 8-bit normalised elevation; sampling
    // it with linear filtering gives smooth mountains (no carry artifacts and
    // no nearest-filter needling).
    const heightTex = new THREE.Texture(heightImg)
    heightTex.flipY = true
    heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter
    heightTex.generateMipmaps = false
    heightTex.needsUpdate = true

    // CPU copy of the heightmap for surface queries
    const cv = document.createElement('canvas')
    cv.width = heightImg.width
    cv.height = heightImg.height
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(heightImg, 0, 0)
    this._hpx = ctx.getImageData(0, 0, cv.width, cv.height)

    // geometry
    const width = CFG.terrainWidth
    const depth = width / this.aspect
    this.width = width
    this.depth = depth
    const segX = 380
    const segZ = Math.round(segX / this.aspect)
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ)
    geo.rotateX(-Math.PI / 2)

    const mat = new THREE.MeshStandardMaterial({
      map: albedo,
      normalMap: normal,
      normalScale: new THREE.Vector2(1.15, 1.15),
      alphaMap: mask,
      alphaTest: 0.5,
      roughness: 0.95,
      metalness: 0.0,
    })

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.heightMap = { value: heightTex }
      shader.uniforms.heightScale = { value: CFG.heightScale }
      shader.vertexShader =
        'uniform sampler2D heightMap;\nuniform float heightScale;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         float hnorm = texture2D(heightMap, uv).r;
         transformed += objectNormal * (hnorm * heightScale);`
      )
      this._shader = shader
    }

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.exp.scene.add(this.mesh)
  }

  // u,v in [0,1] (image space: u→east, v→south). Returns elevation in world units.
  sampleNorm(u, v) {
    const img = this._hpx
    const x = Math.max(0, Math.min(img.width - 1, Math.round(u * (img.width - 1))))
    const y = Math.max(0, Math.min(img.height - 1, Math.round(v * (img.height - 1))))
    const i = (y * img.width + x) * 4
    return img.data[i] / 255 // R channel ~= normalised elevation
  }

  getHeightAt(u, v) {
    return this.sampleNorm(u, v) * CFG.heightScale
  }

  // Map terrain UV to a world position on the surface.
  // With flipY:true on the maps, image row v (north→south) lands at
  // z = (v - 0.5) * depth, so north ends up at -Z.
  uvToWorld(u, v, lift = 0) {
    const x = (u - 0.5) * this.width
    const z = (v - 0.5) * this.depth
    return new THREE.Vector3(x, this.getHeightAt(u, v) + lift, z)
  }
}
