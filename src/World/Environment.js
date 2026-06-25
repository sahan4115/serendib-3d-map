import * as THREE from 'three'

/*
 * Sky gradient + sun + atmospheric fog. A timeOfDay in [0,1] (0 = golden
 * morning, 0.5 = bright noon, 1 = dusk) drives a palette lerp so the
 * day/night toggle can relight the whole island.
 */
const PALETTES = {
  day: {
    skyTop: '#2e6f8e',
    skyBot: '#bfe0e0',
    sun: '#fff3da',
    sunInt: 2.6,
    hemiSky: '#cfe8ee',
    hemiGround: '#3a4a30',
    hemiInt: 0.9,
    fog: '#cfe3e1',
    sunElev: 0.9,
    sunAzim: 1.1,
  },
  dusk: {
    skyTop: '#1a3550',
    skyBot: '#e8a76a',
    sun: '#ffb778',
    sunInt: 2.3,
    hemiSky: '#caa5b0',
    hemiGround: '#2a2c26',
    hemiInt: 0.6,
    fog: '#caa896',
    sunElev: 0.18,
    sunAzim: 2.2,
  },
}

const c = (hex) => new THREE.Color(hex)

export class Environment {
  constructor(exp) {
    this.exp = exp
    const scene = exp.scene

    // fog
    scene.fog = new THREE.Fog('#cfe3e1', 140, 540)

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: c(PALETTES.day.skyTop) },
        bottom: { value: c(PALETTES.day.skyBot) },
        offset: { value: 20 },
        exponent: { value: 0.8 },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 bottom; uniform float offset; uniform float exponent;
        varying vec3 vP;
        void main(){
          float h = normalize(vP + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottom, top, t), 1.0);
        }`,
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat)
    scene.add(this.sky)

    // lights
    this.sun = new THREE.DirectionalLight(c(PALETTES.day.sun), PALETTES.day.sunInt)
    scene.add(this.sun)
    this.sun.target.position.set(0, 0, 0)
    scene.add(this.sun.target)

    this.hemi = new THREE.HemisphereLight(
      c(PALETTES.day.hemiSky),
      c(PALETTES.day.hemiGround),
      PALETTES.day.hemiInt
    )
    scene.add(this.hemi)

    this.amb = new THREE.AmbientLight('#ffffff', 0.18)
    scene.add(this.amb)

    this.setTimeOfDay(0)
  }

  // t: 0 day -> 1 dusk
  setTimeOfDay(t) {
    this._t = t
    const a = PALETTES.day
    const b = PALETTES.dusk
    const lerp = (k) => c(a[k]).lerp(c(b[k]), t)
    const num = (k) => a[k] + (b[k] - a[k]) * t

    this.skyMat.uniforms.top.value.copy(lerp('skyTop'))
    this.skyMat.uniforms.bottom.value.copy(lerp('skyBot'))
    this.sun.color.copy(lerp('sun'))
    this.sun.intensity = num('sunInt')
    this.hemi.color.copy(lerp('hemiSky'))
    this.hemi.groundColor.copy(lerp('hemiGround'))
    this.hemi.intensity = num('hemiInt')
    this.exp.scene.fog.color.copy(lerp('fog'))

    const elev = num('sunElev')
    const azim = num('sunAzim')
    const r = 300
    this.sun.position.set(
      Math.cos(azim) * Math.cos(elev) * r,
      Math.sin(elev) * r,
      Math.sin(azim) * Math.cos(elev) * r
    )
    if (this.exp.ocean) this.exp.ocean.setSun(this.sun.position, this.sun.color)
  }

  get sunDir() {
    return this.sun.position.clone().normalize()
  }
}
