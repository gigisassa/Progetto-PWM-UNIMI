# Progetto-PWM-UNIMI

Progetto per l'esame di Programmazione Web e Mobile del corso Sicurezza dei
Sistemi e delle Reti - Online dell'UNIMI.

PGRC è una piattaforma statica per cercare ricette, gestire un ricettario
personale, aggiungere preferiti, note private e recensioni. Usa HTML, CSS e
JavaScript senza una fase di compilazione. Le ricette provengono da TheMealDB;
utenti, sessioni e dati personali sono gestiti nel web storage del browser.

## Struttura

```text
.
├── index.html                         # Pagina iniziale
├── pages/                             # Pagine HTML per area funzionale
│   ├── auth/
│   │   ├── login/
│   │   │   └── index.html
│   │   └── register/
│   │       └── index.html
│   ├── account/
│   │   └── profilo/
│   │       └── index.html
│   └── recipes/
│       ├── ricerca/
│       │   └── index.html
│       ├── ricetta/
│       │   └── index.html
│       └── ricettario/
│           └── index.html
├── assets/
│   ├── css/
│   │   ├── base.css                   # Stili comuni a tutte le pagine
│   │   ├── home.css                   # Stili specifici della home
│   │   ├── components/
│   │   │   └── navigation.css         # Header e menu responsive condivisi
│   │   ├── layouts/
│   │   │   └── internal.css           # Layout delle pagine interne
│   │   └── pages/                     # Stili specifici, per area
│   │       ├── auth/                  # login.css, register.css
│   │       ├── account/               # profilo.css
│   │       └── recipes/               # ricerca.css, ricetta.css, ricettario.css
│   ├── js/
│   │   ├── core/
│   │   │   └── storage.js             # Accesso a localStorage/sessionStorage
│   │   ├── services/                  # Logica condivisa
│   │   │   ├── auth.js
│   │   │   ├── catalog.js
│   │   │   ├── notes.js
│   │   │   └── reviews.js
│   │   ├── components/
│   │   │   └── navigation.js          # Menu e stato di autenticazione
│   │   └── pages/                     # Script che gestiscono le singole pagine
│   │       ├── auth/                  # login.js, register.js
│   │       ├── account/               # profilo.js
│   │       └── recipes/               # search.js, ricettario.js, ricetta.js,
│   │                                  # ricetta-note.js, ricetta-recensioni.js
│   └── images/
│       ├── backgrounds/
│       │   └── sfondo_pizza.png
│       └── placeholders/
│           └── not-found.jpg
└── scripts/
    └── check_structure.py             # Verifica dei percorsi e delle dipendenze
```

## Avvio locale

Dalla radice del repository:

```sh
python3 -m http.server 8000
```

Aprire nel browser il server locale sulla porta `8000`. Il server serve
automaticamente gli `index.html` delle cartelle. La ricerca e i dettagli delle
ricette richiedono una connessione a TheMealDB. Per pubblicare il sito su un
hosting statico, usare la radice del repository come directory del sito.

## Organizzazione del codice

- `pages/` contiene esclusivamente HTML, raggruppato per funzionalità.
- `assets/css/` separa gli stili comuni, le varianti di layout e gli stili delle
  singole pagine. Caricare `base.css` e `components/navigation.css` prima degli
  stili di layout e della pagina.
- `assets/js/core/` gestisce la persistenza; `services/` contiene la logica
  riutilizzabile; `components/` contiene i comportamenti dell'interfaccia comuni;
  `pages/` collega ciascuna pagina ai servizi.
- Gli script classici sono caricati nell'ordine delle dipendenze: storage,
  servizi richiesti, script della pagina e navigazione. Nella scheda ricetta,
  `reviews.js` precede anche `ricetta-note.js`, che usa `formatDateIT`.
- I percorsi locali nei link, nei form e negli script JavaScript sono relativi
  alla pagina HTML; gli `url()` nei CSS sono relativi al foglio di stile.
- Ogni pagina interna ha il proprio `index.html`. I link usano la cartella con
  slash finale: dalla ricerca, ad esempio, `../ricetta/?id=52772#recensioni`.
  Le risorse di una pagina interna si raggiungono con `../../../assets/`.
  La ricerca aggiorna la cronologia con una query relativa alla pagina corrente.
- Gli URL completi di TheMealDB e delle immagini/video esterni identificano
  servizi su altri domini e restano completi. Tutta la navigazione locale usa
  percorsi relativi, così conserva anche una sottocartella dell'hosting.

La precedente directory `PROGETTO/` è stata sostituita dalla struttura qui
descritta. La home è `index.html`; le pagine di autenticazione sono in
`pages/auth/login/` e `pages/auth/register/`, il profilo in
`pages/account/profilo/` e le ricette nelle cartelle di `pages/recipes/`.
Le chiavi del web storage sono invariate: mantenendo la stessa origine
(protocollo, host e porta), i dati già salvati continuano a essere disponibili.

## Layout responsive

Le pagine usano larghezze e spaziature fluide, con griglie che si adattano allo
spazio disponibile anche su schermi da 320px. Fino a 768px la navigazione usa il
pulsante **Menu**: si apre con tastiera o tocco, si chiude con **Escape**, un link
o un clic esterno. Senza JavaScript, i link del menu rimangono visibili.

La scheda ricetta passa a una colonna fino a 900px; ricerca, ricettario e
preferiti riducono automaticamente il numero di colonne. Pulsanti e voci di
navigazione hanno un'altezza minima di 44px, i campi dei moduli usano caratteri
di almeno 16px e i testi lunghi vanno a capo senza allargare la pagina.

## Verifica della struttura

```sh
python3 scripts/check_structure.py
```

Il controllo usa solo la libreria standard di Python e verifica i riferimenti
locali in HTML, CSS e JavaScript e l'ordine delle dipendenze degli script.
Controlla anche che i collegamenti alle cartelle abbiano uno slash finale e
un `index.html`, e segnala i percorsi locali assoluti.
