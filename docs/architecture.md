# Arkitektur

## 1. Dataflytmodellen

Grafen er en **DAG**. Noder har porter inn og ut, og verdier flyter langs kantene.
Ingen node vet hva som er "øverst i treet" — det er bare en graf.

```
┌──────────────────────────────────────────────────────────────┐
│ UI (React Flow + paneler)                                   │
│   redigerer graf, params, tracks, LFO, spiller av / scruber │
└───────────────┬──────────────────────────────────────────────┘
                │ graph + frame
┌───────────────▼──────────────────────────────────────────────┐
│ Evaluator                                                   │
│   1. topoSort(graph, targets)  → deterministisk rekkefølge  │
│   2. resolveParamsAt(node, frame) = params → keys → LFO     │
│   3. def.evaluate(ctx, inputs, params) → outputs            │
│   4. cache: 'frame' | 'static'                              │
└───────────────┬──────────────────────────────────────────────┘
                │ verdier (drawable / canvas / frame)
┌───────────────▼──────────────────────────────────────────────┐
│ NodeDefinitions (rene kontrakter)                          │
│   source.* → modifier.* → composite.* → output.*            │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ RenderServices (eneste eier av DOM/GPU)                     │
│   canvas-basseng · asset-cache · 2D-raster · MediaBunny     │
└──────────────────────────────────────────────────────────────┘
```

### Topologisk sortering

`src/engine/topoSort.ts` er Kahn-algoritmen over **delgrafen som mater målene**,
ikke over hele grafen. Det betyr at en graf med 50 noder, men bare 3 noder
foran viewporten, bare evaluerer de 3 (pluss kildene deres).

Tre egenskaper er viktige:

- **Determinisme.** Noder med lik inndegsgrad sorteres etter rekkefølgen i
  `graph.nodes`. Samme graf gir alltid samme evalueringsrekkefølge.
- **Syklusdeteksjon.** En syklus gir en lesbar feil, ikke en evig løkke.
  `wouldCreateCycle()` hindrer at en ulovlig kant i det hele tatt lages.
- **Deaktiverte noder** bryter kjeden. Verdien faller tilbake til standard i
  stedet for å henge.

### To verdidomener + eksplisitte broer

Dette er den viktigste designbeslutningen.

| Domene | Verdityper | Noder |
|---|---|---|
| **Raster** | `drawable`, `canvas`, `frame` | gradient, motionGraphics, image, transform2D, raster, blur, pixelate, warp, blend |
| **Scene** | `geometry`, `material`, `scene` | (fase 7) |
| **Bro** | `scene` → `canvas` | `composite.sceneRender` (fase 7) |

Uten bro-noder må hver node eie en WebGL-kontekst — det er nettopp problemet
med `Stage.jsx` i den gamle kodebasen. Med broer kan hele DAG-en evalueres på
CPU, og 3D blir bare én renderer-plugin.

### Tidskontrakt

All tid kommer fra konteksten:

| Felt | Betydning |
|---|---|
| `ctx.frame` | Heltall 0..totalFrames-1 |
| `ctx.time` | `frame / fps` — sekunder inn i loopen |
| `ctx.phase` | `frame / totalFrames` — 0..1, lukker seg eksakt |

**Forbudt** inne i `evaluate()`: `Date.now()`, `performance.now()`,
`Math.random()`, `requestAnimationFrame`. Tilfeldighet går via seedet hash
(samme teknikk som `smoothNoise` i den gamle `wave.js`).

Loop-fasen er bevisst *ikke* sekunder. En LFO med `cycles: 1` er da eksakt én
syklus per loop, uansett fps — så loopen lukker seg bit-identisk, og eksporten
kan ikke få en hopp.

### Caching

- `cache: 'frame'` (standard) — resultatet lever bare for denne rammen.
- `cache: 'static'` — for immutable output (parset geometri, lastet bilde).
  `Evaluator.invalidate()` tømmer cachen når grafen endres.

Canvas gjenbrukes per node (`RenderServices.canvas(nodeId)`), slik at 60 fps i
1920×1080 ikke skaper GC-storm.

---

## 2. Kontrakter

### Flere lag inn i én node

En inngangsport har som standard **én** kant — en ny kobling erstatter den gamle.
Porten kan deklareres som `multiple: true`, og da får noden alle verdiene som
et **array i kantrekkefølge**:

```ts
inputs: [{ id: 'in', label: 'Lag', type: 'canvas', multiple: true }]
```

```ts
const list = (Array.isArray(layers) ? layers : [layers]) as CanvasImageSource[]
```

`composite.stack` bruker dette for å kombinere et ubegrenset antall lag i én
node. Rekkefølgen bestemmer hva som ligger øverst, og kan endres i inspectoren
(`reorderInput`).

Erstatningen av en kant på en enkel port skjer ikke i det stille lenger: UI-en
viser en melding som forklarer hva som skjedde og peker på lagstabelen.

### NodeDefinition

```ts
interface NodeDefinition<P> {
  type: string
  label: string
  category: 'source' | 'modifier' | 'composite' | 'output'
  inputs: readonly PortDef[]
  outputs: readonly PortDef[]
  params: readonly ParamDef[]
  evaluate(ctx: EvalContext, inputs: InputValues, params: P): Outputs | Promise<Outputs>
  cache?: 'frame' | 'static'
}
```

`ParamDef.key` kan være en **punktsti** (`"transform.position.x"`), fordi
keyframes skal kunne adressere hvilken som helst egenskap. `NodeDefinition`
er den eneste kilden til sann for nodekort, inspector, timeline-spor og
eksport.

### RenderServices

Motoren kjenner ikke DOM. Den får en `RenderServices` (kontrakten i
`src/engine/types.ts`, implementasjonen i `src/render/RenderServices.ts`) som
tilbyr:

- `canvas(key)` — gjenbrukt lerret per node
- `assets.image(src)` — cachet bilde
- `assets.videoFrame(src, time)` — **deterministisk**: seeker og venter på
  `seeked` per frame (ellerses får hver frame et tilfeldig bilde)

### Graph

```ts
interface Graph {
  version: 1
  nodes: GraphNode[]
  edges: GraphEdge[]
  settings: { width, height, fps, frames, loop, background }
}

interface GraphNode {
  id, type, title
  params: Record<string, unknown>
  tracks?: Record<string, Keyframe[]>   // sti → keyframes
  lfo?: Record<string, LfoConfig>      // sti → LFO
  position, enabled
}
```

`tracks` og `lfo` er **nivå-agnostiske**: de henger på noden, ikke på
parameteren. Derfor kan enhver parameter animeres uten at noden vet om det.

---

## 3. Eksport

`src/export/exportGraph.ts` kjører SAMME `evaluator.evaluateFrame()` som
forhåndsvisningen, men itererer `frame = 0..N-1` uten rAF. Hver frame tegnes
på en eksplisitt buffer og sendes til MediaBunny med et eksplisitt tidsstempel
(`frame / fps`). Derfor:

- Lengden er eksakt `frames / fps` sekunder.
- Innholdet er identisk med det du så i preview.
- Avbryting er trygt (`AbortSignal` sjekkes per frame).

MediaBunny 1.61.3 (MPL-2.0) ligger i `src/export/vendor/mediabunny.js`,
kopiert uendret fra den gamle kodebasen, og lastes dynamisk slik at den ikke
øker oppstartstiden.

---

## 4. Feil håndtert

| Feil | Hvor | Melding |
|---|---|---|
| Ukjent nodetype | `registry.get()` | `Ukjent nodetype: "x".` |
| Syklus | `topoSort()` | `Grafen inneholder en syklus: a → b → a` |
| Mangler input | `evaluator` | `«Node» mangler input «Inn» — koble en kilde til porten.` |
| Ugyldig portkobling | `useGraphStore.connect()` | Koble ganske stille (returnerer `false`) |

Ugyldige koblinger avvises stille i UI-et (ingen kanter opprettes), mens
sykluser og manglende inputs gir **eksplisitte** feil i konsollen, slik at en
bruker kan fikse dem.

---

## 5. Roadmap

| Fase | Innhold | Status |
|---|---|---|
| 1 | Motor-kjerne: topoSort, evaluator, params, registry | ✅ ferdig |
| 2 | Port av ren logikk: keyframes, LFO, gradient, pikseleffekter | ✅ ferdig (+ paritetstester) |
| 3 | Legacy-noder: gradient, motionGraphics, raster, blur, pixelate, warp, blend | ✅ ferdig |
| 4 | Graf-UI: React Flow, inspector, palett, prosjekt-lagring | ✅ ferdig |
| 5 | Timeline: keyframes, LFO, scrubbing | ✅ ferdig |
| 6 | Eksport: MP4/WebM | ✅ ferdig |
| 7 | 3D: `composite.sceneRender`, `source.blob3D`, `modifier.smudgeMaterial`, trail som stamp-liste | ⬜ neste |
| 8 | Rydd: slett `src/legacy/`, flytt `src/engine` til `packages/engine` | ⬜ |

### Planlagt for fase 7

- **Smudge-shaderne** (`fragment.glsl.js`) blir først én node
  (`modifier.smudgeMaterial`) med de eksisterende uniformene, deretter én node
  per look. Rekkefølgen blir kantene i grafen, ikke en `uLookOrder`-array.
- **Trail-penselen** blir en `modifier.trail` som tar en **stamp-liste** som
  data (`Stamp[]` med UV, størrelse, rotasjon). Da blir strøkene animerbare og
  eksporterbare — i dag er de stateful og tidsavhengige, og ville gitt ulikt
  resultat per eksport.
- **3D-scenen** blir en `SceneSpec`-verdi med `composite.sceneRender` som bro
  til raster. `group-shader.js` sin matematikk portes til `engine/scene/matrix.ts`.
- **OBJ/tekst** blir `source.mesh3D` / `source.text3D` med
  `render/geometry/obj.ts` og `render/geometry/textMesh.ts`.
