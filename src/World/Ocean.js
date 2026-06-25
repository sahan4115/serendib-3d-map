import * as THREE from 'three'

/*
 * A big, beautiful tropical sea. Because looking straight down gives almost no
 * fresnel, the base water colour itself is a rich blue (not near-black), with a
 * turquoise shallow halo hugging the coastline, a moving sun glint and fine
 * sparkle. A large plane + distance fade to the horizon makes the ocean read as
 * surrounding the whole island out to the sky.
 */
export class Ocean {
  constructor(exp) {
    this.exp = exp
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.2) },
        sunColor: { value: new THREE.Color('#fff0d0') },
        deep: { value: new THREE.Color('#0b3a59') },
        mid: { value: new THREE.Color('#16708e') },
        shore: { value: new THREE.Color('#46bfc6') },
        sky: { value: new THREE.Color('#d6eef2') },
        horizon: { value: new THREE.Color('#cfe3e1') },
        // island half-extents (world), for the shallow halo
        islandR: { value: new THREE.Vector2(48, 72) },
        fogNear: { value: 170 },
        fogFar: { value: 720 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        precision highp float;
        uniform float time, fogNear, fogFar;
        uniform vec3 sunDir, sunColor, deep, mid, shore, sky, horizon;
        uniform vec2 islandR;
        varying vec3 vWorld;

        void main(){
          // ripple normal (two scales) for glint + sparkle
          vec2 p = vWorld.xz * 0.05;
          float t = time * 0.32;
          float hx = 1.3*cos(p.x*1.3+t)*0.5 + 0.9*cos((p.x+p.y)*0.9+t*0.7)*0.3 + 3.0*cos(p.x*3.0-t*1.6)*0.10;
          float hy = 1.7*cos(p.y*1.7-t*1.1)*0.5 + 0.9*cos((p.x+p.y)*0.9+t*0.7)*0.3 + 3.2*cos(p.y*3.2+t*1.2)*0.10;
          vec3 N = normalize(vec3(-hx*0.08, 1.0, -hy*0.08));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

          // base sea colour (rich even when viewed top-down)
          vec3 col = mix(deep, mid, smoothstep(0.0, 0.6, fres));
          col = mix(col, sky, fres * 0.28);

          // turquoise shallow halo around the coast
          float d = length(vWorld.xz / islandR);
          float shallow = smoothstep(1.85, 0.92, d);
          col = mix(col, shore, shallow * 0.6);

          // broad slow shimmer for life
          float shim = sin(vWorld.x*0.018 + time*0.15) * sin(vWorld.z*0.02 - time*0.1);
          col += shim * 0.015;

          // tight sun glint (kept small so it sparkles rather than blooms)
          vec3 R = reflect(-normalize(sunDir), N);
          float spec = pow(max(dot(R, V), 0.0), 200.0);
          col += sunColor * spec * 0.6;

          // fade to horizon haze far out
          float fogF = smoothstep(fogNear, fogFar, length(cameraPosition - vWorld));
          col = mix(col, horizon, fogF);

          gl_FragColor = vec4(col, 1.0);
        }`,
    })

    const geo = new THREE.PlaneGeometry(3200, 3200, 1, 1)
    geo.rotateX(-Math.PI / 2)
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.mesh.position.y = -0.05
    this.mesh.frustumCulled = false
    exp.scene.add(this.mesh)
  }

  setSun(pos, color) {
    this.mat.uniforms.sunDir.value.copy(pos).normalize()
    this.mat.uniforms.sunColor.value.copy(color)
  }

  update(t) {
    this.mat.uniforms.time.value = t
    if (this.exp.scene.fog) this.mat.uniforms.horizon.value.copy(this.exp.scene.fog.color)
  }
}
