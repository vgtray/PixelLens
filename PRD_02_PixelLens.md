# PixelLens — Product Requirements Document

---

## 1. Vision Produit

**PixelLens** est une extension Chrome pour designers et développeurs qui inspecte n'importe quel site web en un clic : extraction des couleurs, typographies, spacings, et génération automatique d'un mini design system exportable. C'est le Figma DevMode mais directement dans le navigateur, sur n'importe quel site.

**Tagline** : *"Inspect any website. Copy any design system."*

**Pourquoi ce projet existe** : Les devs et designers passent un temps fou à reverse-engineer les styles d'un site qu'ils aiment. Inspect Element c'est lent et bordélique. PixelLens fait le boulot en un clic — tu survoles, tu cliques, t'as tout : couleurs, fonts, spacings, border-radius, shadows, le tout organisé proprement et exportable.

---

## 2. Cible Utilisateur

| Persona | Description | Besoin principal |
|---|---|---|
| **Le dev front-end** | Intègre des maquettes, cherche l'inspi sur d'autres sites | Copier rapidement les styles CSS d'un élément |
| **Le UI/UX designer** | Fait de la veille design, analyse les concurrents | Extraire une palette / typo / spacing d'un site entier |
| **L'étudiant dev/design** | Apprend en décortiquant des sites pro | Comprendre comment un site est construit visuellement |
| **Le freelance** | Doit reproduire un style "comme ce site-là" | Générer un design system de référence rapidement |

---

## 3. Fonctionnalités Core (MVP)

### 3.1 Mode Inspection (élément par élément)

- **Activation** : Clic sur l'icône PixelLens dans la toolbar ou raccourci `Ctrl+Shift+L`
- **Hover highlight** : En mode inspection, chaque élément survolé est highlighté avec un overlay coloré (padding en vert, margin en orange, border en bleu — style Chrome DevTools mais plus propre)
- **Panneau d'info au clic** : Clic sur un élément → panneau latéral avec :
  - **Couleurs** : background, color, border-color — affichées en HEX, RGB, HSL (toggle)
  - **Typographie** : font-family, font-size, font-weight, line-height, letter-spacing
  - **Spacing** : margin et padding (visualisation box-model)
  - **Dimensions** : width, height, border-radius
  - **Effets** : box-shadow, opacity, backdrop-filter
  - **CSS brut** : Le bloc CSS complet de l'élément, copiable en un clic

### 3.2 Mode Scan (page entière)

- **Scan complet** : Analyse toute la page et extrait automatiquement :
  - **Palette de couleurs** : Toutes les couleurs utilisées, triées par fréquence, regroupées par proximité
  - **Typographies** : Toutes les font-family + leurs variantes (size, weight) utilisées
  - **Spacing scale** : Les valeurs de margin/padding les plus utilisées → détection du spacing system (4px, 8px, 16px...)
  - **Border radius** : Toutes les valeurs utilisées
  - **Shadows** : Tous les box-shadow uniques

### 3.3 Design System Generator

- **Auto-génération** : À partir du scan, PixelLens génère un mini design system structuré :
  - Palette (couleurs primaires, secondaires, neutres, accents)
  - Type scale (headings, body, small)
  - Spacing scale
  - Border radius tokens
  - Shadow tokens
- **Export** :
  - **CSS Variables** : `:root { --color-primary: #3B82F6; ... }`
  - **Tailwind config** : `theme.extend` prêt à coller
  - **JSON** : Tokens structurés pour Figma / Style Dictionary
  - **Screenshot palette** : Image PNG de la palette pour partager

### 3.4 Outils Rapides

- **Color Picker** : Pipette pour capturer n'importe quelle couleur à l'écran
- **Mesure de distances** : Clic sur 2 éléments → affichage de la distance en px entre eux
- **Grille overlay** : Afficher une grille configurable (8px, 12px, 16px) par-dessus le site pour vérifier l'alignement
- **Screenshot annoté** : Capturer un élément ou une zone avec les mesures affichées en overlay

---

## 4. Architecture Technique

### 4.1 Stack

| Couche | Technologie | Justification |
|---|---|---|
| **Extension framework** | Chrome Extension Manifest V3 | Standard actuel, requis par le Chrome Web Store |
| **UI popup/panel** | React + TypeScript | Composants réactifs pour le panneau latéral |
| **Styling** | Tailwind CSS (injecté dans shadow DOM) | Isolation CSS totale, pas de conflit avec le site inspecté |
| **Bundler** | Vite + CRXJS | Build rapide, HMR pour le dev, output Manifest V3 natif |
| **Content Script** | TypeScript vanilla | Injection dans la page, DOM traversal, getComputedStyle |
| **State management** | Zustand | Léger, simple, parfait pour une extension |
| **Color manipulation** | Chroma.js | Conversion HEX/RGB/HSL, clustering de couleurs, contraste |
| **Export** | Clipboard API + Blob | Copier en un clic, télécharger en fichier |
| **Storage** | Chrome Storage API (sync) | Sauvegarder les préférences et les scans récents |
| **Icons** | Phosphor Icons | Clean, léger, cohérent |

### 4.2 Architecture Extension Chrome (Manifest V3)

```
pixellens/
├── manifest.json                    # Manifest V3
├── src/
│   ├── background/
│   │   └── service-worker.ts        # Background script (lifecycle, messages)
│   │
│   ├── content/                     # Injecté dans chaque page
│   │   ├── index.ts                 # Entry point content script
│   │   ├── inspector/
│   │   │   ├── ElementHighlighter.ts    # Overlay hover (highlight padding/margin/border)
│   │   │   ├── ElementSelector.ts       # Click to select, capture computed styles
│   │   │   ├── DistanceMeasurer.ts      # Mesure entre 2 éléments
│   │   │   └── GridOverlay.ts           # Grille configurable
│   │   ├── scanner/
│   │   │   ├── PageScanner.ts           # Scan complet du DOM
│   │   │   ├── ColorExtractor.ts        # Extraction + clustering couleurs
│   │   │   ├── TypographyExtractor.ts   # Extraction fonts + type scale
│   │   │   ├── SpacingExtractor.ts      # Extraction spacing patterns
│   │   │   └── DesignSystemBuilder.ts   # Agrégation → design system
│   │   ├── ui/
│   │   │   ├── SidePanel.tsx            # Panneau latéral React (shadow DOM)
│   │   │   ├── InspectorTooltip.tsx     # Tooltip au hover
│   │   │   └── FloatingToolbar.tsx      # Toolbar flottante (modes, actions)
│   │   └── styles/
│   │       └── content.css              # Styles injectés (shadow DOM)
│   │
│   ├── sidepanel/                   # Side Panel API (Chrome 114+)
│   │   ├── index.html
│   │   ├── App.tsx                  # Root component
│   │   ├── views/
│   │   │   ├── InspectorView.tsx        # Vue inspection élément
│   │   │   ├── ScanView.tsx             # Vue scan page entière
│   │   │   ├── DesignSystemView.tsx     # Vue design system généré
│   │   │   ├── ExportView.tsx           # Options d'export
│   │   │   └── HistoryView.tsx          # Scans récents
│   │   ├── components/
│   │   │   ├── ColorSwatch.tsx          # Pastille couleur (click to copy)
│   │   │   ├── ColorPalette.tsx         # Grille de couleurs
│   │   │   ├── TypeSpecimen.tsx         # Preview d'une typo
│   │   │   ├── SpacingScale.tsx         # Visualisation spacing
│   │   │   ├── BoxModelViz.tsx          # Box model interactif
│   │   │   ├── CSSBlock.tsx             # Bloc de code CSS copiable
│   │   │   ├── ShadowPreview.tsx        # Preview visuelle d'un shadow
│   │   │   └── ExportButton.tsx         # Bouton export avec format picker
│   │   └── styles/
│   │       └── panel.css
│   │
│   ├── popup/                       # Popup au clic sur l'icône
│   │   ├── index.html
│   │   ├── Popup.tsx                # Quick actions + status
│   │   └── styles/
│   │       └── popup.css
│   │
│   ├── lib/
│   │   ├── colors.ts                # Utilitaires couleurs (Chroma.js wrappers)
│   │   ├── css-parser.ts            # Parse + format CSS properties
│   │   ├── design-tokens.ts         # Génération tokens (CSS vars, Tailwind, JSON)
│   │   ├── dom-utils.ts             # Helpers DOM (getComputedStyle, traversal)
│   │   ├── export.ts                # Export functions (clipboard, download)
│   │   ├── messaging.ts             # Chrome messaging wrapper (content ↔ background ↔ panel)
│   │   └── storage.ts               # Chrome storage wrapper
│   │
│   └── types/
│       ├── design-system.ts         # Types pour le design system généré
│       ├── inspection.ts            # Types pour les données d'inspection
│       └── messages.ts              # Types pour les messages inter-scripts
│
├── public/
│   ├── icons/                       # Icônes extension (16, 32, 48, 128)
│   └── logo.svg
│
├── vite.config.ts                   # Config Vite + CRXJS
├── tailwind.config.ts
└── tsconfig.json
```

### 4.3 Communication entre scripts

```
┌─────────────────────────────────────────────────────────┐
│  PAGE WEB (DOM)                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Content Script                                   │  │
│  │  ├── ElementHighlighter (overlay hover)           │  │
│  │  ├── ElementSelector (clic → getComputedStyle)    │  │
│  │  ├── PageScanner (scan complet DOM)               │  │
│  │  └── Shadow DOM UI (tooltip, toolbar flottante)   │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │ chrome.runtime.sendMessage     │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  SERVICE WORKER (Background)                            │
│  ├── Routing des messages                               │
│  ├── Chrome Storage (préférences, historique)            │
│  └── Badge icon update (mode actif/inactif)             │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │ chrome.runtime.onMessage
                          ▼
┌─────────────────────────────────────────────────────────┐
│  SIDE PANEL (React App)                                 │
│  ├── InspectorView (affiche les styles de l'élément)    │
│  ├── ScanView (affiche le scan page entière)            │
│  ├── DesignSystemView (design system généré)            │
│  └── ExportView (CSS vars, Tailwind, JSON)              │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Algorithme de Scan & Clustering

#### Extraction des couleurs
```
1. Traverser tout le DOM visible (exclure les éléments hidden/invisible)
2. Pour chaque élément : getComputedStyle → extraire :
   - color, background-color, border-color, outline-color
   - Filtrer les transparents et les "inherit"
3. Compter la fréquence de chaque couleur
4. Clustering avec Chroma.js :
   - Regrouper les couleurs proches (deltaE < 5) → une seule couleur représentative
   - Trier par fréquence décroissante
5. Classification automatique :
   - Primary : couleur d'accent la plus fréquente (hors neutres)
   - Secondary : 2ème couleur d'accent
   - Neutrals : gris/noirs/blancs (saturation < 10%)
   - Background : couleur de fond du body
   - Text : couleur de texte dominante
```

#### Extraction des typographies
```
1. Traverser les éléments textuels (h1-h6, p, span, a, li, label, button...)
2. Pour chaque élément : getComputedStyle → extraire :
   - font-family, font-size, font-weight, line-height, letter-spacing
3. Regrouper par font-family → lister les variantes (size + weight)
4. Détecter la type scale :
   - Identifier les headings (h1 → h6) et leurs tailles
   - Identifier le body text (taille la plus fréquente)
   - Identifier le small text
5. Détecter le ratio de la type scale (1.125, 1.25, 1.333, etc.)
```

#### Extraction des spacings
```
1. Traverser tous les éléments visibles
2. Extraire margin-top/right/bottom/left, padding-top/right/bottom/left
3. Arrondir aux valeurs proches (3px → 4px, 7px → 8px)
4. Compter les fréquences → identifier la base unit (4px ? 8px ?)
5. Construire la spacing scale : base × 1, 2, 3, 4, 6, 8, 12, 16...
```

---

## 5. Design UI/UX — Direction Artistique Premium

### 5.1 Philosophie Design

PixelLens doit être un outil que les designers **veulent** utiliser — donc son propre design doit être irréprochable. L'extension elle-même est une vitrine du niveau de craft qu'elle aide à atteindre.

**Références visuelles** :
- **Figma DevMode** — Panneau d'inspection propre, infos structurées
- **Arc Browser** — UI d'extension élégante, animations subtiles
- **Raycast** — Commande palette, dark mode, spotlight effects
- **ColorSlurp** — Color picker macOS, swatches élégantes

### 5.2 Side Panel — Interface Principale

Le side panel est le cœur de l'UX. Il s'ouvre via la Side Panel API de Chrome (natif, pas un popup).

#### Layout
- **Header** : Logo PixelLens + toggle mode (Inspect / Scan / Design System) avec sliding indicator animé
- **Content area** : Scrollable, contenu dépend du mode actif
- **Footer** : Quick actions (export, settings, raccourcis)

#### Mode Inspect (élément sélectionné)
- **Preview élément** : Mini screenshot de l'élément sélectionné en haut
- **Sections collapsibles** (avec animation smooth) :
  - **Colors** : Swatches rondes avec HEX, clic = copie. Toggle HEX/RGB/HSL
  - **Typography** : Font preview rendue en live avec le texte réel de l'élément
  - **Box Model** : Visualisation interactive (hover sur une zone = highlight sur la page)
  - **Effects** : Shadows rendues visuellement, blur/opacity affichés
  - **Raw CSS** : Bloc de code avec syntax highlighting, bouton "Copy all"

#### Mode Scan (page entière)
- **Progress bar** animée pendant le scan (GSAP)
- **Résultats en tabs** : Colors | Fonts | Spacing | Shadows
- **Colors tab** :
  - Grille de swatches triées par fréquence
  - Groupes auto-détectés : Primary, Secondary, Neutrals, Backgrounds
  - Chaque swatch : hover → agrandir + afficher HEX + "Click to copy"
- **Fonts tab** :
  - Chaque font-family en specimen (texte rendu dans la font)
  - Variantes listées en dessous (14px Regular, 16px Medium, 24px Bold...)
- **Spacing tab** :
  - Barres horizontales proportionnelles montrant l'échelle
  - Base unit détectée mise en avant
- **Shadows tab** :
  - Preview visuelle de chaque shadow sur une card

#### Mode Design System
- **Vue structurée** du design system généré
- **Éditable** : L'utilisateur peut renommer les tokens, supprimer des couleurs, ajuster
- **Export buttons** en haut : CSS Variables | Tailwind Config | JSON Tokens | PNG Palette

### 5.3 Overlay sur la page (Content Script)

- **Highlight hover** :
  - Padding : overlay vert semi-transparent (`rgba(34, 197, 94, 0.15)`)
  - Margin : overlay orange semi-transparent (`rgba(249, 115, 22, 0.15)`)
  - Content : overlay bleu semi-transparent (`rgba(59, 130, 246, 0.15)`)
  - Dimensions affichées dans un petit badge au coin de l'élément
  - Transition smooth à 60fps (requestAnimationFrame)

- **Floating toolbar** :
  - Petite barre flottante en bas de la page (style Figma toolbar)
  - Boutons : Inspect | Measure | Grid | Color Picker | Scan
  - Draggable, se souvient de sa position
  - Animation d'apparition : slide-up + fade-in

- **Mesure de distances** :
  - Clic élément A → clic élément B → ligne en pointillé entre les deux avec la distance en px
  - Guides visuels (lignes rouges alignées)

- **Grid overlay** :
  - Grille légère (lignes à 5% opacity) couvrant toute la page
  - Configurable : 4px, 8px, 12px, 16px
  - Toggle on/off dans la toolbar

### 5.4 Popup (clic icône extension)

- **Compact** : 320px × 400px
- **Quick status** : Mode actif, site actuel
- **Quick actions** :
  - "Start Inspect" → active le mode inspection
  - "Scan this page" → lance le scan complet
  - "Last scan" → ouvrir le dernier design system
- **Raccourcis clavier** listés
- **Settings link**

### 5.5 Palette & Typographie de l'extension

**Thème dark (défaut)** :

| Token | Valeur | Usage |
|---|---|---|
| `--panel-bg` | `#0C0C0E` | Fond principal du side panel |
| `--panel-surface` | `#161618` | Cards, sections |
| `--panel-border` | `#222225` | Bordures, séparateurs |
| `--panel-text` | `#EDEDEF` | Texte principal |
| `--panel-text-dim` | `#7E7E85` | Labels, texte secondaire |
| `--panel-accent` | `#6366F1` | Accent principal (indigo) |
| `--panel-accent-hover` | `#818CF8` | Hover accent |
| `--inspect-content` | `rgba(59, 130, 246, 0.15)` | Highlight contenu |
| `--inspect-padding` | `rgba(34, 197, 94, 0.15)` | Highlight padding |
| `--inspect-margin` | `rgba(249, 115, 22, 0.15)` | Highlight margin |
| `--success` | `#22C55E` | Copié ! Feedback |
| `--badge-bg` | `rgba(0, 0, 0, 0.85)` | Background des badges de dimension |

**Typographie** :

| Usage | Font | Weight | Taille |
|---|---|---|---|
| Titres panel | Inter | 600 (SemiBold) | 14-16px |
| Labels | Inter | 500 (Medium) | 11-12px |
| Valeurs CSS | JetBrains Mono | 400 (Regular) | 12-13px |
| Code blocks | JetBrains Mono | 400 (Regular) | 11-12px |

### 5.6 Micro-interactions & Animations

| Interaction | Animation | Détail |
|---|---|---|
| Hover sur un élément (inspect mode) | Highlight overlay fade-in | 100ms ease-out, requestAnimationFrame |
| Clic sur un élément | Pulse effect + side panel update | Ring animation sur l'élément, slide transition dans le panel |
| Copier une valeur | Toast "Copied!" + checkmark | Slide-up depuis le bas du panel, auto-dismiss 1.5s |
| Toggle mode (Inspect/Scan/DS) | Sliding indicator | Background pill qui slide smooth vers le tab actif |
| Scan en cours | Progress bar + shimmer | Gradient animé qui parcourt la barre |
| Swatch hover | Scale up + tooltip | Transform scale(1.15) + tooltip avec la valeur |
| Section collapse/expand | Height transition | Smooth height animation, chevron rotation |
| Export réussi | Confetti micro (3-4 particules) | Petite explosion de particules depuis le bouton |
| Toolbar apparition | Slide-up + fade | translateY(20px) → 0 + opacity 0 → 1 |
| Mesure distance | Ligne animée | Draw line avec dash-offset animation |

---

## 6. User Flows

### 6.1 Inspection rapide d'un élément

```
Visite un site → Ctrl+Shift+L (ou clic icône)
  → Mode Inspect activé (toolbar flottante apparaît)
    → Survole un élément (highlight padding/margin/content)
      → Clic sur l'élément
        → Side Panel s'ouvre avec toutes les infos
          → Clic sur une valeur CSS → copié dans le presse-papier
            → Toast "Copied!" → Continue à inspecter
```

### 6.2 Scan complet + export design system

```
Visite un site qu'on aime → Clic "Scan" dans la toolbar
  → Progress bar (analyse le DOM)
    → Résultats affichés dans le Side Panel
      → Browse les couleurs, fonts, spacings
        → Clic "Generate Design System"
          → Design System structuré affiché
            → Clic "Export as Tailwind Config"
              → Config copiée → Coller dans tailwind.config.ts
```

### 6.3 Mesure de distances

```
Mode Inspect actif → Clic "Measure" dans la toolbar
  → Clic sur l'élément A (highlight)
    → Clic sur l'élément B (highlight)
      → Ligne pointillée entre les deux + distance en px affichée
        → Clic ailleurs pour reset
```

---

## 7. Distribution & Déploiement

### 7.1 Chrome Web Store

- **Publication** sur le Chrome Web Store (gratuit)
- **Listing** :
  - Screenshots du side panel, de l'overlay inspect, du design system généré
  - Description orientée dev/designer
  - Tags : design, inspect, CSS, colors, typography, design system
- **Permissions requises** :
  - `activeTab` — accéder au DOM de la page active
  - `sidePanel` — ouvrir le side panel
  - `storage` — sauvegarder les préférences et scans
  - `clipboardWrite` — copier les valeurs

### 7.2 Build & Release

```
GitHub repo: vgtray/pixellens
├── Push to main → GitHub Actions
│   ├── Build (Vite + CRXJS)
│   ├── Tests (Vitest)
│   ├── Lint (ESLint + Prettier)
│   └── Package (.zip pour Chrome Web Store)
└── Release manuelle sur le Chrome Web Store (chrome.google.com/webstore/devconsole)
```

### 7.3 Landing Page (vitrine)

- **URL** : `pixellens.vgtray.fr`
- **Hébergement** : Dokploy (même VPS que les autres projets)
- **Stack** : Next.js + Tailwind + GSAP + Three.js (même standard design)
- **Contenu** :
  - Hero avec démo animée de l'extension en action
  - Features avec screenshots/vidéos
  - CTA "Add to Chrome" → lien Chrome Web Store
  - Section "Design System" montrant un exemple d'export
- **But** : Vitrine pour le portfolio, montrer le projet dans son meilleur angle

---

## 8. Roadmap

### Phase 1 — MVP (Semaine 1-2)

- Setup Vite + CRXJS + Manifest V3 + React + Tailwind
- Content script : hover highlight (padding/margin/content)
- Content script : clic → extraction getComputedStyle
- Side Panel : affichage des styles de l'élément sélectionné
- Copier une valeur au clic
- Popup basique avec quick actions
- Raccourci clavier Ctrl+Shift+L

### Phase 2 — Scan & Design System (Semaine 3)

- Page Scanner : extraction couleurs + fonts + spacings + shadows
- Clustering des couleurs (Chroma.js)
- Design System Generator
- Export CSS Variables + Tailwind Config + JSON
- Floating toolbar sur la page
- Animations et micro-interactions (toasts, transitions, hover effects)

### Phase 3 — Outils avancés & Landing (Semaine 4+)

- Color Picker (pipette)
- Mesure de distances entre éléments
- Grid overlay configurable
- Screenshot annoté
- Historique des scans (Chrome Storage)
- Landing page `pixellens.vgtray.fr` (full GSAP + Three.js)
- Publication Chrome Web Store
- Performance audit (extension < 50ms impact sur le page load)

---

## 9. Métriques de Succès

| Métrique | Objectif MVP | Objectif 3 mois |
|---|---|---|
| Installs Chrome Web Store | 10 | 200+ |
| Éléments inspectés / session | > 3 | > 5 |
| Scans de pages complètes | 5 | 50+ |
| Design systems exportés | 3 | 30+ |
| Impact performance (page load) | < 50ms | < 30ms |
| Rating Chrome Web Store | — | > 4.5/5 |

---

## 10. Risques & Mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Performance (scan DOM lourd) | Haut | Limiter la profondeur de traversée, Web Worker pour le clustering |
| Conflits CSS (injection dans la page) | Haut | Shadow DOM pour toute l'UI injectée, isolation totale |
| Sites avec CSP stricte | Moyen | Utiliser les API Chrome (scripting) plutôt que l'injection inline |
| Manifest V3 limitations | Moyen | Pas de background persistent, utiliser le service worker correctement |
| Éléments dans des iframes | Moyen | Cross-origin iframes inaccessibles — afficher un warning clair |
| Couleurs via CSS-in-JS (runtime) | Bas | getComputedStyle capture le résultat final, pas la source |

---

## 11. Décisions Prises

| Décision | Choix | Raison |
|---|---|---|
| **Framework UI** | React + Tailwind dans Shadow DOM | Isolation CSS, composants réactifs |
| **Side Panel vs Popup** | Side Panel API (Chrome 114+) | Plus d'espace, UX pro, standard moderne |
| **Bundler** | Vite + CRXJS | HMR, build rapide, output MV3 natif |
| **Distribution** | Chrome Web Store (gratuit) | Visibilité, crédibilité, facile à installer |
| **Landing page** | `pixellens.vgtray.fr` via Dokploy | Même infra que les autres projets |
| **Couleur accent** | Indigo `#6366F1` | Différencié de LinkForge (bleu), identité propre |

---

*Document généré pour le portfolio d'Adam Hnaien — Projet PixelLens*
