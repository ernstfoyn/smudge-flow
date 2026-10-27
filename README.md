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

Hold **Alt** (Option på Mac) og klikk på en parameter i Egenskaper for å
tilbakestille bare den til standardverdien. Vanlig klikk endrer verdien som før.

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
| `source.text2D` | kilde | Ny — tekst på gjennomsiktig lerret |
| `source.shape2D` | kilde | Ny — rektangel, ellipse, trekant, diamant, stjerne og polygon |
| `mask.shape` | maske | Ny — fasong- og gradientmaske |
| `mask.key` | maske | Ny — maske fra lysstyrke eller chroma key |
| `modifier.mask` | maske | Ny — klipper et bilde med en maske |
| `mask.combine` | maske | Ny — union, snitt eller fratrekk av to masker |
| `modifier.fit` | modifikator | Ny — beskjær og tilpass bilde/video til formatet |
| `modifier.displace` | modifikator | Ny — forskyv bildet med et kart |
| `modifier.echo` | modifikator | Ny — etterslep fra tidligere frames |
| `modifier.pattern` | modifikator | Ny — fragmentert prisme fra patternable |
| `modifier.gradientMap` | modifikator | Ny — flerfarge-gradient på objekt eller gruppe |
| `source.audio` | kilde | Ny — lydfil med nivå, bass, mellomtone og diskant |
| `source.kineticText` | kilde | Ny — tekst på ringer rundt en sylinder, inspirert av Space Type Generator |
| `curve.signal` | signal | Ny — en kurve (sinus, trekant, støy, tegnet …) med hastighet og fase. Kobles til «Styring» på en node |
| `source.loop` | signal (skjult) | Ny — eldre alt-i-ett loop-generator, brukt av blokkene |
| `value.math` | signal | Ny — regn på to tall/signaler: legg sammen, multipliser, min/maks, potens, modulo, avrunding |
| `value.remap` | signal | Ny — flytt et tallområde til et annet, med klemming og smoothstep |
| `value.switch` | signal | Ny — velg én av fire tallinnganger |
| `image.switch` | kompositt | Ny — velg ett av fire bilder eller videoer |
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
port «Lag». Lag 1 er toppen; radene under ligger bak. Standardmodus er
`normal`, slik at rekkefølgen faktisk påvirker resultatet. Moduser som `screen`,
`multiply`, `lighten`, `darken`, `difference` og `add` er rekkefølge-uavhengige;
appen viser et varsel når alle lag bruker en slik modus. Bruk `normal` og
100 % dekkevne når 3D-objekter skal være helt ugjennomsiktige.

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
det andre resultatet. Look-effektene dekker hele flaten som standard, slik at
effekten ikke blir låst inne i formen. Slå på **Behold formens alfa** når du
heller vil klippe effekten til silhuetten. For å legge en fullflate-effekt over
en gradient uten å skjule den, bruk **screen** i Lagstabelen. Når en forskyvning
sampler utenfor formen, faller den tilbake til pikselens egen farge i stedet for
å dra svart inn i silhuetten.

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
brukes det i stedet. Bakgrunnen kan også bruke en flerfarge-gradient med
**Bakgrunnsgradient** når bakgrunnsmodus er «Gradient».

Den kobles naturlig etter trail-laget, så du kan male inn i formen:

```
bilde ─▶ modifier.trail ─▶ source.blob3D ─▶ modifier.look.chromatic ─▶ viewport
```

---

## Bilde og video

`source.image` kan bruke en lokal fil eller en URL. Lokale filer lagres i
nettleserens filbank (IndexedDB, `smudgeflow.media.v1`), og noden lagrer bare
en `assetId` med navn, type og dimensjoner. Da holder prosjektfilen seg liten,
og samme fil kan brukes av flere noder.

- Velg **Fil** for å laste opp, eller dra filen rett på noden. Slippes den på
  lerretet, lages en ny Bilde/video-node.
- **Cmd/Ctrl + V** limer inn et bilde fra utklippstavlen.
- **URL** brukes for filer som ligger ute. Adressen må tillate CORS for at
  eksporten skal virke.
- Video samplet per frame. «Bruk videotid» følger animasjonens tid; slår du
  den av, brukes første frame.

Prosjektfilen inneholder ikke selve filene. Åpnes den i en annen nettleser
eller på en annen maskin, viser noden at filen mangler og tilbyr å koble den
til på nytt.

## 2D-tekst og fasonger

`source.text2D` tegner tekst på et gjennomsiktig lerret, med font, størrelse,
vekt, farge, justering og linjeavstand. `source.shape2D` tegner rektangel,
ellipse, trekant, diamant, stjerne eller polygon med fyll, kant og rotasjon.
Begge har **Universell skala**, som skalerer tekststørrelse eller bredde/høyde
samlet. De følger grafens oppløsning og kan blandes med bilder i en Lagstabel.
Slå på **Gradientfyll** for å fylle tekst eller fasong med en flerfarge-gradient
i stedet for en flat farge.

### Masker og matte

Masker bruker alfa: hvitt er synlig og gjennomsiktig er skjult. Da virker
myke kanter naturlig, og masken kan brukes direkte på et bilde.

- **Fasongmaske** lager ellipse, rektangel, trekant eller lineær/radial gradient.
- **Bildemaske** lager en maske fra lysstyrken i et bilde, eller fjerner en farge med chroma key.
- **Bruk maske** klipper et bilde med masken, med valgfri invertering.
- **Kombiner masker** lager union, snitt eller fratrekk av to masker.

Vanlig kjede:

```
2D-tekst ─▶ Bruk maske ─▶ Lagstabel ─▶ Viewport
Fasongmaske ─▶ Maske
```

### Gradienter

`source.gradient` bruker nå en ekte **flerfargestopp-editor**. Klikk direkte på
gradientstripen for å legge til et fargestopp der du klikker, eller bruk
«+ Farge». Du kan ha opptil åtte farger, flytte dem langs skalaen, velge farge
og justere mykheten mellom nabofargene. Dette er en videreføring av
gradientmotoren fra Orbit.

Velg **Ensfarget** for en flat farge. Da vises ett vanlig fargefelt i stedet for
gradienteditoren, og vinkel, fargevandring og tetthet skjules fordi de ikke
brukes i den modusen.

Samme flerfarge-editor brukes nå også i **Generativ grafikk**, **2D-tekst**,
**2D-fasong**, **Blob**, **Støy** og **Celler**. Noder med en solid/gradient-
bryter viser fargefeltet i solid modus og gradienteditoren i gradientmodus.
Tomme stopp faller tilbake til de gamle Farge A/B-verdiene, så eldre grafer
virker som før.

`modifier.gradientMap` legger en flerfarge-gradient på et objekt eller en
gruppe:

- **Fyll formen (alfa)** fyller silhuetten med gradienten.
- **Map lysstyrke** mapper gråtoner og 3D-scener gjennom gradientskalaen.

Koble for eksempel en 3D-scene, en Lagstabel eller en gruppe inn i Gradient map,
og deretter videre til Viewport.

### Fonter

**2D-tekst** har et bredt utvalg systemfonter: System, Arial, Helvetica, Verdana,
Trebuchet, Gill Sans, Georgia, Times, Palatino, Courier og Impact.

**3D-tekst** har egne typeface-fonter med full ÆØÅ-dekning:

- Droid Sans, Droid Sans Fet og Droid Sans Mono (Apache 2.0)
- Droid Serif og Droid Serif Fet (Apache 2.0)
- Gentilis og Gentilis Fet (MgOpen)

Fontene ligger i `src/assets/`. Når fonten endres, bygges 3D-geometrien på nytt.
Lisensene ligger ved siden av fontfilene.

### Lagstabel og grener

Hver rad i lagstabelen representerer hele grenen som mater laget, ikke bare
den siste noden. Er det en effekt mellom kilden og lagstabelen, viser raden
både effekten og kjeden bak, for eksempel «Raster» med «Gradient → Raster».
Hele grenen flyttes samlet med pilene eller ved å dra i håndtaket.

Du kan sette inn en node midt på en kobling på tre måter: velg koblingen og
trykk **Tab**, dobbeltklikk koblingen, eller hold **Shift** mens du drar en node
fra paletten og slipper den på koblingen.

### Kinetic type

`source.kineticText` setter tekst på ringer rundt en sylinder, inspirert av
[Space Type Generator](https://spacetypegenerator.com/). Den gir et 3D-objekt
som kobles til 3D-scene.

Parametere: tekst, font, variant, bokstavstørrelse, tykkelse, antall ringer,
ringradius, ringavstand, rotasjon per loop, forskyvning per ring, bølger per
loop, bølgeutslag og vertikal strekk. Rotasjon og bølger bruker heltallige
sykluser, slik at loopen lukker seg eksakt. Materialet kan være standard,
wireframe eller normaler.

Varianter: Cylinder, Field, Stripes, Coil, Flag, Morisawa, Cascade, Ribbon,
Layers, Danger, String, Badge, Clutter, Construct, Snap, Flash, Pow, Crash,
Crash Clock, Vessel, Shine, Boost og BoxSquad.

### Fragmentprisme

`modifier.pattern` er patternable-mekanikken fra `Verktoy/pattern-studio`:
inputbildet tegnes som ett bildeflate-lag og gjentas inn i hvert rutenett,
forskjøvet etter kolonne og rad. Parametrene er bildestørrelse, rutestørrelse,
rutenettforskyvning, squeeze, kompresjon, rotasjon, tilfeldig bevegelse og fart.
Velg **Rutenett** for tett rutenett eller **Midtrad + diagonaler** for et åpnere
mønster. **Gjennomsiktig bakgrunn** fjerner bakgrunnsfargen, og gjennomsiktige
områder vises som et diskret rutemønster i forhåndsvisningen.

Alle parametrene kan animeres med keyframes eller signaler. Den tilfeldige
bevegelsen bruker animasjonens tid og «Bevegelsesfart».

### Lydstyring

`source.audio` leser en lokal lydfil eller en URL og gir fire tallutganger:
**Nivå**, **Bass**, **Mellomtone** og **Diskant**. De kan kobles til en
parameterdiamant eller til Styring, akkurat som et signal.

Analysen skjer per frame rundt animasjonens tid, så den er deterministisk.
Er lyden kortere enn animasjonen, kan den loopes. I Eksport velger du hvilket
lydspor som skal muxes inn i videoen. MP4 bruker AAC når nettleseren støtter
det, ellers prøves Opus. WebM bruker Opus eller Vorbis. Lyden tilpasses
videoens nøyaktige lengde.

### Echo

`modifier.echo` tegner de siste framesene bak det gjeldende bildet, med
valgfri forskyvning og utfading. Historikken bygges opp frame for frame under
avspilling og eksport. Hopper du i tidslinjen, starter historikken på nytt.

### Bildeverktøy

- **Beskjær / tilpass** velger dekk, pass inn eller strekk, med utsnitt, skala og forskyvning.
- **Displace** forskyver bildet med et kart. Rød kanal styrer X og grønn kanal Y; 0,5 i kartet betyr ingen forskyvning.

### Keyframe-overganger

Når du markerer en keyframe i tidslinjen, kan du velge overgangen fram til
neste keyframe: lineær, hold, myk start, myk slutt, myk start og slutt, sprett
eller elastisk. Valget gjelder fra den valgte keyframen og til neste.

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

## Hjelp

Hjelpen åpnes første gang du starter appen, og senere med **?**-knappen i
topplinjen eller tasten `?`. Den dekker komme-i-gang, begreper, arbeidsflaten,
signaler og styring, animasjon, 3D, eksport, snarveier og feilsøking.

Hjelpen inneholder eksempler som du kan laste inn i grafen med **Prøv i
grafen**, og Angre går tilbake til det du hadde. Eksemplene ligger i
`src/help/examples.ts` og valideres i `tests/examples.test.ts`.

Innholdet ligger i `src/help/content.ts`. Lenker som **Hva er dette?** i
Egenskaper og Eksport-panelet åpner riktig kapittel direkte.

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
