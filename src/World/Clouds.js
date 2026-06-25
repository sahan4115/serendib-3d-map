import * as THREE from 'three'
import gsap from 'gsap'
import { CFG } from '../config.js'

/*
 * Drifting cloud layer above the island for a realistic aerial feel from the
 * top view. Domain-warped fbm gives soft, wispy, streaky clouds (not opaque
 * blobs); density drives both alpha and a subtle sunlit/grey shading. Cover is
 * high over the intro and eases to a scattered amount on the map.
 */
export class Clouds {
  constructor(exp) {
    this.exp = exp
    const w = exp.terrain.width * 2.7
    const d = exp.terrain.depth * 2.0

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        time: { value: 0 },
        uCover: { value: 0.62 },
        tint: { value: new THREE.Color('#ffffff') },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv; uniform float time, uCover; uniform vec3 tint;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
          return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
        }
        float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*noise(p); p=p*2.02+vec2(1.7,9.2); a*=0.5; } return v; }
        void main(){
          vec2 uv = vUv;
          vec2 wind = vec2(1.0, 0.45);
          vec2 p = uv * vec2(3.2, 4.6);
          float t = time * 0.02;
          float warp = fbm(p*0.6 + wind*t*1.6);          // domain warp -> billows
          float n = fbm(p + wind*t + warp*0.8);
          float dens = smoothstep(0.38, 0.66, n);         // cloud masses with clear gaps
          dens = pow(dens, 0.8);                           // fuller bodies, wispy edges
          float edge = smoothstep(0.52, 0.1, distance(uv, vec2(0.5))); // fade layer rectangle
          float a = dens * edge * uCover;
          float shade = smoothstep(0.36, 0.8, n);
          vec3 col = mix(vec3(0.80,0.83,0.88), vec3(1.0,0.99,0.97), shade) * tint; // grey veil -> sunlit white
          gl_FragColor = vec4(col, a);
        }`,
    })

    const geo = new THREE.PlaneGeometry(w, d, 1, 1)
    geo.rotateX(-Math.PI / 2)
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.position.y = CFG.heightScale * 1.4 + 4
    this.mesh.renderOrder = 3
    this.mesh.frustumCulled = false
    exp.scene.add(this.mesh)
  }

  setCover(v, duration = 2.4) {
    gsap.to(this.mat.uniforms.uCover, { value: v, duration, ease: 'power2.inOut' })
  }

  update(t) {
    this.mat.uniforms.time.value = t
    // pick up the sky's warmth (warmer/greyer at dusk) but stay mostly white
    this.mat.uniforms.tint.value.copy(this.exp.scene.fog.color).lerp(new THREE.Color('#ffffff'), 0.55)
  }
}
