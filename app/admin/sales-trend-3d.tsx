"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

import type { SalesTrendPoint } from "./sales-trends"

export type ThreeSeries = {
  key: string
  label: string
  color: string
}

type Tooltip = {
  label: string
  value: number
  x: number
  y: number
}

function canvasColor(color: string) {
  const probe = document.createElement("span")
  probe.style.color = color
  document.body.appendChild(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return new THREE.Color(value)
}

export function SalesTrend3D({
  ariaLabel,
  points,
  series,
}: {
  ariaLabel: string
  points: SalesTrendPoint[]
  series: ThreeSeries[]
}) {
  const host = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element || !points.length || !series.length) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    } catch {
      element.textContent = "Gráfico 3D no disponible en este navegador."
      element.className = "grid h-[300px] place-items-center text-sm text-muted-foreground"
      return
    }

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(10, 9, 13)
    camera.lookAt(0, 1.6, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    element.appendChild(renderer.domElement)

    const group = new THREE.Group()
    scene.add(group)
    const ambient = new THREE.HemisphereLight(0xb8d6ff, 0x111827, 2.4)
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(5, 8, 4)
    scene.add(ambient, key)

    const grid = new THREE.GridHelper(12, 12, 0x334155, 0x1f2937)
    grid.position.y = -0.02
    group.add(grid)

    const maxValue = Math.max(1, ...points.flatMap((point) => series.map((item) => Number(point[item.key] ?? 0))))
    const spacing = 8 / Math.max(points.length - 1, 1)
    const laneGap = Math.min(0.65, 3.5 / Math.max(series.length, 1))
    const meshes: THREE.Mesh[] = []
    const geometry = new THREE.BoxGeometry(Math.min(0.54, spacing * 0.6), 1, Math.max(0.22, laneGap * 0.65))

    points.forEach((point, index) => {
      series.forEach((item, lane) => {
        const value = Number(point[item.key] ?? 0)
        if (!value) return
        const height = (value / maxValue) * 4.5
        const material = new THREE.MeshStandardMaterial({
          color: canvasColor(item.color),
          emissive: canvasColor(item.color).multiplyScalar(0.12),
          metalness: 0.35,
          roughness: 0.28,
        })
        const bar = new THREE.Mesh(geometry, material)
        bar.scale.y = height
        bar.position.set(index * spacing - 4, height / 2, (lane - (series.length - 1) / 2) * laneGap)
        bar.userData = { label: `${item.label} · ${point.day.slice(8, 10)}`, value }
        group.add(bar)
        meshes.push(bar)
      })
    })

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let frame = 0
    let animation = 0

    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(meshes)[0]
      if (!hit) return setTooltip(null)
      const data = hit.object.userData as Pick<Tooltip, "label" | "value">
      setTooltip({
        label: data.label,
        value: data.value,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    const onPointerLeave = () => setTooltip(null)
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    renderer.domElement.addEventListener("pointermove", onPointerMove)
    renderer.domElement.addEventListener("pointerleave", onPointerLeave)
    resize()

    const render = () => {
      if (!reduceMotion) group.rotation.y = Math.sin(frame / 120) * 0.055
      renderer.render(scene, camera)
      frame += 1
      animation = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(animation)
      observer.disconnect()
      renderer.domElement.removeEventListener("pointermove", onPointerMove)
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave)
      geometry.dispose()
      meshes.forEach((mesh) => (mesh.material as THREE.Material).dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [points, series])

  return (
    <div className="relative h-[300px] overflow-hidden rounded-xl border border-white/8 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.16),transparent_45%)]">
      <div ref={host} aria-label={ariaLabel} className="h-full w-full" role="img" />
      {tooltip ? (
        <div
          className="pointer-events-none absolute rounded-md border bg-background/95 px-2 py-1 text-xs shadow-lg"
          style={{ left: Math.min(tooltip.x + 12, 220), top: Math.max(tooltip.y - 34, 8) }}
        >
          <div>{tooltip.label}</div>
          <strong>{tooltip.value} venta{tooltip.value === 1 ? "" : "s"}</strong>
        </div>
      ) : null}
      <p className="sr-only">{ariaLabel}</p>
    </div>
  )
}
