/**
 * Innholdet i hjelpevinduet. Ren data, så det er lett å holde oppdatert og å
 * teste (se tests/help.test.ts).
 */

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'steps'; items: string[] }
  | { type: 'keys'; items: Array<{ keys: string; does: string }> }
  | { type: 'tip'; text: string }
  /** Et eksempel som kan lastes inn i grafen (id i HELP_EXAMPLES). */
  | { type: 'example'; id: string }

export interface HelpTopic {
  id: string
  title: string
  summary: string
  blocks: HelpBlock[]
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'kom-i-gang',
    title: 'Kom i gang',
    summary: 'Det viktigste på et minutt.',
    blocks: [
      {
        type: 'p',
        text: 'Smudge Flow lager animasjoner ved å koble sammen noder. Hver node gjør én ting, for eksempel tegner en gradient, flytter noe eller styrer en verdi. Du bygger en graf, og appen viser resultatet i forhåndsvisningen til høyre.',
      },
      {
        type: 'steps',
        items: [
          'Se på startgrafen. Gradient og Generativ grafikk lager bildet, Lagstabel blander dem, og Viewport viser resultatet.',
          'Trykk på en node for å markere den. Egenskaper til venstre viser da innstillingene dine.',
          'Endre et tall eller en liste, og se at forhåndsvisningen oppdateres med en gang.',
          'Legg til en ny node fra Noder-fanen, eller trykk Tab i lerretet og skriv navnet.',
          'Koble en utgang til en inngang ved å dra fra den ene porten til den andre.',
          'Trykk Lagre for å ta vare på arbeidet som en fil. Åpne laster den inn igjen.',
        ],
      },
      {
        type: 'tip',
        text: 'Gjør du en feil, trykk Cmd/Ctrl + Z for å angre. Du kan angre nesten alt, også koblinger og parameterendringer.',
      },
      { type: 'example', id: 'startgraf' },
    ],
  },
  {
    id: 'begreper',
    title: 'Begreper',
    summary: 'Ordene som brukes i appen, forklart.',
    blocks: [
      {
        type: 'ul',
        items: [
          'Node: en boks som gjør én ting. Den har innganger til venstre og utganger til høyre.',
          'Port: en prikk på en node. Fargen viser hva slags verdi den tar imot eller sender.',
          'Kabel (kobling): streken mellom to porter. Den sender verdien fra utgangen til inngangen.',
          'Parameter: en innstilling på en node, for eksempel Størrelse eller Farge. Den kan ha en fast verdi, eller styres av et signal.',
          'Diamant: en parameterport. Kobler du et tall dit, styrer tallet den parameteren direkte.',
          'Signal: en kurve som beveger seg jevnt i loopen, for eksempel en sinus. Signaler lager bevegelse uten at du må tegne keyframes.',
          'Styring: en inngang på en node der et signal kan bevege flere parametere samtidig, med egen styrke.',
          'Keyframe: en verdi satt på et bestemt tidspunkt. Appen jevner ut mellom keyframes.',
          'Deaktivere: en deaktivert node kobles ikke fra. Verdien sendes forbi den, så kablene og rekkefølgen bevares. Noder uten en kompatibel inngang bidrar ikke mens de er deaktivert.',
          'Frame: ett stillbilde i animasjonen. Det er FPS frames per sekund.',
          'Loop: animasjonen går i sløyfe. Siste frame flyter over i første, slik at den ikke hopper.',
          'Lagstabel: blander flere bilder oppå hverandre, med egen modus og dekkevne per lag.',
          'Viewport: det du ser i forhåndsvisningen. Eksport: det som lagres som videofil.',
        ],
      },
    ],
  },
  {
    id: 'arbeidsflaten',
    title: 'Arbeidsflaten',
    summary: 'Hva de ulike delene av skjermen gjør.',
    blocks: [
      {
        type: 'ul',
        items: [
          'Venstre panel, Noder: alle nodetyper, sortert i kategorier. Søk øverst. Dra en node inn i lerretet, eller klikk for å legge den til.',
          'Venstre panel, Egenskaper: innstillingene til den markerte noden, styring og koblinger.',
          'Venstre panel, Blokker: ferdige kjeder du kan sette inn og gjenbruke.',
          'Lerretet i midten: grafen. Du kan zoome, flytte rundt, og dra noder dit du vil.',
          'Bunnpanelet: Timeline for avspilling og keyframes, og Eksport for å lagre videoen.',
          'Forhåndsvisningen til høyre: resultatet akkurat nå. Ser du en rød boks der, mangler en node en påkrevd inngang.',
          'Se en bestemt node: marker den og trykk P. Da vises nodens bilde og alt som ligger foran den, uten at den må kobles til Viewport. P igjen eller Escape går tilbake.',
          'Skillelinjene mellom panelene kan dras for å endre størrelse. Dobbeltklikk for å gå tilbake til standard.',
          'Lagstabel: rekkefølgen på lagene endres med pilene, eller ved å dra i ⠿ på hver rad i Egenskaper. Lag 1 er bunnen.',
        ],
      },
    ],
  },
  {
    id: 'noder-og-kabler',
    title: 'Noder og kabler',
    summary: 'Slik kobler du sammen grafen.',
    blocks: [
      {
        type: 'ul',
        items: [
          'Koble: dra fra en utgang til en inngang. Porter som ikke passer lyser ikke opp, og da kan du ikke koble dem.',
          'Bytte kobling: en vanlig inngang har bare én kabel. En ny kabel erstatter den gamle. Lagstabelen og andre lag-innganger tar imot mange.',
          'Fjerne kobling: klikk på kabelen og trykk Delete, eller bruk ✕ i Egenskaper under Koblinger.',
          'Flytte node: dra den i lerretet.',
          'Flere noder: Shift-klikk for å markere flere, og dra dem sammen. Delete fjerner alle markerte.',
          'Kopiere: Cmd/Ctrl + C, og lim inn med Cmd/Ctrl + V. Kopien havner ved musepekeren om den er over lerretet. Cmd/Ctrl + D dupliserer med en gang. Alt/Option + dra lager også en kopi der du slipper, mens originalen blir stående.',
          'Løkker: en kabel som ville sendt verdien tilbake til en node tidligere i kjeden, avvises. En graf kan forgrene seg og slå sammen igjen, men den kan ikke gå i ring.',
        ],
      },
      {
        type: 'tip',
        text: 'Fargene forteller deg hva som kan kobles: Bilde (grønn), 3D-objekt (oransje), Tall (blå), Kamera (lilla) og Lys (gul). Samme farge betyr at porten passer.',
      },
      { type: 'example', id: 'lagstabel' },
    ],
  },
  {
    id: 'signaler-og-styring',
    title: 'Signaler og styring',
    summary: 'Få noe til å bevege seg av seg selv.',
    blocks: [
      {
        type: 'p',
        text: 'Det er her appen blir kraftig. Et signal er en kurve som gjentar seg i loopen. Du kobler det til en node, og tallparametere på den noden begynner å bevege seg i takt med kurven.',
      },
      {
        type: 'steps',
        items: [
          'Legg til en Signal-node fra Signaler-kategorien.',
          'Velg Form: sinus gir jevn bevegelse, trekant gir lineær, firkant gir av og på, og støy gir tilfeldig men jevn bevegelse.',
          'Velg Hastighet. Det er antall ganger kurven gjentar seg per loop, og et heltall gir en loop som lukker seg.',
          'Dra utgangen Signal til Styring-prikken på noden du vil bevege.',
          'Marker noden. Under Styring i Egenskaper velger du hvilke parametere som skal bevege seg, eller alle styrbare.',
          'Juster Styrke. Negativ verdi snur bevegelsen. Parameteren svinger rundt verdien du har satt, innenfor sitt eget område.',
        ],
      },
      {
        type: 'ul',
        items: [
          'Flere signaler kan styre samme node. Da legges bevegelsene sammen. Ett signal kan også styre flere noder samtidig.',
          'Kobler du signalet til en diamant i stedet, styrer det bare den ene parameteren.',
          'Form «Tegnet kurve» lar deg tegne selv. Klikk i feltet for å legge til et punkt, dra for å flytte det, dobbeltklikk for å fjerne det.',
          'Matematikk regner på to tall eller signaler. Er en inngang ikke koblet til, brukes den faste verdien A eller B.',
          'Remap flytter et område til et annet, for eksempel −1…1 til 0…100. Den kan klemme til området og bruke en myk smoothstep-kurve.',
          'Verdi-velger og Bildevelger velger én av fire innganger. Indeks kan kobles til et signal, så bytter valget seg selv i loopen.',
        ],
      },
      { type: 'example', id: 'signal-styring' },
    ],
  },
  {
    id: 'animasjon',
    title: 'Animasjon og tidslinje',
    summary: 'Keyframes, FPS, lengde og avspilling.',
    blocks: [
      {
        type: 'ul',
        items: [
          'Tidslinjen nederst styrer avspillingen. Pause og Spill stopper og starter. Skyveknappen hopper til et bestemt frame.',
          'FPS er hvor mange frames som vises per sekund. Frames er hvor mange frames hele loopen har. Lengden i sekunder er Frames delt på FPS.',
          'Keyframes: velg en node, og trykk ◆ ved en parameter for å sette en verdi på dette frame. Gjør du det på flere frames, animeres parameteren mellom dem.',
          'Keyframes dobbeltklikkes for å slette. Klikk på dem for å hoppe dit.',
          'Klikk på en keyframe for å velge overgangen til neste: lineær, hold, myk start, myk slutt, myk start og slutt, sprett eller elastisk.',
          'Echo bygger etterslep av de siste framesene. Historikken bygges opp frame for frame; hopper du i tidslinjen, starter den på nytt.',
          'Loop: når den er på, starter animasjonen om igjen når den er ferdig.',
        ],
      },
      {
        type: 'tip',
        text: 'Bruk heller et signal enn mange keyframes for det som skal gå rundt i loopen. Keyframes er bedre for hendelser som skjer én gang, for eksempel at noe vokser fram.',
      },
      { type: 'example', id: 'keyframes' },
    ],
  },
  {
    id: 'bilde-video',
    title: 'Bilde og video',
    summary: 'Lokale filer, URL og innliming.',
    blocks: [
      {
        type: 'p',
        text: 'Bilde/video-noden kan bruke en fil fra maskinen eller en nettadresse. Lokale filer er tryggest, og de trenger ikke å ligge på en server.',
      },
      {
        type: 'ul',
        items: [
          'Fil: velg et bilde eller en video med filvelgeren. Filen lagres i nettleserens lokale filbank (IndexedDB), ikke inne i grafens JSON.',
          'Dra en fil rett på Bilde/video-noden for å bytte fil. Slipper du den på lerretet, lages en ny node.',
          'Lim inn et bilde med Cmd/Ctrl + V. Skjermbilder og referansebilder havner rett i grafen.',
          'URL: bruk en nettadresse når filen ligger ute. Adressen må tillate CORS, ellers virker ikke eksporten.',
          'Video samplet per frame. «Bruk videotid» følger animasjonens tid; slår du den av, brukes første frame.',
          'Beskjær / tilpass: velg dekk, pass inn eller strekk, og juster utsnitt, skala og forskyvning. Noden følger grafens format.',
          'Displace: forskyver bildet med et annet bilde som kart. Rød kanal styrer X og grønn kanal Y; 0,5 i kartet betyr ingen forskyvning.',
        ],
      },
      {
        type: 'tip',
        text: 'Prosjektfilen inneholder bare en referanse til filene. Åpner du den i en annen nettleser eller på en annen maskin, må du velge filen på nytt. Noden viser da en advarsel.',
      },
    ],
  },
  {
    id: 'tekst-fasonger',
    title: '2D-tekst og fasonger',
    summary: 'Titler og enkle grafiske elementer.',
    blocks: [
      {
        type: 'p',
        text: '2D-tekst og 2D-fasong tegner på gjennomsiktige lerret, så de kan legges oppå bilder og video i en Lagstabel. Begge følger grafens oppløsning.',
      },
      {
        type: 'ul',
        items: [
          '2D-tekst: skriv teksten, velg font, størrelse, vekt og farge. X og Y plasserer teksten; 0,5 er midten.',
          'Linjeavstand og dekkevne kan animeres med keyframes eller signaler.',
          '2D-fasong: velg rektangel, ellipse, trekant, diamant, stjerne eller polygon. Bredde og høyde er andeler av lerretet.',
          'Rotasjon, fyll, kant og kantbredde kan justeres. Polygon bruker «Kanter»; stjernen bruker «Indre radius».',
        ],
      },
      {
        type: 'tip',
        text: 'Koble en Lagstabel mellom fasongen og Viewport for å legge teksten eller formen oppå et bilde. Bruk en blendmodus for å bestemme hvordan den blandes.',
      },
    ],
  },
  {
    id: 'lyd',
    title: 'Lydstyring',
    summary: 'La musikken bevege bildet.',
    blocks: [
      {
        type: 'p',
        text: 'Lyd-noden leser en lydfil og gjør den om til fire tall: nivå, bass, mellomtone og diskant. Tallene kan styre parametere på samme måte som et signal.',
      },
      {
        type: 'steps',
        items: [
          'Legg til en Lyd-node og velg en lokal lydfil, eller lim inn en URL.',
          'Koble en av utgangene til en parameterdiamant, eller til Styring på en node.',
          'Juster Forsterkning til verdiene passer området du styrer.',
          'Er lyden kortere enn animasjonen, la «Loop lyd» stå på.',
        ],
      },
      {
        type: 'tip',
        text: 'I Eksport velger du hvilket lydspor som skal legges i videoen. MP4 bruker AAC når nettleseren støtter det, ellers Opus. WebM bruker Opus eller Vorbis. Bruk en lav analysevindu-verdi for raske slag, og en høyere verdi for jevnere bevegelse.',
      },
    ],
  },
  {
    id: 'fragmentprisme',
    title: 'Fragmentprisme',
    summary: 'Del bildet inn i et forskjøvet rutenett.',
    blocks: [
      {
        type: 'p',
        text: 'Fragmentprisme er hentet fra patternable. Det lager ett bilde av inputen og tegner det på nytt inn i hvert rutenett, forskjøvet etter kolonne og rad. Det gir et fragmentert prisme uten å bruke en maske.',
      },
      {
        type: 'ul',
        items: [
          'Word tegner hele rutenettet. Sentence tegner en midtrad, en midtkolonne og diagonale kopier.',
          'Glyphstørrelse og Rutestørrelse styrer hvor stort bildet og hvor tett rutenettet er.',
          'Gridforskyvning X/Y forskyver innholdet i hver kolonne og rad.',
          'Squeeze, Kompresjon Y og Rotasjon per rute former hver rute etter avstanden fra midten.',
          'Tilfeldig bevegelse og Bevegelsesfart animerer jitteren. Andre parametere animeres med keyframes eller signaler.',
          'Svart/hvitt gir et rent grafisk uttrykk. Gjennomsiktig bakgrunn lar mønsteret ligge over andre lag.',
        ],
      },
      {
        type: 'tip',
        text: 'Koble et bilde eller en 2D-tekst inn i Fragmentprisme, og legg resultatet i en Lagstabel. Prøv Sentence-modus for et løsere, mer redaksjonelt uttrykk.',
      },
    ],
  },
  {
    id: 'masker',
    title: 'Masker og matte',
    summary: 'Vis bare en del av et bilde.',
    blocks: [
      {
        type: 'p',
        text: 'En maske bestemmer hvor et bilde skal vises. Hvitt i masken er synlig, gjennomsiktig er skjult. Derfor virker myke kanter og gradienter naturlig.',
      },
      {
        type: 'steps',
        items: [
          'Lag en Fasongmaske, eller en Bildemaske hvis du vil bruke lysstyrke eller en farge fra et bilde.',
          'Lag en Bruk maske-node. Koble bildet til «Bilde» og masken til «Maske».',
          'Koble resultatet til en Lagstabel eller direkte til Viewport.',
          'Vil du kombinere to masker, bruk Kombiner masker med union, snitt eller fratrekk.',
        ],
      },
      {
        type: 'ul',
        items: [
          'Fasongmaske: ellipse, rektangel, trekant, lineær gradient eller radial gradient. «Myk kant» gjør overgangen jevnere.',
          'Bildemaske: lysstyrke lager maske fra hvor lyst bildet er. Farge fjerner en nøkkelfarge, for eksempel grønn skjerm.',
          'Bruk maske kan invertere masken, og har egen dekkevne.',
        ],
      },
      {
        type: 'tip',
        text: 'Bruk en lav «Myk kant» på fasongmasken for å unngå hakkete kanter. For chroma key: øk fargetoleransen litt om gangen til bakgrunnen forsvinner uten å spise av motivet.',
      },
    ],
  },
  {
    id: '3d',
    title: '3D og lagstabel',
    summary: 'Hvordan 3D-objekter blir til et bilde.',
    blocks: [
      {
        type: 'p',
        text: '3D-objekter (oransje porter) kan ikke vises direkte. De må gjennom en 3D-scene, som tegner dem til et vanlig bilde. Bildet kan så blandes med andre lag i en Lagstabel.',
      },
      {
        type: 'steps',
        items: [
          'Lag et objekt, for eksempel 3D-tekst, 3D-form eller OBJ-modell.',
          'Koble det til 3D-scene, enten direkte eller via Transform 3D for å flytte, rotere eller skalere det.',
          'Koble 3D-scenens Raster til en Lagstabel, sammen med andre lag om du vil.',
          'Koble Lagstabelen til Viewport.',
        ],
      },
      {
        type: 'tip',
        text: 'Viewporten kan bli tregere med 3D-scener. Den viser da alltid det siste ferdige bildet, og oppdateres så snart neste er klart.',
      },
      { type: 'example', id: '3d-scene' },
      { type: 'example', id: 'blob' },
    ],
  },
  {
    id: 'eksport',
    title: 'Eksport',
    summary: 'Lagre animasjonen som video.',
    blocks: [
      {
        type: 'ul',
        items: [
          'Filformat: MP4 (H.264) er mest kompatibelt. WebM (VP9) er et godt alternativ, og nettleseren velger nærmeste støttede kodek hvis den ikke kan.',
          'Bildeformat: 1:1, 16:9, 9:16 og andre. Bytter du format, beholdes den lengste siden, så oppløsningen ikke krymper.',
          'Bredde og høyde: skriv et tall og trykk Enter. Escape angrer.',
          'Eksporten kjører alle frames i full oppløsning, uansett hva forhåndsvisningen viser. Den kan ta en stund.',
          'Når eksporten er ferdig, dukker en lenke opp for å laste ned videoen.',
        ],
      },
    ],
  },
  {
    id: 'snarveier',
    title: 'Snarveier',
    summary: 'Tastatur og mus.',
    blocks: [
      {
        type: 'keys',
        items: [
          { keys: '?', does: 'Åpne eller lukk denne hjelpen.' },
          { keys: 'Tab', does: 'Legg til en node. Skriv navnet og trykk Enter.' },
          { keys: 'Delete / Backspace', does: 'Slett markerte noder og koblinger.' },
          { keys: 'Cmd/Ctrl + C', does: 'Kopier markerte noder med kablene mellom dem.' },
          { keys: 'Cmd/Ctrl + V', does: 'Lim inn kopierte noder ved musepekeren, eller et bilde fra utklippstavlen.' },
          { keys: 'Cmd/Ctrl + D', does: 'Dupliser markerte noder med en gang.' },
          { keys: 'Alt/Option + dra', does: 'Lag en kopi der du slipper, og la originalen bli stående.' },
          { keys: 'Shift + klikk', does: 'Marker flere noder.' },
          { keys: 'Cmd/Ctrl + Z', does: 'Angre.' },
          { keys: 'Cmd/Ctrl + Shift + Z', does: 'Gjør om.' },
          { keys: 'P', does: 'Forhåndsvis markert node. Trykk P igjen for å gå tilbake til Viewport.' },
          { keys: 'Escape', does: 'Lukk menyer, hjelp og søkefelt. Går også tilbake fra node-forhåndsvisning.' },
          { keys: 'Piltaster', does: 'Velg i listene i Tab-menyen. Flytt skillelinjer når de er markert.' },
          { keys: 'Dobbeltklikk', does: 'På en skillelinje: gå tilbake til standardstørrelsen. På en keyframe i tidslinjen: slett den. På et punkt i tegnet kurve: fjern det.' },
        ],
      },
    ],
  },
  {
    id: 'feilsoking',
    title: 'Feilsøking',
    summary: 'Når noe ikke virker som du forventer.',
    blocks: [
      {
        type: 'ul',
        items: [
          '«Graffen kan ikke evalueres»: en node mangler en påkrevd inngang. Se etter den røde prikken på nodekortet, og koble en kilde til den porten.',
          '«Kan ikke koble»: porten passer ikke med verdien. Sjekk fargen. Et tall kan for eksempel ikke kobles til en bildeinngang.',
          'Noe beveger seg ikke: sjekk at signalet er koblet til Styring (eller en diamant), at parameteren er valgt, og at styrken ikke er 0.',
          'Forhåndsvisningen fryser: tunge 3D-scener tar tid. Vent litt, eller reduser kvaliteten under Eksport.',
          'Eksporten virker ikke: sjekk at grafen har en Viewport eller Videoeksport som mottar bildet.',
        ],
      },
    ],
  },
]

export function findTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.id === id)
}
