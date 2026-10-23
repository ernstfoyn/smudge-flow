/**
 * Verdier for kamera og lys.
 *
 * Begge er *sceneverdier*: de hører ikke til ett objekt, men til scenen
 * som helhet. Ved å gjøre dem til verdier i grafen (i stedet for skjulte
 * innstillinger) kan de animeres, kobles til og gjenbrukes som alt annet.
 */

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface CameraValue {
  position: Vec3
  /** Punktet kameraet ser mot. */
  target: Vec3
  fov: number
  near: number
  far: number
}

export interface LightValue {
  color: string
  intensity: number
  position: Vec3
}

export interface LightsValue {
  ambient: { color: string; intensity: number }
  /** Hovedlys — retningslys fra `position` mot origo. */
  key: LightValue
  /** Kantlys fra motsatt side. Valgfritt. */
  rim?: LightValue
}

export function defaultCamera(): CameraValue {
  return {
    position: { x: 0, y: 0, z: 4 },
    target: { x: 0, y: 0, z: 0 },
    fov: 45,
    near: 0.1,
    far: 100,
  }
}

export function defaultLights(): LightsValue {
  return {
    ambient: { color: '#ffffff', intensity: 1.2 },
    key: { color: '#ffffff', intensity: 2, position: { x: -2, y: 3, z: 4 } },
    rim: { color: '#88ccff', intensity: 0.6, position: { x: 3, y: -1, z: -3 } },
  }
}
