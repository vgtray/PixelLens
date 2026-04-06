# 🔍 PixelLens

> *Inspect any website. Copy any design system.*

Extension Chrome pour designers et développeurs qui inspecte n'importe quel site web en un clic : extraction des couleurs, typographies, spacings, et génération automatique d'un mini design system exportable.

## ✨ Features

### 🎯 Mode Inspection
- Hover highlight avec box model visuel (padding vert, margin orange, content bleu)
- Clic sur un élément → panel avec toutes les infos CSS
- Copie en un clic de n'importe quelle valeur

### 📊 Mode Scan
- Analyse la page entière automatiquement
- Extraction : couleurs, typographies, spacings, shadows, border-radius
- Clustering intelligent des couleurs (deltaE)
- Classification auto : Primary, Secondary, Neutrals, Background, Text

### 🎨 Design System Generator
- Génération automatique d'un design system structuré
- Tokens éditables (renommer, supprimer)
- Export multi-format :
  - **CSS Variables** — `:root { --color-primary: ... }`
  - **Tailwind Config** — `theme.extend` prêt à coller
  - **JSON Tokens** — Compatible Style Dictionary / Figma
  - **PNG Palette** — Image partageable

### 🛠️ Outils
- 📏 Mesure de distances entre éléments
- 📐 Grid overlay configurable (4/8/12/16px)
- 🎯 Floating toolbar draggable

## 🏗️ Tech Stack

| Technologie | Usage |
|---|---|
| React 19 | UI Side Panel + Popup |
| TypeScript (strict) | Type safety partout |
| Tailwind CSS v4 | Styling avec design tokens |
| Vite + CRXJS | Build + HMR Chrome Extension |
| Zustand v5 | State management |
| Chroma.js | Color manipulation + clustering |
| Phosphor Icons | Iconographie |
| Chrome Extension MV3 | Manifest V3 + Side Panel API |

## 📦 Installation

### Prérequis
- Node.js 20+
- npm 9+
- Chrome 114+ (pour la Side Panel API)

### Développement
```bash
# Cloner le repo
git clone https://github.com/vgtray/pixellens.git
cd pixellens

# Installer les dépendances
npm install

# Lancer en mode dev (avec HMR)
npm run dev
```

### Charger l'extension dans Chrome
1. Ouvrir `chrome://extensions/`
2. Activer **Mode développeur** (toggle en haut à droite)
3. Cliquer **"Charger l'extension non empaquetée"**
4. Sélectionner le dossier `dist/` du projet
5. L'icône 🔍 PixelLens apparaît dans la toolbar Chrome
6. **Important** : après chaque modification en dev, cliquer le bouton 🔄 sur la carte de l'extension dans `chrome://extensions/`

### Utilisation rapide
| Action | Comment |
|---|---|
| Toggle inspection | `Ctrl+Shift+L` (ou `Cmd+Shift+L` sur Mac) |
| Inspecter un élément | Mode Inspect activé → clic sur l'élément |
| Scanner une page | Clic "Scan" dans la floating toolbar |
| Voir le Side Panel | Se ouvre auto quand on inspecte |

## 🏛️ Architecture

```
src/
├── types/          # Types partagés (DesignSystem, Inspection, Messages)
├── lib/            # Utilitaires (colors, CSS parser, tokens, DOM, export, messaging, storage)
├── background/     # Service worker (routing messages, commands, badge)
├── popup/          # Popup compact (quick actions)
├── content/        # Content scripts injectés dans les pages
│   ├── inspector/  # ElementHighlighter, ElementSelector, DistanceMeasurer, GridOverlay
│   ├── scanner/    # PageScanner, ColorExtractor, TypographyExtractor, SpacingExtractor
│   └── ui/         # FloatingToolbar, InspectorTooltip, ContentApp (Shadow DOM)
└── sidepanel/      # Side Panel React app
    ├── views/      # InspectorView, ScanView, DesignSystemView, ExportView, HistoryView
    └── components/ # ColorSwatch, ColorPalette, TypeSpecimen, SpacingScale, BoxModelViz...
```

```
Content Script ←→ Background Service Worker ←→ Side Panel
   (DOM)              (routing, storage)         (React UI)
```

## 📋 Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev avec Hot Module Replacement |
| `npm run build` | Build production dans `dist/` |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint sur `src/` |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run test:coverage` | Tests avec couverture |

## 🚀 Build Production

```bash
npm run build
```

Le dossier `dist/` contient l'extension prête. Pour le Chrome Web Store :
```bash
cd dist && zip -r ../pixellens.zip .
```

## 🧪 Tests

```bash
npm run test           # Run une fois
npm run test -- --watch  # Watch mode
npm run test:coverage  # Avec rapport de couverture
```

## 📄 License

MIT

## 👤 Author

**Adam Hnaien** — [@vgtray](https://github.com/vgtray)
