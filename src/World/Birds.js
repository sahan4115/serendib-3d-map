import * as THREE from 'three'

/*
 * A small flock of birds drifting slowly over the island on gentle looping
 * paths, with softly flapping wings. Deliberately tiny so they read as distant
 * silhouettes — a little life in the scene rather than a focal point.
 */
function wingGeo(dir) {
  // a shallow swept triangle: near-front, near-back, swept tip
  const span = 1.0
  const g = new THREE.BufferGeometry()
  g.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        0, 0, 0.34, // front, by the body
        0, 0, -0.3, // back, by the body
        dir * span, 0, -0.12, // wing tip (slightly swept back)
      ]),
      3
    )
  )
  g.setIndex([0, 1, 2])
  g.computeVertexNormals()
  return g
}

export class Birds {
  constructor(exp, count = 10) {
    this.exp = exp
    this.group = new THREE.Group()
    exp.scene.add(this.group)
    this.birds = []

    const mat = new THREE.MeshStandardMaterial({
      color: 0x24272d,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    })
    const bodyGeo = new THREE.CapsuleGeometry(0.05, 0.42, 3, 6)
    bodyGeo.rotateX(Math.PI / 2) // lie along Z (flight direction)
    const lwGeo = wingGeo(-1)
    const rwGeo = wingGeo(1)

    const W = exp.terrain.width
    const D = exp.terrain.depth
    const rnd = (a, b) => a + Math.random() * (b - a)

    for (let i = 0; i < count; i++) {
      const bird = new THREE.Group()
      const lw = new THREE.Mesh(lwGeo, mat)
      const rw = new THREE.Mesh(rwGeo, mat)
      bird.add(new THREE.Mesh(bodyGeo, mat), lw, rw)
      bird.scale.setScalar(rnd(0.85, 1.5)) // small
      this.group.add(bird)

      this.birds.push({
        bird,
        lw,
        rw,
        cx: rnd(-0.32, 0.32) * W,
        cz: rnd(-0.32, 0.32) * D,
        rx: rnd(20, 46),
        rz: rnd(16, 40),
        cy: rnd(9, 16), // above the land, below/among the clouds
        speed: rnd(0.035, 0.075) * (Math.random() < 0.5 ? 1 : -1), // slow drift
        phase: rnd(0, Math.PI * 2),
        bob: rnd(0.35, 0.7),
        bobAmp: rnd(0.4, 0.9),
        flapSpeed: rnd(3, 5),
        flapPhase: rnd(0, Math.PI * 2),
      })
    }
  }

  update(t) {
    for (const b of this.birds) {
      const a = b.phase + t * b.speed
      b.bird.position.set(
        b.cx + Math.cos(a) * b.rx,
        b.cy + Math.sin(t * b.bob + b.phase) * b.bobAmp,
        b.cz + Math.sin(a) * b.rz
      )
      // face along the path tangent
      const tx = -Math.sin(a) * b.rx * b.speed
      const tz = Math.cos(a) * b.rz * b.speed
      b.bird.rotation.y = Math.atan2(tx, tz)
      // gentle symmetric wing flap
      const flap = Math.sin(t * b.flapSpeed + b.flapPhase) * 0.7
      b.lw.rotation.z = flap
      b.rw.rotation.z = -flap
    }
  }
}
