# Legacy-paritet

Kilde: `../Smudge_animator` @ commit `81cf506` ("Fix Blob mode after the frame-based
timeline change").

**Ingenting i det gamle repoet er endret.** Alt er kopiert, portet og verifisert
med tester som sammenligner gammel og ny implementasjon.

---

## Status per fil

### Orbit (`public/orbit/`) — portet

| Legacy-fil | Ny plassering | Status | Test |
|---|---|---|---|
| `animation.js` | `src/engine/animation/keyframes.ts` | ✅ portet | `tests/parity/keyframes.parity.test.ts` |
| `image-effects.js` | `src/render/raster/effects.ts` | ✅ portet | `tests/parity/effects.parity.test.ts` |
| `gradient.js` | `src/engine/color/gradient.ts` | ✅ portet | `tests/parity/gradient.parity.test.ts` |
| `motion-graphics.js` | `src/render/raster/motionGraphics.ts` | ✅ portet | `tests/parity/gradient.parity.test.ts` |
| `compositor.js` (raster) | `src/render/raster/raster.ts` | ✅ portet | ⬜ mangler maskinell test (krever canvas) |
| `surface.js` | — | ⬜ fase 7 | — |
| `obj-import.js` | — | ⬜ fase 7 | — |
| `text-mesh.js` | — | ⬜ fase 7 | — |
| `group-shader.js` | — | ⬜ fase 7 | — |
| `history.js` | — | ⬜ fase 7 (undo/redo) | — |
| `video-export.js` | `src/export/encodeFrames.ts` | ✅ portet | ✅ verifisert i nettleser |
| `sketch.js` (1110 l) | `src/nodes/…` + `src/render/…` | 🟡 delvis | se under |

### Nye, smudge-uavhengige deler

| Del | Plassering | Status |
|---|---|---|
| Gruppe-noder (subgrafer) | `engine/graph.ts` + `engine/evaluator.ts` | ✅ ferdig |
| Parameter-koblinger | `engine/evaluator.ts` + `state/useGraphStore.ts` | ✅ ferdig |
| Loop-generator | `nodes/source/loopSource.ts` | ✅ ferdig (løkkesikkerhetstester) |
| 3D-verdidom | `render/three/*` + `nodes/source/mesh3D.ts` | ✅ ferdig |
| Memoisering / ytelse | `engine/evaluator.ts` | ✅ ferdig |

### Smudge (`src/`) — ikke portet ennå

| Legacy-fil | Status | Plan |
|---|---|---|
| `src/utils/frameExport.js` | ✅ portet til `src/export/encodeFrames.ts` | — |
| `src/utils/wave.js` (LFO) | ✅ portet til `src/engine/animation/lfo.ts` | endret: syklus per *loop*, ikke per sekund |
| `src/utils/clock.js` | ✅ erstattet av `ctx.frame` / `ctx.phase` | ingen global klokke lenger |
| `src/vendor/mediabunny.js` | ✅ kopiert uendret til `src/export/vendor/` | MPL-2.0, beholdes med header |
| `src/scene/BlendStage.jsx` | ✅ portet til `src/nodes/composite/blend.ts` | — |
| `src/scene/Stage.jsx` | 🟡 delvis | blir `ui/Viewport.tsx` + `render/RenderServices.ts` |
| `src/scene/BlobView.jsx` | ⬜ fase 7 | `source.blob3D` |
| `src/shaders/fragment.glsl.js` | ⬜ neste runde | `modifier.smudgeMaterial` → én node per look |
| `src/shaders/vertex.glsl.js` | ⬜ fase 7 | samme |
| `src/shaders/blob.glsl.js` | ⬜ fase 7 | `source.blob3D` |
| `src/shaders/noise.glsl.js` | ⬜ fase 7 | deles som GLSL-chunks |
| `src/trail/trailTexture.js` | ⬜ fase 7 | blir `modifier.trail` med stamp-liste |
| `src/utils/sampleTexture.js` | ⬜ fase 7 | `render/raster/sampleTexture.ts` |
| `src/store/useStore.js` | ✅ splittet | params → node-skjema; anim → `tracks`/`lfo`; render → `graph.settings` |
| `src/components/Timeline.jsx` | ✅ splittet | `ui/panels/Timeline.tsx` |

---

## Hvordan paritetstestene virker

Legacy-filene er **IIFE/CJS** og kan ikke importeres som ESM. Derfor lastes de
i en isolert `vm`-kontekst av `tests/parity/loadLegacy.ts`:

```ts
const legacy = loadLegacy<{ blur: Function }>('orbit/image-effects.js')
expect(Array.from(blur(data, w, h, 3))).toEqual(Array.from(legacy.blur(data, w, h, 3)))
```

Testene sammenligner **bit-identiske** resultater for:

- keyframe-interpolasjon (lineær, hold, hex-farger, diskrete typer)
- pikseloperasjoner (warp, blur, pixelate, coverage, variation)
- gradient (stops, color, blend, paint)
- generativ grafikk (alle fem mønstre, tre faser)

### En feil funnet av paritetstestene

`motion-graphics.js` sin `stripes`-gren **erstatter** `x`/`y`, mens de andre
grenene **legger til** på basen. Min første port brukte `+=` for alle → alle
stripes var 105 px forskjøvet. Paritetstestene fanget det umiddelbart.

---

## `src/legacy/` — midlertidig

Kopiene ligger i `src/legacy/` og:

- inngår **ikke** i TypeScript-kompileringen (`allowJs: false`)
- importeres **ikke** av appen
- brukes **kun** av paritetstestene

De slettes når fase 7 er ferdig. Da kan `tests/parity/` flyttes til en
`legacy-parity`-mappe, eller fjernes helt.

---

## Lisens

- MediaBunny 1.61.3 — MPL-2.0. Kopiert uendret, med original header.
  Kilde: https://github.com/Vanilagy/mediabunny/tree/v1.61.3
- All annen kode stammer fra `../Smudge_animator` (ditt eget repo).
