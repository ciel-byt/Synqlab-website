/**
 * ArchScene3D — a full WebGL rendering of SynqLab's discovery cycle as an
 * orbitable, drug-discovery-inspired 3D environment.
 *
 *  - Stages are glowing spheres ("compounds") arranged in a ring.
 *  - Connections are translucent tubes carrying flowing particles ("leads /
 *    candidates trafficking between stages").
 *  - A subtle hex-style ring beneath the scene hints at a screening plate.
 *
 * Light / white theme: the canvas sits on a soft gradient so stages read as
 * bright, high-contrast orbs against an airy backdrop.
 */

import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Html, Float } from '@react-three/drei'
import * as THREE from 'three'

export type SceneStageId = 'generate' | 'evaluate' | 'simulate' | 'label' | 'update'

export type SceneStage = {
  id: SceneStageId
  num: string
  title: string
  subtitle: string
}

// Muted, teal-anchored categorical palette — mirrors STAGE_HEX in
// LandingPage.tsx so the 3D scene and 2D diagram read as one system.
const STAGE_COLORS: Record<SceneStageId, string> = {
  generate: '#207976',
  evaluate: '#3e6798',
  simulate: '#a57327',
  label:    '#863c48',
  update:   '#644d89',
}

// Drug-discovery vocabulary shown on each orb — maps a scientific stage to
// what a medicinal chemist would recognize.
const STAGE_TAG: Record<SceneStageId, string> = {
  generate: 'library',
  evaluate: 'virtual screen',
  simulate: 'dynamics',
  label:    'assay readout',
  update:   'model refit',
}

function stagePositions(count: number, radius = 4.2, yAmp = 0.45): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2
    const x = Math.cos(t) * radius
    const z = Math.sin(t) * radius
    const y = Math.sin(t * 2) * yAmp
    out.push(new THREE.Vector3(x, y, z))
  }
  return out
}

function buildConnectionCurve(a: THREE.Vector3, b: THREE.Vector3): THREE.CatmullRomCurve3 {
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
  const outward = mid.clone().normalize().multiplyScalar(0.8)
  mid.add(outward)
  mid.y += 0.9
  return new THREE.CatmullRomCurve3([a.clone(), mid, b.clone()])
}

// ── Stage orb ────────────────────────────────────────────────────────────────
function StageOrb({
  stage,
  position,
  color,
  active,
  onSelect,
}: {
  stage: SceneStage
  position: THREE.Vector3
  color: string
  active: boolean
  onSelect: (id: SceneStageId) => void
}) {
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const satellitesRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.5 + position.x) * 0.04
      const target = active ? 1.25 : hovered ? 1.12 : 1
      coreRef.current.scale.setScalar(target * pulse)
    }
    if (haloRef.current) {
      haloRef.current.rotation.y = t * 0.3
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (active ? 0.28 : hovered ? 0.20 : 0.12) + Math.sin(t * 2 + position.z) * 0.03
    }
    if (satellitesRef.current) {
      satellitesRef.current.rotation.y = t * 0.8
      satellitesRef.current.rotation.x = Math.sin(t * 0.6) * 0.3
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={coreRef}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(stage.id) }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
      >
        <sphereGeometry args={[0.55, 48, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.1 : 0.55}
          roughness={0.35}
          metalness={0.25}
        />
      </mesh>

      <mesh ref={haloRef}>
        <sphereGeometry args={[0.82, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>

      <pointLight color={color} intensity={active ? 1.8 : 1.0} distance={4.5} decay={2} />

      {/* Atomic satellites — molecule-like detail around each compound orb */}
      <group ref={satellitesRef}>
        {[0, 1, 2, 3].map(i => {
          const angle = (i / 4) * Math.PI * 2
          const r = 1.05
          return (
            <group key={i}>
              <mesh position={[Math.cos(angle) * r, Math.sin(angle * 1.3) * 0.3, Math.sin(angle) * r]}>
                <sphereGeometry args={[0.058, 12, 12]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.9}
                  roughness={0.4}
                />
              </mesh>
            </group>
          )
        })}
      </group>

      <Html
        center
        distanceFactor={10}
        position={[0, 1.2, 0]}
        zIndexRange={[0, 0]}
        occlude={false}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="whitespace-nowrap rounded-full border bg-card px-2 py-0.5 font-mono text-[10px] tracking-wide shadow-sm"
          style={{
            borderColor: active ? color : 'rgba(226,232,240,0.95)',
            color: active ? color : '#334155',
            transform: `scale(${active ? 1.12 : 1})`,
            transition: 'transform 220ms ease-out, color 220ms, border-color 220ms',
          }}
        >
          <span className="opacity-60 mr-1">{stage.num}</span>
          <span className="font-semibold">{stage.title}</span>
          <span className="opacity-40 ml-1.5">· {STAGE_TAG[stage.id]}</span>
        </div>
      </Html>
    </group>
  )
}

// ── Connection tube with flowing candidate vesicles ──────────────────────────
function Connection({ curve, color }: { curve: THREE.CatmullRomCurve3; color: string }) {
  const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, 80, 0.028, 10, false), [curve])
  const particles = useMemo(() => Array.from({ length: 4 }, (_, i) => ({ offset: i / 4 })), [])
  const meshes = useRef<THREE.Mesh[]>([])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    particles.forEach((p, i) => {
      const u = (t * 0.18 + p.offset) % 1
      const pos = curve.getPointAt(u)
      const m = meshes.current[i]
      if (m) {
        m.position.copy(pos)
        const mat = m.material as THREE.MeshStandardMaterial
        const phase = Math.sin(u * Math.PI)
        mat.emissiveIntensity = 1.1 + phase * 1.2
        m.scale.setScalar(0.7 + phase * 0.6)
      }
    })
  })

  return (
    <group>
      <mesh geometry={tubeGeom}>
        <meshBasicMaterial color={color} transparent opacity={0.26} />
      </mesh>
      {particles.map((_, i) => (
        <mesh key={i} ref={(el) => { if (el) meshes.current[i] = el }}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Ambient dust particles drifting around the scene ─────────────────────────
function FloatingDust({ count = 60 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 4.5 + Math.random() * 4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.45
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geom
  }, [count])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.03
  })

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color="#64748b" size={0.06} transparent opacity={0.45} sizeAttenuation />
    </points>
  )
}

// ── A faint 96-well "screening plate" below the ring ────────────────────────
function ScreeningPlate() {
  // Lightly-dotted ring that reads as the assay plate beneath the pipeline.
  const dots = useMemo(() => {
    const positions: THREE.Vector3[] = []
    const rings = [3.1, 3.55, 4.0, 4.45, 4.9]
    rings.forEach((r, rIdx) => {
      const n = 18 + rIdx * 4
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rIdx * 0.12
        positions.push(new THREE.Vector3(Math.cos(a) * r, -1.35, Math.sin(a) * r))
      }
    })
    return positions
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.34, 0]}>
        <ringGeometry args={[2.9, 5.05, 96]} />
        <meshBasicMaterial color="#1ba7a7" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
      {dots.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#94a3b8" transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  )
}

// ── Camera controller — smoothly tracks the selected stage ───────────────────
function CameraFocus({ target }: { target: THREE.Vector3 }) {
  const focus = useRef(new THREE.Vector3(0, 0, 0))
  useFrame((state) => {
    focus.current.lerp(target, 0.04)
    state.camera.lookAt(focus.current)
  })
  return null
}

// ── The full scene ───────────────────────────────────────────────────────────
export function ArchScene3D({
  stages,
  active,
  onSelect,
  autoOrbit = true,
}: {
  stages: SceneStage[]
  active: SceneStageId
  onSelect: (id: SceneStageId) => void
  autoOrbit?: boolean
}) {
  const positions = useMemo(() => stagePositions(stages.length), [stages.length])
  const curves = useMemo(() => {
    return stages.map((_, i) => {
      const a = positions[i]
      const b = positions[(i + 1) % positions.length]
      return buildConnectionCurve(a, b)
    })
  }, [positions, stages])

  const activeIndex = stages.findIndex(s => s.id === active)
  const focusTarget = activeIndex >= 0 ? positions[activeIndex] : new THREE.Vector3(0, 0, 0)

  return (
    <Canvas
      camera={{ position: [6, 4, 8], fov: 55 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{
        background:
          'radial-gradient(80% 60% at 50% 40%, #ffffff 0%, #f8fafc 55%, #eef2f7 100%)',
      }}
    >
      <fog attach="fog" args={['#eef2f7', 12, 26]} />

      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 8, 4]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-6, 4, -2]} intensity={0.35} color="#e2e8f0" />
      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.6]} />

      <FloatingDust count={70} />
      <ScreeningPlate />

      <Float speed={0.6} rotationIntensity={0.15} floatIntensity={0.5}>
        {curves.map((curve, i) => (
          <Connection key={i} curve={curve} color={STAGE_COLORS[stages[(i + 1) % stages.length].id]} />
        ))}

        {stages.map((s, i) => (
          <StageOrb
            key={s.id}
            stage={s}
            position={positions[i]}
            color={STAGE_COLORS[s.id]}
            active={active === s.id}
            onSelect={onSelect}
          />
        ))}
      </Float>

      <CameraFocus target={focusTarget} />

      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={6}
        maxDistance={16}
        minPolarAngle={Math.PI * 0.15}
        maxPolarAngle={Math.PI * 0.75}
        autoRotate={autoOrbit}
        autoRotateSpeed={0.6}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  )
}
