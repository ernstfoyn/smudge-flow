# Smudge Flow

Nodebasert / prosedural versjon av **Smudge Animator** + **Orbit**, bygget rundt en
dataflyt-arkitektur (DAG).

Dette er et **nytt, separat repo**. Den gamle kodebasen
(`../Smudge_animator`) er urørt — ingenting er flyttet, slettet eller endret der.
Logikken er **portert** (kopiert + omskrevet) og verifisert med paritetstester
mot originalen.

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # 52 tester, inkludert paritet mot gammel kode
npm run build    # tsc --noEmit && vite build
```

---

## Hva appen gjør

Du bygger en graf av noder. Hver node har **parametere** som kan animeres med
keyframes eller LFO, og porter som verdier flyter gjennom. Motoren evaluerer
grafen topologisk for hver frame og sender resultatet til rendereren.

```
source.*  ──▶  modifier.*  ──▶  composite.*  ──▶  output.*
(gradient,     (transform,      (blend)          (viewport,
 generativ      raster, blur,                     MP4-eksport)
 grafikk,       pixelate,
 bilde)         warp)
```

**Determinisme er en del av API-et.** Alt som evalueres, er en ren funksjon av
`(inputs, params, ctx.frame, settings)`. Ingen `Date.now()`, ingen
`Math.random()`, ingen `requestAnimationFrame` inne i en node. Derfor er
forhåndsvisningen og MP4-eksporten bit-identiske, og lengden på eksporten er
eksakt `frames / fps` sekunder.

---

## Arkitektur i korthet

| Lag | Path | Ansvarl |
|---|---|---|
| Motor | `src/engine/` | Topologisk sortering, evaluering, param-løsning. Ren TypeScript, ingen React, ingen DOM. |
| Noder | `src/nodes/` | Nodetyper. Hver er en ren kontrakt: porter inn, porter ut. |
| Render | `src/render/` | Eneste sted som eier canvas/lerret. Portet fra Orbit + Smudge. |
| Eksport | `src/export/` | MediaBunny (vendored, MPL-2.0) + deterministisk frame-løkke. |
| Tilstand | `src/state/` | Zustand: graf, avspilling, motor-singletons. |
| UI | `src/ui/` | React Flow, inspector, timeline, viewport, eksportpanel. |

Detaljer: [`docs/architecture.md`](docs/architecture.md) ·
Port-status: [`docs/legacy-parity.md`](docs/legacy-parity.md)

---

## Nodetyper i dag

| Type | Kategori | Port fra |
|---|---|---|
| `source.gradient` | kilde | Orbit `gradient.js` + `makeGradient()` |
| `source.motionGraphics` | kilde | Orbit `motion-graphics.js` (prikkefelt, fliser, vifte, striper, ovaler) |
| `source.image` | kilde | Smudge `trailTexture.js` (bilde/video) |
| `source.loop` | kilde | Ny — løkkesikre verdier fra loop-algoritmer |
| `source.mesh3D` | kilde | Ny — prosedural 3D-geometri (boks/kule/torus/plan/sylinder/ikosaeder) |
| `modifier.transform2D` | modifikator | Ny, erstatter Smudges 3D-transform |
| `modifier.transform3D` | modifikator | Ny — flytter/roterer 3D-objekter |
| `modifier.raster` | modifikator | Orbit `compositor.js` (luminansraster) |
| `modifier.blur` | modifikator | Orbit `image-effects.js` |
| `modifier.pixelate` | modifikator | Orbit `image-effects.js` |
| `modifier.warp` | modifikator | Orbit `image-effects.js` |
| `composite.blend` | kompositt | Smudge `BlendStage.jsx` (8 blendemodeller) |
| `composite.stack` | kompositt | Ny — kombinerer N lag i én node |
| `composite.sceneRender` | kompositt | Ny — maler 3D ned på raster (bro mellom 2D og 3D) |
| `output.viewport` | output | Ny — merker leveransen for preview |
| `output.export` | output | Ny — merker leveransen for MP4 |

### Kombinere flere lag

`composite.blend` har to innganger: **Bunn** og **Topp**. For flere lag bruker
du **Lagstabel** (`composite.stack`): koble så mange kilder du vil inn i samme
port «Lag». Lag 1 er bunnen, resten blandes oppå med valgt modus og dekkevne.
Rekkefølgen kan endres i inspectoren (↑/↓ per lag).

> Merk: en inngangsport på en vanlig node holder **én** kobling. Koble du en
> tredje kilde inn i «Bunn», erstattes den gamle forbindelsen — appen varsler
> om dette og peker på lagstabelen.

---

## Gjenbrukbare workflows: gruppe-noder

En gruppe-node er en graf inni grafen. Den lar deg bygge behandlingskjeden
én gang og bruke den på nytt innhold.

**Så gjør du det:**

1. **Merk** nodene i behandlingen (Shift-klikk) → trykk «⬚ Lag gruppe».
2. **Eksponer** portene du vil bytte: i inspectoren under «Innhold · eksponer
   porter» kan du gjøre en intern port til en inngang eller utgang. Den blir
   et håndtak på gruppen.
3. **Koble** en ny kilde inn i inngangshåndtaket.
4. **Kopier** gruppen («⧉ Lag kopi») for å bruke samme behandling på nytt
   innhold. Kopien får egne interne noder, så den er en selvstendig instans.

Eksponerte innganger er overstyrbare: den interne kilden beholdes som
standard, men en ekstern kilde som kobles til porten vinner.

---

## Automatisert looping

`source.loop` lager verdier som er **løkkesikre** — verdien ved frame 0 er
identisk med verdien ved frame N, så loopen hopper aldri.

Koble utgangen «Verdi» til en parameter i en annen node (det lille håndtaket
ved parameteren i nodekortet), og kjeden blir automatisert:

```
source.loop ──value──▶ modifier.raster.param:cellSize
```

Algoritmer: sine, trekant, sag, firkant og løkkesikker støy. Vindu
`pingpong` eller `cosine` former kurven slik at den starter og slutter likt.

---

## Blokk-bibliotek

Fanen **Blokker** inneholder ferdige oppsett og blokkene du selv har lagret.

**Innebygde oppsett:** Generativ bakgrunn, Raster-behandling, 3D-form,
Loop-animert forvrengning, Lagstabel.

**Slik lagrer du et nodetre for gjenbruk:**

1. Marker nodene i grafen (Shift-klikk) → trykk **«⬚ Lag blokk»**.
2. Gi blokken et navn. Den legges i biblioteket med én gang.
3. **«Last inn»** setter blokken inn i grafen igjen — med egne interne noder,
   så den er en selvstendig instans.
4. Koble nytt innhold inn i inngangshåndtakene. Samme behandling, nytt innhold.

Når du lagrer en blokk, skjer to ting automatisk:

- **Innholdskildene holdes utenfor.** Hvis markeringen ikke har noen kryssende
  kant inn i seg, blir nodene uten egne innganger (gradient, bilde, 3D-form)
  holdt utenfor blokken og eksponert som inngang. Det er nettopp det som
  gjør at blokken kan brukes på nytt innhold.
- **Bladnodens utgang eksponeres.** En node som ikke fører videre, er et
  resultat.

Blokker lagres i nettleseren (localStorage) og kan eksporteres/importeres som
JSON-filer for å dele dem mellom prosjekter.

---

## 2D og 3D i samme graf

3D-noden kjøres gjennom geometri, ikke piksler:

```
source.mesh3D ──▶ modifier.transform3D ──▶ composite.sceneRender ──▶ composite.stack ──▶ output.viewport
```

`composite.sceneRender` maler 3D-objektene ned på et raster-lerret, slik at
de kan blandes med 2D-lag, rastereffekter og eksporteres som vanlig.
three.js lastes bare når 3D faktisk brukes.

---

## Slik legger du til en node

1. Skriv en `NodeDefinition` i `src/nodes/…`:

```ts
export const myNode: NodeDefinition<{ amount: number }> = {
  type: 'modifier.myNode',
  label: 'Min node',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'amount', label: 'Mengde', type: 'number', default: 1,
      min: 0, max: 10, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.nodeId)
    // ... tegn ...
    return { out: target.canvas }
  },
}
```

2. Registrer den i `src/nodes/index.ts`.

Ferdig. Nodekortet, inspectoren, keyframe-sporet og eksporten leser alle fra
samme schema — det finnes ingen separat UI-kode per node.

---

## Hva som mangler (fase 7)

3D-laget fra Smudge (three.js, `blob.glsl.js`, `vertex/fragment.glsl.js`,
trail-penselen) ligger i `src/legacy/smudge/` og er **ikke** portet ennå. Se
[`docs/legacy-parity.md`](docs/legacy-parity.md) for planen.
