# Arkitektur

## 1. Dataflytmodellen

Grafen er en **DAG**. Noder har porter inn og ut, og verdier flyter langs kantene.
Ingen node vet hva som er "øverst i treet" — det er bare en graf.

```
┌──────────────────────────────────────────────────────────────┐
│ UI (React Flow + paneler)                                   │
│   redigerer graf, params, tracks, LFO, grupper, eksport      │
└───────────────┬──────────────────────────────────────────────┘
                │ graph + frame
┌───────────────▼──────────────────────────────────────────────┐
│ Evaluator (rekursiv)                                        │
│   1. topoSortScope(...)  → deterministisk rekkefølge        │
│   2. resolveParamsAt()   = params → keys → LFO → kobling     │
│   3. def.evaluate(ctx, inputs, params) → outputs             │
│   4. memo: tidsuavhengige noder gjenbrukes                  │
│   ↳ gruppe-noder evalueres i egen scope med inngående verdier│
└───────────────┬──────────────────────────────────────────────┘
                │ verdier (drawable / canvas / object3d / number)
┌───────────────▼──────────────────────────────────────────────┐
│ NodeDefinitions (rene kontrakter)                          │
│   source.* → modifier.* → composite.* → output.*            │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│ RenderServices (eneste eier av DOM/GPU)                     │
│   canvas-basseng · asset-cache · 2D-raster · three · MP4     │
└──────────────────────────────────────────────────────────────┘
```

### Topologisk sortering

`src/engine/topoSort.ts` er Kahn-algoritmen over **delgrafen som mater målene**,
ikke over hele grafen. En graf med 50 noder, men bare 3 noder foran
viewporten, evaluerer bare de 3 (pluss kildene deres).

Tre egenskaper er viktige:

- **Determinisme.** Noder med lik inndegsgrad sorteres etter rekkefølgen i
  `graph.nodes`. Samme graf gir alltid samme evalueringsrekkefølge.
- **Syklusdeteksjon.** En syklus gir en lesbar feil, ikke en evig løkke.
  `wouldCreateCycle()` hindrer at en ulovlig kant i det hele tatt lages.
- **Parameter-koblinger er også avhengigheter.** En node som driver en
  parameter i en annen må evalueres etter kilden sin.

---

## 2. Verdidomener

To domener, med eksplisitte broer. Dette er det som holder grafen evaluerbar
på CPU og gjør at 2D og 3D kan sameksistere.

| Domene | Verdityper | Noder |
|---|---|---|
| **Raster** | `drawable`, `canvas`, `frame` | gradient, motionGraphics, noise, voronoi, image, transform2D, motion2D, raster, blur, pixelate, warp, blend, stack, bloom, grade |
| **3D** | `object3d` | mesh3D, text3D, transform3D, motion3D, scatter3D, sceneObject, sceneGroup |
| **Bro** | `object3d` → `canvas` | `composite.sceneRender` |
| **Data** | `number`, `string`, `boolean`, `color` | loop, camera, lights, param-koblinger |

Uten bro-noder må hver node eie en WebGL-kontekst — det er nettopp problemet
med `Stage.jsx` i den gamle kodebasen. Med broer kan hele DAG-en evalueres på
CPU, og 3D er bare én renderer-plugin.

`composite.sceneRender` maler 3D-objekter ned på et raster-lerret. Da kan 3D
blandes med 2D-lag, rastereffekter og eksporteres som vanlig.

### Fargekoder i grensesnittet

Alle porter farges etter verditype. Regelen er at to porter kan kobles sammen
hvis de har samme farge. `canvas` og `drawable` deler derfor farge, siden de er
de eneste krysskompatible typene.

| Farge | Verditype | Vises som |
|---|---|---|
| `#a3e635` | `canvas`, `drawable` | Bilde |
| `#fb923c` | `object3d` | 3D-objekt |
| `#60a5fa` | `number` | Tall |
| `#c084fc` | `camera` | Kamera |
| `#facc15` | `lights` | Lys |

Parameterinnganger er også tall (blå), men tegnes som en **diamant** og får
stiplede kanter. Når brukeren drar en kobling, dempes alle porter som ikke
passer, mens kompatible mål lyser. En liten fargeforklaring ligger oppå
lerretet og kan skjules.

Nodekortet viser en type-chip på hver port, og kantene arver fargen fra
kildeporten. Sidepanelene er delt i sammenleggbare seksjoner, og nodepaletten
har søk. Åpen/lukket-tilstand huskes i `localStorage` under
`smudgeflow.ui.open.*`.

Hovedpanelene kan justeres med skillestripene mellom venstre sidebar, grafen,
bunnpanelet og forhåndsvisningen. Størrelsene lagres under
`smudgeflow.ui.layout.v1`, og dobbeltklikk på en skillestripe gir
standardstørrelsen tilbake. Både tastatur (piltaster, Home/End) og peker kan
brukes. Grensene regnes ut fra vinduets faktiske størrelse, slik at grafen
alltid beholder en minimumsflate og layouten aldri får horisontal overflow —
også når en stor layout gjenåpnes i et smalere vindu.

Et Houdini-inspirert hurtigsøk ligger på lerretet: **Tab** åpner en søkbar
nodeliste ved musepekeren, piltastene velger, og **Enter** legger noden inn
på samme sted. Tab stjeles ikke fra felt og andre redigerbare elementer.

---

## 3. Gjenbrukbare workflows: gruppe-noder

En gruppe-node **er en graf inni grafen**. Det er den bærende funksjonen for
å bygge større, gjenbrukbare nodetrær.

```
┌──────────────────────────────┐
│  Gruppe « behandling »        │   in-0 ─┐
│  ┌─────────┐   ┌─────────┐   │         │  ┌─────────┐
│  │ raster  │──▶│ stack   │──▶│ out-0   │  │ 3D-form │
│  └─────────┘   └─────────┘   │         │  └─────────┘
└──────────────────────────────┘
```

### Så brukes det

1. **Merk** nodene som utgjør behandlingen (Shift-klikk), og trykk
   «Lag gruppe».
2. **Eksponer** portene du vil kunne bytte: i inspectoren under «Innhold» kan
   du eksponere en intern port som inngang eller utgang. En eksponert
   inngang er et **håndtak** på gruppen, som du kobler en ny kilde til.
3. **Kopier** gruppen («Lag kopi»). Kopien får egne interne node-ID-er, slik
   at den er en fullstendig selvstendig instans — samme behandling, nytt
   innhold.

Eksponerte innganger er *overstyrbare*: den interne kanten beholdes som
standardverdi, men en ekstern kilde som kobles til porten vinner. Det er
nøyaktig «bytt input, behold samme treatment».

### Semantikk

| Regel | Hvorfor |
|---|---|
| Én gruppe-inngang per intern målport | En port har én verdi, som i den indre grafen |
| Inngangen blir `multiple` hvis den interne porten er det | Lagstabelen kan ta N lag |
| Ellers vinner den siste eksterne kilden | Samme regel som i en flat graf |
| Kopier får unike interne ID-er | Uten dette deler kopiene lerret og tilstand |

Motoren støtter grupper rekursivt: `evaluateScope()` kalles på nytt for
subgrafen, med verdiene for de eksponerte inngangene injisert. En gruppe kan
derfor inneholde grupper.

### Blokk-bibliotek

En *blokk* er en gjenbrukbart nodetre som lever utenfor grafen. Teknisk er
den en gruppe-node som er lagret som data:

```ts
interface BlockTemplate {
  id, name, description?, category?
  version: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  inputs: GroupInput[]
  outputs: GroupOutput[]
  builtin?: boolean
}
```

Når en blokk settes inn, blir den en gruppe-node med `rekeySubgraph()` — egne
interne node-ID-er, slik at den er en selvstendig instans.

To automatiske grep gjør at en blokk faktisk er brukbar:

| Grep | Hvorfor |
|---|---|
| Innholdskildene holdes utenfor | Ellers blir blokken lukket, og du kan ikke bytte innhold |
| Bladnodens utgang eksponeres | Ellers kommer resultatet ingen vei |

`withDefaultSources()` legger et synlig standardinnhold i hver eksponert
inngang uten intern kilde. Da virker blokken med én gang, og en ekstern kilde
kan overstyre standarden.

Når du trykker «Last inn», spør appen om blokken skal **legges til** i grafen
du har, eller **erstatte** hele nodetreet. Ved erstatning beholdes
prosjektinnstillingene (fps, lengde, oppløsning), og blokkens første eksponerte
utgang kobles til en ny viewport. Etterpå panorerer visningen til det nye
treet, slik at en blokk aldri ender utenfor lerretet.

Blokker lagres i `localStorage` og kan eksporteres/importeres som JSON.

---

## 4. Automatisert looping

### Kurvenoder (`curve.*`)

Egne, frittstående noder i kategorien **Kurver**. Hver node lager én løkkesikker
verdi og styrer hvilken som helst tallparameter via diamanten på målnoden.

| Node | Form |
|---|---|
| `curve.sine` | Sinus |
| `curve.triangle` | Trekant |
| `curve.saw` | Sagtann |
| `curve.square` | Firkant, med `width` (pulsbredde) |
| `curve.noise` | Løkkesikker støy (`detail`, `seed`) |
| `curve.ease` | Myk opp-og-ned (smoothstep) |
| `curve.bounce` | Sprett (skarpe bunner) |
| `curve.spring` | Dempet svingning (`ripples`, `damping`) |
| `curve.steps` | Trapp (`detail` = antall trinn) |
| `curve.hold` | Tilfeldig trinn / sample & hold |

Felles parametere: `cycles` (heltall per loop), `phase` (0..1), `min`, `max`.
Utgangene er `value` (min..max) og `inverse` (`min + max − value`), så én kurve
kan styre to parametere i motfase.

Formene ligger i `src/engine/animation/curves.ts`. Alle er periodiske med
periode 1, og `cycles` er et heltall, så verdien ved frame 0 er lik verdien ved
frame N. Dekket av `tests/curves.test.ts`.

### Loop-generatoren (`source.loop`)

Lager verdier som er **løkkesikre**: verdien ved frame 0 er identisk med
verdien ved frame N. Derfor hopper ikke animasjonen når loopen lukkes, og
eksporten blir bit-identisk med previewen.

| Parameter | Virkning |
|---|---|
| `algorithm` | sine, trekant, sag, firkant, **løkkesikker støy** |
| `cycles` | Sykluser per loop |
| `window` | `pingpong` (frem/tilbake) eller `cosine` (myk) |
| `min` / `max` / `amplitude` / `offset` | Kartlegging til et verdiområde |
| `detail` / `seed` | Støyens detaljgrad og frø (deterministisk) |

Vinduet former *fasen* før algoritmen anvendes. Derfor lukker alle
algoritmer seg eksakt, også støyen (som interpolerer mellom hash-verdier på
et sirkulært gitter).

### Animasjonspresets (`modifier.motion2D` / `modifier.motion3D`)

De ferdige bevegelsene fra den opprinnelige Smudge/Orbit-appen er egne noder,
ikke skjulte egenskaper på objektene. Det gjør dem synlige i grafen, og de kan
kombineres med keyframes og LFO-er uten å overskrive noe.

| Node | Presets | Virkning |
|---|---|---|
| `modifier.motion2D` | svev, gli, sirkelbane, vugging, puls, fade | Tegner innholdet på nytt rundt lerretets midtpunkt med en løkkesikker 2D-transform. |
| `modifier.motion3D` | orbit, bølge, rutenett, spiral, sverm, vuggende rotasjon, puls | Legger en 3D-transform *oppå* objektets egen, så keyframes og hierarki beholdes. |

Begge bruker `ctx.phase` og et heltall antall sykluser per loop. Derfor er
verdien ved fase 1 identisk med fase 0. `motion3D` har også en startfase og en
faseforskyvning per objekt. Når inngangen er en gruppe — for eksempel fra
`modifier.scatter3D` — får hvert toppnivå-barn sin egen bevegelse. Da virker
spiral/sverm og faseforskyvningen per kopi, som i den gamle cloneren.

Standardblokkene «Bevegelig bilde» og «3D-animasjon» er ferdige kjeder som viser
begge nodene med et fornuftig utgangspunkt.

### Parameter-koblinger

En node kan styre en parameter i en annen node. I UI-et: dra fra en
tallutgang til den blå diamanten ved parameteren i nodekortet. Kortet viser de
fire første tallparametrene; **Vis alle** åpner resten. Parametere som er
koblet vises alltid, slik at koblingen ikke mister håndtaket sitt.

```
curve.sine ──value──▶ modifier.raster.param:cellSize
```

Motoren løser parametrene i rekkefølgen:

```
node.params → keyframes → LFO → parameter-kobling → clamp/round
```

En koblet parameter overstyrer keyframes for samme parameter (koblingen er
det sterkeste signalet). Kilden evalueres alltid før målnoden, og
parameterkoblingen teller som en avhengighet i den topologiske sorteringen.

---

## 5. Shader-splittet

Den gamle `fragment.glsl.js` var én monolitisk shader med 16 stilistiske
effekter i en løkke over `uLookOrder`. Nå er de delt:

| Del | Fil | Node |
|---|---|---|
| Støybibliotek | `render/shaders/noise.glsl.ts` | (deles) |
| Vertex-shader | `render/shaders/smudgeVertex.glsl.ts` | `modifier.smudgeDeform` |
| Fragment-shader | `render/shaders/smudgeFragment.glsl.ts` | `modifier.smudgeDeform` |
| 16 effekter | `render/shaders/looks.ts` | `modifier.look.*` |
| Grade + glød | `render/shaders/postFx.ts` | `modifier.grade`, `modifier.bloom` |
| Støy + celler | `render/shaders/generators.ts` | `source.noise`, `source.voronoi` |
| Egen GLSL | `render/shaders/custom.ts` | `modifier.shader` |

**Grunnmaterialet** (`modifier.smudgeDeform`) har beholdt trailen av
ekko-kopier, hue/metning, fresnel-rand og glans. Det er vertex-normalene
som gjør at den trenger en 3D-renderer.

**Effektene** er egne noder. Hver har `amount` og `scale`, og kobles i
grafen som alt annet. Rekkefølgen bestemmes av kantene — ikke av en array.

### Tekniske grep

| Grep | Hvorfor |
|---|---|
| Effektkoden blir *kroppen* i `applyLook()` | Effektene får `bl`, `pw`, `sc` og `dir` akkurat som i den gamle loopen |
| ÉN delt WebGL-kontekst for alle effekter | Nettleserne begrenser antallet kontekster; 16 effekt-noder kan ikke ha hver sin |
| Materialer caches per GLOW-kode | Hver effekt kompileres bare én gang |
| `three.js` lastes dynamisk | Hovedpakken holder seg på ~157 kB gzip |
| Tiden kommer fra `ctx.phase` | Effektene lukker seg eksakt med loopen |

Effektene sampler fra *passens eget input-lerret* (ikke fra kildeteksturen
slik som i originalen). Det er den naturlige semantikken i en nodegraf, og
gjør at effektene kan kobles fritt i hverandre.

### Lån fra vgpu

[vercel-labs/vgpu](https://github.com/vercel-labs/vgpu) er en WebGPU-runtime,
ikke et nodebibliotek. Vi har derfor ikke byttet backend (det ville krevd WGSL
overalt og mistet determinismen i eksporten), men portet enkeltdeler:

| Lån | Fra | Node |
|---|---|---|
| Simplex-fBm og domene-warp | `@vgpu/wgsl-std/noise/perlin` | `source.noise` |
| Voronoi f1/f2/celle-ID | `@vgpu/wgsl-std/noise` | `source.voronoi` |
| ACES, Reinhard, eksponering | `@vgpu/wgsl-std/color` | `modifier.grade` |
| Luminansterskel + Vogel-skive | `@vgpu/wgsl-std/color`, `/sampling` | `modifier.bloom` |
| 15 geometrier | `vgpu/scene` | `source.mesh3D` |
| Wireframe- og normal-materialer | `vgpu/render/inspect` | materialmodus |
| Instansmønstre | `instanced-rendering`, `spiral-galaxy` | `modifier.scatter3D` |

**Loop-sikkerheten er vår egen.** Støyen driver i en sirkel i støyrommet og
morfer mellom to z-snitt med `sin²(π·fase)`; begge er null i enden av loopen.
Celler og spredning bruker bare sirkulær drift og hele omdreininger. Frame 0 og
frame N er derfor bit-identiske (verifisert med pikseldiff i nettleseren).

### 3D-tekst

`source.text3D` ekstruderer tekst til ekte geometri med three.js sin
`TextGeometry`. Fonten er Droid Sans og ligger i `src/assets` sammen med
lisensen — npm-utgaven av three har ikke eksempelfontene. Droid Sans dekker
nordiske tegn. Fonten parses én gang per økt, og geometrien memoiseres per
tekst, størrelse, tykkelse og kurvekvalitet. Geometrien er sentrert rundt
origo, så den roterer rundt midtpunktet.

### Egen shader

`modifier.shader` lar deg skrive GLSL i inspectoren. Koden blir kroppen i
`applyLook()`, med samme kontrakt som de innebygde effektene (`col`, `uv`,
`centered`, `bl`, `pw`, `sc`, `uTime`, `uValueA–D`, `uColorA/B`). Fire tall
og to farger er animerbare parametere, så shaderen kan styres av keyframes,
LFO-er og loop-generatorer som alt annet. Tiden er `fase · sekunder · cycles`,
med fasen brettet til 0..1: hele `cycles` per loop gir eksakt samme tid i
frame 0 og frame N.

---

## 6. Historikk

Historikken er basert på **øyeblikksbilder av grafen**. Den registreres
automatisk: et abonnement på butikken fanger hver endring, og en
`describeChange()`-funksjon finner ut *hva* som endret seg.

| Endring | Etikett | Nøkkel (slår sammen) |
|---|---|---|
| Noder lagt til/slettet | «Endret grafen» | — |
| Koblinger | «Endret koblinger» | — |
| Parametere | «Endret parameter» | `param:<node>:<key>` |
| Keyframes | «Endret keyframes» | `tracks:<node>` |
| LFO | «Endret animasjon» | `lfo:<node>` |
| Posisjon | «Flyttet node» | `move:<node>` |

Nøkkelen gjør at en node som dras, eller en skyveknapp som kjøres over,
gir **ett** innslag i stedet for hundre.

Historikken har en grense (80 innslag) og tar utgangspunktet som første
innslag, slik at selv den første endringen kan angres.

---

## 7. Tidskontrakt

| Felt | Betydning |
|---|---|
| `ctx.frame` | Heltall 0..totalFrames-1 |
| `ctx.time` | `frame / fps` — sekunder inn i loopen |
| `ctx.phase` | `frame / totalFrames` — 0..1, lukker seg eksakt |

**Forbudt** inne i `evaluate()`: `Date.now()`, `performance.now()`,
`Math.random()`, `requestAnimationFrame`. Tilfeldighet går via seedet hash.

Loop-fasen er bevisst *ikke* sekunder. En LFO med `cycles: 1` er da eksakt én
syklus per loop, uansett fps — så loopen lukker seg bit-identisk, og
eksporten kan ikke få en hopp.

---

## 8. Skalering og ytelse

| grep | Hva det løser |
|---|---|
| **Memoisering** (`timeDependent: false`) | Tidsuavhengige noder (statiske gradienter, geometri) tegnes ikke på nytt når inngangene er uendret |
| **Signatur på node-versjoner** | Memo treffer kun når innholdet faktisk er uendret — virker for lerret, 3D-objekter og tall |
| **Delgraf-evaluering** | Bare nodene som mater målet evalueres |
| **Canvas-basseng** | Én lerret per node, gjenbrukt mellom frames |
| **Forhåndsvisningsskalering** | Preview kan tegnes i 25/50/100 % — eksporten kjører alltid full oppløsning |
| **Scope-nøkler** | Noder inne i grupper får egne lerret, så de ikke kolliderer |

`ctx.scopeKey` er den unike nøkkelen for noden *innenfor sin scope*. Den
brukes til lerret- og cache-nøkler.

---

## 9. Kontrakter

### NodeDefinition

```ts
interface NodeDefinition<P> {
  type: string
  label: string
  category: 'source' | 'modifier' | 'composite' | 'output'
  description?: string
  inputs: readonly PortDef[]
  outputs: readonly PortDef[]
  params: readonly ParamDef[]
  evaluate(ctx: EvalContext, inputs: InputValues, params: P): Outputs | Promise<Outputs>
  cache?: 'frame' | 'static'
  timeDependent?: boolean | ((params) => boolean)
}
```

`ParamDef.key` kan være en **punktsti** (`"transform.position.x"`), fordi
keyframes skal kunne adressere hvilken som helst egenskap.

### RenderServices

Motoren kjenner ikke DOM. Den får en `RenderServices` (kontrakten i
`src/engine/types.ts`, implementasjonen i `src/render/RenderServices.ts`):

- `canvas(key)` — gjenbrukt lerret per node
- `touch(key)` / `versionOf(value)` — versjonssporing for memo
- `assets.image(src)` — cachet bilde
- `assets.videoFrame(src, time)` — **deterministisk**: seeker og venter på
  `seeked` per frame (ellerses får hver frame et tilfeldig bilde)

### NodeResolver

Motoren slår opp portdefinisjoner gjennom en `NodeResolver`, ikke direkte
mot applikasjonens register. Det gjør at motoren kan testes isolert og
senere flyttes til en egen pakke.

---

## 10. Eksport

`src/export/exportGraph.ts` kjører SAMME `evaluator.evaluateFrame()` som
forhåndsvisningen, men itererer `frame = 0..N-1` uten rAF. Hver frame tegnes
på en eksplisitt buffer og sendes til MediaBunny med et eksplisitt tidsstempel
(`frame / fps`). Derfor:

- Lengden er eksakt `frames / fps` sekunder.
- Innholdet er identisk med det du så i preview.
- Avbryting er trygt (`AbortSignal` sjekkes per frame).

Eksporten setter renderstørrelsen til full oppløsning, uansett hva
forhåndsvisningen er nedskalert til.

Eksportformatet velges i eksportpanelet:

- **Filformat:** MP4/H.264 eller WebM/VP9. Nettleserens støtte avgjør om
  kodeken kan brukes, med trygg fallback til nærmeste støttede kodek.
- **Bildeformat:** 1:1, 16:9, 9:16, 4:5, 4:3, 21:9 eller egendefinert
  bredde/høyde. Når et format velges, beholdes den lengste siden, slik at
  gjentatt veksling mellom landskap og portrett ikke krymper oppløsningen.
  Dimensjonene rundes til partall og holdes innenfor 64–4096 piksler.

Regnestykkene ligger i `src/export/outputFormat.ts` og er dekket av
`tests/outputFormat.test.ts`. Filformatet ligger i `graph.settings.exportFormat`
når grafen ikke har en `output.export`-node; noden overstyrer prosjektvalget.

---

## 11. Feil håndtert

| Feil | Hvor | Melding |
|---|---|---|
| Ukjent nodetype | `registry.get()` | `Ukjent nodetype: "x".` |
| Syklus | `topoSortScope()` | `Grafen inneholder en syklus: a → b → a` |
| Mangler input | `evaluator` | `«Node» mangler input «Inn» — koble en kilde til porten.` |
| Ugyldig portkobling | `useGraphStore.connect()` | Koble ganske stille (returnerer `false`) |

Ugyldige koblinger avvises stille i UI-et (ingen kanter opprettes), mens
sykluser og manglende inputs gir **eksplisitte** feil — både i konsollen og
som en rød boks i forhåndsvisningen. Nodekort som mangler en påkrevd inngang
får en rød prikk.

---

## 12. Roadmap

| Fase | Innhold | Status |
|---|---|---|
| 1 | Motor-kjerne: topoSort, evaluator, params, registry | ✅ |
| 2 | Port av ren logikk: keyframes, LFO, gradient, pikseleffekter | ✅ (+ paritetstester) |
| 3 | Legacy-noder: gradient, motionGraphics, raster, blur, pixelate, warp, blend | ✅ |
| 4 | Graf-UI: React Flow, inspector, palett, prosjekt-lagring | ✅ |
| 5 | Timeline: keyframes, LFO, scrubbing | ✅ |
| 6 | Eksport: MP4/WebM | ✅ |
| 7a | **Subgrafer / gruppe-noder** | ✅ |
| 7b | **Parameter-koblinger** | ✅ |
| 7c | **Loop-generator** | ✅ |
| 7d | **3D: mesh3D, transform3D, sceneRender** | ✅ |
| 7e | **Smudge-shaderne delt** (grunnmateriale + 16 effektnoder) | ✅ |
| 7f | **Trail-laget som stempel-data** | ✅ |
| 7g | **Blob-mode** (`source.blob3D`) | ✅ |
| 7h | **Undo/redo** | ✅ |
| 7i | **OBJ-import** (`source.obj`) | ✅ |
| 7j | **Scenemodellen**: lag per lag, hierarki, kamera og lys som verdier | ✅ |
| 7k | **Lån fra vgpu**: 3D-former, materialmodus, Grade/Glød | ✅ |
| 7l | **Lån fra vgpu**: støy, celler og spredning (loop-sikkert) | ✅ |
| 8a | **Tekst som 3D-geometri** (`source.text3D`) | ✅ |
| 8b | **Scene-import** fra den gamle appens `scene.json` | ⬜ |
| 9 | Rydd: slett `src/legacy/`, flytt `src/engine` til `packages/engine` | ⬜ |

### Trail-laget

Malingslaget i den gamle appen var et lerret med tilstand. Nå er stemplene
**data** i nodens parametere:

```ts
interface TrailStamp { u: number; v: number; rotation: number }
```

Maleputen i inspectoren skriver disse, og `modifier.trail` rendrer dem på nytt
hver frame. Da er laget deterministisk, kan kopieres og animeres, og gir
samme resultat ved hver eksport.

### Scenemodellen

En DAG kan ikke uttrykke to ting som en scene trenger: **rekkefølge** og
**hierarki**. Løsningen er ikke én scene-node, men to små prinsipper:

- **Rekkefølge** — `composite.stack` er laglisten. Hvert lag har egne
  innstillinger, nøklet på kant-id (deterministisk: `kilde.port->mål.port`).
  Derfor følger innstillingene laget når det flyttes, og overlever at det
  kobles fra og til. `rekeySubgraph` flytter nøklene når en gruppe kopieres.
- **Hierarki** — `scene.group` samler objekter til én verdi med barn.
  `scene.object` etter gruppen legger sin transform oppå gruppens, slik at
  hele treet flyttes som én. Transformen *legges oppå* (compose), den
  erstatter ikke — det er forskjellen fra `modifier.transform3D`.

Kamera og lys er **verdier** (`scene.camera`, `scene.lights`), ikke skjulte
innstillinger på rendereren. Da kan de animeres, kobles til en loop-generator
og inngå i en blokk. `composite.sceneRender` tar dem som valgfrie innganger
og faller tilbake på sine egne parametere.

Motoren gir hver node `ctx.inputEdges` — kantene bak hver multiple-port, i
samme rekkefølge som verdiene. Det er det som gjør per-lag-innstillinger
mulige uten å gjette hvilket lag en verdi kom fra.

**Kjent begrensning:** lag som kommer *utenfra* en gruppe har ingen kant-id
inne i gruppen, så per-lag-innstillinger gjelder bare for lag som er koblet
internt.

### Planlagt for neste runde

- **Scene-import** fra den gamle appens `scene.json` — hvert objekt blir en
  kjede av `source.mesh3D`/`source.text3D`/`scene.object`/`scene.group`.
- **Tekstur-sampling** (`sampleTexture.js`) som egne noder.
- **Scene-editor**: lag med 2D- og 3D-objekter, 3D-kamera som en node.
