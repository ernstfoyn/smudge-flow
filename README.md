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
 generativ      raster, blur,                     videoeksport)
 grafikk,       pixelate,
 bilde)         warp)
```

**Determinisme er en del av API-et.** Alt som evalueres, er en ren funksjon av
`(inputs, params, ctx.frame, settings)`. Ingen `Date.now()`, ingen
`Math.random()`, ingen `requestAnimationFrame` inne i en node. Derfor er
forhåndsvisningen og videoeksporten bit-identiske, og lengden på eksporten er
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
| `curve.signal` | signal | Ny — en kurve (sinus, trekant, støy, tegnet …) med hastighet og fase. Kobles til «Styring» på en node |
| `source.loop` | signal (skjult) | Ny — eldre alt-i-ett loop-generator, brukt av blokkene |
| `source.mesh3D` | kilde | Ny — prosedural 3D-geometri (boks/kule/torus/plan/sylinder/ikosaeder) |
| `source.blob3D` | kilde | Smudge `blob.glsl.js` — raymarchet metaball-form |
| `source.obj` | kilde | Orbit `obj-import.js` — importerte 3D-modeller |
| `modifier.transform2D` | modifikator | Ny, erstatter Smudges 3D-transform |
| `modifier.transform3D` | modifikator | Ny — flytter/roterer 3D-objekter |
| `modifier.trail` | modifikator | Smudge `trailTexture.js` — malte stempler, lagret som data |
| `modifier.smudgeDeform` | modifikator | Smudge `vertex/fragment.glsl.js` — flytende glass, trail, glans |
| `modifier.look.*` (16 stk) | modifikator | Smudge `fragment.glsl.js` — hver effekt sin node |
| `modifier.raster` | modifikator | Orbit `compositor.js` (luminansraster) |
| `modifier.blur` | modifikator | Orbit `image-effects.js` |
| `modifier.pixelate` | modifikator | Orbit `image-effects.js` |
| `modifier.warp` | modifikator | Orbit `image-effects.js` |
| `composite.blend` | kompositt | Smudge `BlendStage.jsx` (8 blendemodeller) |
| `composite.stack` | kompositt | Ny — lagliste med per-lag modus, dekkevne og synlighet |
| `composite.sceneRender` | kompositt | Ny — maler 3D ned på raster (bro mellom 2D og 3D) |
| `scene.object` | kompositt | Ny — ett 3D-objekts plassering, dekkevne og synlighet |
| `scene.group` | kompositt | Ny — hierarki: flere 3D-objekter som én enhet |
| `scene.camera` | kompositt | Ny — 3D-kamera som animerbar verdi |
| `scene.lights` | kompositt | Ny — belysning som animerbar verdi |
| `output.viewport` | output | Ny — merker leveransen for preview |
| `output.export` | output | Ny — merker leveransen for videoeksport (MP4/WebM) |

### Kombinere flere lag

`composite.blend` har to innganger: **Bunn** og **Topp**. For flere lag bruker
du **Lagstabel** (`composite.stack`): koble så mange kilder du vil inn i samme
port «Lag». Lag 1 er bunnen, resten blandes oppå.

Hvert lag har **egen** blandemodus, dekkevne og synlighet — det er laglisten
i komposisjonen. Rekkefølgen endres med ↑/↓, og øyet skjuler et lag uten å
koble det fra. Innstillingene er nøklet på koblingen, så de følger laget når
det flyttes, og kommer tilbake hvis du kobler det fra og til igjen.

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

## Smudge-materialet og effektene

Den gamle `fragment.glsl.js` var én monolitisk shader med 16 effekter i en
løkke. Nå er de delt:

- **`modifier.smudgeDeform`** — flytende glass-effekten. Forskyver bildet i 3D
  etter et støyfelt (twist/pull), bygger en trail av ekko-kopier, og legger på
  hue, fresnel-rand og glans.
- **16 effektnoder** (`modifier.look.chromatic`, `.rainbow`, `.halftone`,
  `.pixelate`, `.lens`, `.ripple`, `.glitch`, `.posterize`, `.vignette`,
  `.dither`, `.duotone`, `.scanlines`, `.zoomBlur`, `.vhs`, `.spherize`,
  `.fletedGlass`) — hver med `amount` og `scale`.

**Rekkefølgen bestemmes av kantene i grafen.** Koble Kromatisk før VHS, så
får du VHS-en på det kromatisk-splittede bildet — og bytter du om, får du
det andre resultatet.

---

## Trail-laget: maling som data

I den gamle appen var malingslaget et lerret som ble endret mens du malte. Det
gjorde at en eksport ville gitt **ulikt resultat for hver kjøring**.

Nå er stemplene **data**:

- `modifier.trail` har et inngangslere (bildet) og et lag av stempler
- Du maler i **maleputen** i inspectoren — dra over puten
- Hvert stempel lagres som `{ u, v, rotation }` i nodens parametere

Derfor er laget deterministisk, kan kopieres, kan animeres, og gir samme
resultat ved hver eksport. Maleputen viser lagets faktiske resultat, så du ser
med én gang hva du maler.

---

## Blob-mode

`source.blob3D` er den raymarchede metaball-formen fra den gamle appen: et
fullskjerm-kvad marsjerer stråler gjennom et avstandsfelt bygget av smeltede
primitiver, med bildet pakket på via triplanar mapping.

Bildeinngangen er **valgfri**. Legger du til en Blob uten å koble noe til,
pakkes en fargegradient rundt formen (to farger under «Farge A/B (uten
bilde)»), så den fungerer som en frittstående kilde. Kobler du til et bilde,
brukes det i stedet.

Den kobles naturlig etter trail-laget, så du kan male inn i formen:

```
bilde ─▶ modifier.trail ─▶ source.blob3D ─▶ modifier.look.chromatic ─▶ viewport
```

---

## Eksport

Eksport-panelet lar deg velge **filformat** (MP4/H.264 eller WebM/VP9),
**bildeformat** (1:1, 16:9, 9:16, 4:5, 4:3, 21:9 eller egendefinert) og
eksakt bredde/høyde. Bildeformatet oppdaterer både forhåndsvisningen og
eksporten, og den lengste siden beholdes når du bytter format — så
oppløsningen ikke krymper hver gang du veksler mellom landskap og portrett.

Valgene lagres sammen med grafen. Hvis grafen har en `output.export`-node,
følger filformatet den nodens innstilling; ellers brukes prosjektinnstillingen.

---

## Tema

Mørkt tema er standard. Knappen med sol/måne øverst til høyre bytter til lyst
tema, og valget huskes i nettleseren (`localStorage`, nøkkel `smudgeflow.theme`).

Fargene styres av variabler i `src/styles/index.css`. Lyst tema overstyrer
zinc-skalaen og de få accentfargene som brukes til tekst. Solide flater, som
lime-knappene, beholder sine farger.

---

## Angre og gjøre om

Alt som endrer grafen, registreres i historikken: noder, koblinger,
parametere, keyframes, LFO, blokker og malte stempler.

- **Cmd/Ctrl + Z** — angrer
- **Cmd/Ctrl + Shift + Z** — gjør om
- Knappene **↶** og **↷** i topplinja viser hva som angres

Raske endringer slås sammen: å dra en node, eller å dra en skyveknapp over
flere verdier, gir **ett** innslag i historikken — ikke hundre.

Historikken tar utgangspunkt i grafen slik den var, så selv den første
endringen kan angres.

---

## OBJ-import

`source.obj` importerer 3D-modeller. Filen lagres som data-URL i noden, så
modellen blir en del av grafen — den kan kopieres, lagres og deles.

Velg filen i inspectoren, og koble modellen til `3D-transform` og
`3D-scene` som en hvilken som helst annen 3D-kilde.

Parseren er portet ordrett fra den gamle appen (med ear clipping for
koncave flater), og er dekket av en paritetstest som sammenligner
resultatet med originalen.

---

## Scenen: rekkefølge og hierarki

En nodegraf har ingen innebygd *rekkefølge* og ingen *hierarki* — to ting en
scene trenger. De er løst med hver sin node, i stedet for med én stor
scene-node:

| Behov | Løsning |
|---|---|
| Hva ligger øverst? | **Lagstabel** (`composite.stack`) — z-order |
| Hva hører sammen? | **Gruppe (3D)** (`scene.group`) — barn |
| Flytt alt i gruppen | **Objekt** (`scene.object`) etter gruppen — transformen legges oppå |
| Hvor står kameraet? | **Kamera (3D)** (`scene.camera`) — verdi |
| Hvordan er lyset? | **Belysning (3D)** (`scene.lights`) — verdi |

```
source.mesh3D ──▶ scene.object ──┐
                                 ├─▶ scene.group ──▶ scene.object ──┐
source.obj ─────▶ scene.object ──┘      (barn)         (forelder)   │
                                                                   ├─▶ sceneRender
                             scene.camera ─────────────────────────┤
                             scene.lights ─────────────────────────┘
```

Alt er vanlige noder: hvert objekt kan kobles til en loop-generator, hver
kamera-parameter kan animeres, og hele scenen kan markeres og lagres som en
blokk. Det er motsetningen til én svart boks med en egen editor inni.

`scene.object` **legger** transformen sin oppå objektets egen (den erstatter
ikke, slik `modifier.transform3D` gjør). Derfor kan den brukes både som
plasseringsverktøy og som forelder for en gruppe.

---

## Blokk-bibliotek

Fanen **Blokker** inneholder ferdige oppsett og blokkene du selv har lagret.

**Innebygde oppsett:** Generativ bakgrunn, Raster-behandling, 3D-form,
3D-scene, 3D-gruppe, Loop-animert forvrengning, Lagstabel, Smudge-glass,
Glass-blob.

**3D-scene** er den komplette scenen: to innebygde former i en gruppe, en
forelder, kamera og belysning. Koble egne objekter inn i «Egne objekter» —
de legges til uten å fortrenge de innebygde.

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
