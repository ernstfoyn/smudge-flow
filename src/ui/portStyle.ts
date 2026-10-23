import type { ValueType } from '../engine/types'
import { canConnectTypes } from '../engine/graph'

/**
 * Fargekoder for porter.
 *
 * Regelen er enkel og skal være 100 % intuitiv: to porter kan kobles sammen
 * hvis de har samme farge. Derfor deler `canvas` og `drawable` farge — de er
 * de eneste verditypene som er krysskompatible i motoren.
 *
 * Parameterinnganger er også tall (blå), men tegnes som en diamant og får
 * stiplede kanter. Da skiller vi «automatisering» fra vanlig dataflyt uten å
 * bryte fargeregelen.
 */
export interface PortMeta {
  /** Kort navn, brukt i type-chip, tooltip og legende. */
  label: string
  /** Hex-farge på håndtak, kant og chip. */
  color: string
  /** Kort forklaring til tooltip. */
  hint: string
}

const IMAGE = '#a3e635'

export const PORT_META: Record<ValueType, PortMeta> = {
  canvas: { label: 'Bilde', color: IMAGE, hint: '2D-lerret og raster' },
  drawable: { label: 'Bilde', color: IMAGE, hint: 'Tegnbar flate: bilde, video eller lerret' },
  frame: { label: 'Ramme', color: '#2dd4bf', hint: 'En ferdig tegnet ramme' },
  object3d: { label: '3D', color: '#fb923c', hint: '3D-objekt i scenen' },
  geometry: { label: 'Geometri', color: '#22d3ee', hint: 'Rå geometri' },
  material: { label: 'Materiale', color: '#f472b6', hint: 'Materiale til en 3D-mesh' },
  scene: { label: 'Scene', color: '#8b5cf6', hint: 'Ferdig 3D-scene' },
  camera: { label: 'Kamera', color: '#c084fc', hint: 'Kamerainnstillinger' },
  lights: { label: 'Lys', color: '#facc15', hint: 'Lyssetting' },
  number: { label: 'Tall', color: '#60a5fa', hint: 'Tallverdi — kan også styre parametere' },
  string: { label: 'Tekst', color: '#a1a1aa', hint: 'Tekstverdi' },
  boolean: { label: 'Boolsk', color: '#f87171', hint: 'Av/på-verdi' },
  color: { label: 'Farge', color: '#fb7185', hint: 'Fargeverdi' },
}

/** Parameterinnganger er tall, men vises som en diamant. */
export const PARAM_META: PortMeta = {
  label: 'Parameter',
  color: PORT_META.number.color,
  hint: 'Parameterinngang — styres av en tallutgang',
}

/** Porttypene som faktisk brukes i biblioteket, i den rekkefølgen de vises. */
export const PORT_LEGEND: Array<{ type: ValueType; label: string; color: string }> = [
  { type: 'canvas', label: 'Bilde', color: PORT_META.canvas.color },
  { type: 'object3d', label: '3D-objekt', color: PORT_META.object3d.color },
  { type: 'number', label: 'Tall', color: PORT_META.number.color },
  { type: 'camera', label: 'Kamera', color: PORT_META.camera.color },
  { type: 'lights', label: 'Lys', color: PORT_META.lights.color },
]

export function portMeta(type: ValueType): PortMeta {
  return PORT_META[type]
}

/** Kan en verdiutgang av `source` kobles til en verdiinngang av `target`? */
export function valuePortsCompatible(source: ValueType, target: ValueType): boolean {
  return canConnectTypes(source, target)
}

/** Parameterinnganger tar bare imot tall. */
export function paramPortCompatible(source: ValueType): boolean {
  return source === 'number'
}
