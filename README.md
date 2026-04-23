<div align="center">

# 📈 Paper-Trade

**Visualisation crypto & marchés — classifiée, temps réel, élégante.**
_Un terrain de jeu pour trader sans risque, suivre ses thèses et comprendre le marché en un coup d'œil._

![status](https://img.shields.io/badge/status-WIP-orange)
![stack](https://img.shields.io/badge/stack-Nuxt%203-00DC82?logo=nuxtdotjs&logoColor=white)
![lang](https://img.shields.io/badge/lang-TypeScript-3178C6?logo=typescript&logoColor=white)
![style](https://img.shields.io/badge/style-SCSS-CC6699?logo=sass&logoColor=white)
![data](https://img.shields.io/badge/data-CoinGecko%20%7C%20Binance%20WS-F7931A)
![license](https://img.shields.io/badge/license-MIT-green)

</div>

---

## ✨ Vision

Paper-Trade est un **dashboard crypto auto-hébergé** qui combine trois choses qu'on ne trouve jamais vraiment ensemble :

1. **Une visualisation dense mais lisible** du marché crypto (et bientôt des actions), pensée comme une carte mentale plutôt qu'un tableur.
2. **Une classification par thèses d'investissement** (L1, DeFi, AI, Memecoins, RWA, Gaming…), parce que le marché n'est pas un gros blob — c'est une dizaine de micro-marchés qui bougent différemment.
3. **Un moteur de paper trading** pour tester ses intuitions avec des ordres fictifs, un portefeuille simulé et un historique de P&L — sans jamais toucher à un vrai wallet.

L'objectif : **regarder le marché 3 minutes par jour et comprendre ce qui s'y passe.**

---

## 🧭 Fonctionnalités

### 🔭 Visualisation

- [ ] **Heatmap par secteurs** (L1 / DeFi / AI / Memes / Gaming / RWA / Stablecoins…) avec perf 24h / 7j / 30j
- [ ] **Graph principal TradingView-like** (Lightweight Charts) avec overlays (MA, RSI, volume)
- [ ] **Vue "bubble chart"** : taille = marketcap, couleur = perf, cluster = catégorie
- [ ] **Corrélations inter-catégories** (matrice + graphe de forces)
- [ ] **Top movers** live (gainers, losers, volume spikes)
- [ ] **Dominance BTC / ETH / stables** sur la durée

### 🧪 Paper Trading

- [ ] **Portefeuille simulé** avec solde USDC de départ configurable
- [ ] **Ordres market & limit** sur toute paire Binance
- [ ] **Historique des trades** + **P&L réalisé / non-réalisé**
- [ ] **Journal de trade** (note, tag, screenshot du setup)
- [ ] **Stats** : winrate, R moyen, drawdown, courbe d'equity
- [ ] **Multi-portefeuilles** (test de stratégies en parallèle)

### 🏷️ Classification

Les actifs sont taggés dans une taxonomie éditable :

| Catégorie | Exemples |
|---|---|
| **Layer 1** | BTC, ETH, SOL, AVAX, SUI |
| **Layer 2** | ARB, OP, BASE, MATIC |
| **DeFi** | UNI, AAVE, MKR, CRV, LDO |
| **AI** | FET, RNDR, TAO, WLD |
| **Gaming / Metaverse** | IMX, GALA, SAND, AXS |
| **Memecoins** | DOGE, SHIB, PEPE, WIF |
| **RWA** | ONDO, MKR, PENDLE |
| **Stablecoins** | USDT, USDC, DAI, FDUSD |
| **Infra / Oracles** | LINK, GRT, AR |

> La taxonomie vit dans `server/data/taxonomy.json` — tu peux créer tes propres catégories et watchlists.

### 🔔 À venir

- Alertes prix (webhook Discord / Telegram)
- Backtesting de stratégies simples
- Import d'un historique Binance réel (read-only) pour comparer au paper
- Mode "actions" (Yahoo Finance)

---

## 🏗️ Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| **Framework** | [Nuxt 3](https://nuxt.com) (Vue 3 + SSR) | DX excellente, server routes intégrées, parfait pour un dashboard |
| **Langage** | TypeScript strict | Sécurité, refactor serein |
| **UI** | SCSS (modules) + design system maison | Contrôle total du style, variables & mixins, zero-runtime |
| **Icônes** | [`@nuxt/icon`](https://github.com/nuxt/icon) (Iconify) | Des milliers d'icônes, tree-shaké |
| **Charts** | [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) + [ECharts](https://echarts.apache.org) | TradingView-like pour les bougies, ECharts pour heatmaps & bubbles |
| **State** | [Pinia](https://pinia.vuejs.org) | Store typé, SSR-friendly |
| **Data fetching** | `$fetch` + SWR via `useAsyncData` | Cache natif Nuxt |
| **Temps réel** | Binance WebSocket (`/ws/!ticker@arr`) | Flux live gratuit, sans clé |
| **Données de fond** | [CoinGecko API](https://www.coingecko.com/api) (tier gratuit) | Marketcap, catégories, metadata |
| **Persistance** | SQLite via [Drizzle ORM](https://orm.drizzle.team) | Zero-config, suffit largement pour du local |
| **Runtime** | Node 20+ | — |
| **Deploy** | Docker Compose (le projet vit dans `Docker/server/`) | Self-hosted, un `docker compose up` et c'est en ligne |

---

## 🗂️ Structure du projet

```
paper-trade/
├── app/
│   ├── assets/
│   │   └── scss/
│   │       ├── _variables.scss   # Couleurs, espacements, typo
│   │       ├── _mixins.scss      # Media queries, helpers
│   │       ├── _reset.scss       # Reset moderne
│   │       └── main.scss         # Entrée globale
│   ├── components/
│   │   ├── charts/          # CandleChart, Heatmap, BubbleMap, Correlations
│   │   ├── market/          # TokenRow, CategoryCard, TopMovers
│   │   └── trading/         # OrderForm, Positions, TradeJournal
│   ├── composables/         # useMarket, usePortfolio, useBinanceWS
│   ├── pages/
│   │   ├── index.vue        # Dashboard global
│   │   ├── market/[cat].vue # Vue par catégorie
│   │   ├── token/[id].vue   # Fiche token + chart
│   │   └── portfolio.vue    # Paper trading
│   └── stores/              # Pinia (market, portfolio, settings)
├── server/
│   ├── api/
│   │   ├── market/          # Proxy CoinGecko (rate-limit friendly)
│   │   ├── ws/binance.ts    # Bridge WebSocket
│   │   └── portfolio/       # Ordres, positions, historique
│   ├── data/
│   │   └── taxonomy.json    # Classification des actifs
│   └── db/                  # Schéma Drizzle + migrations
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── nuxt.config.ts
└── README.md
```

---

## 🚀 Démarrage rapide

### Prérequis

- **Node.js ≥ 20**
- **npm** (recommandé)
- **Docker** (optionnel, pour le mode self-hosted)

### Installation locale

```bash
# 1. Cloner / se placer dans le dossier
cd paper-trade

# 2. Installer les dépendances
npm install

# 3. Copier la config
cp .env.example .env

# 4. Lancer en dev
npm run dev
```

→ Ouvre [http://localhost:3000](http://localhost:3000)

### 🐳 Avec Docker (mode self-hosted)

Le projet est prêt à être conteneurisé. Un `Dockerfile` multi-stage compile l'app Nuxt en mode `node-server`, et le `docker-compose.yml` orchestre tout ça avec un volume persistant pour les données locales.

```bash
# Build + run en arrière-plan
docker compose up -d --build

# Suivre les logs
docker compose logs -f

# Stopper
docker compose down
```

→ App dispo sur [http://localhost:3000](http://localhost:3000)

**Ce que fait Docker Compose :**

- 🔨 Build multi-stage (deps → build → runtime minimal basé sur `node:20-alpine`)
- 💾 Volume Docker persistant pour les données locales
- 🌱 Charge automatiquement ton `.env`
- 🩺 Healthcheck HTTP sur `/` toutes les 30s
- 🔁 `restart: unless-stopped` pour qu'il redémarre avec la machine

---

## ⚙️ Configuration

Le fichier `.env` :

```env
# Port d'écoute
PORT=3000

# CoinGecko (optionnel — une clé démo augmente le rate-limit)
COINGECKO_API_KEY=

# Paper trading
INITIAL_BALANCE_USDC=10000
TRADING_FEE_BPS=10        # 0.10% de frais simulés
```

---

## 🧮 Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Lance Nuxt en mode dev avec HMR |
| `npm run build` | Build de production |
| `npm run preview` | Preview du build |
| `npm run generate` | Génère le site statique |
| `npm run typecheck` | Vérif TypeScript |

---

## 🛣️ Roadmap

- **v0.1 — MVP visualisation** : heatmap, fiche token, chart, top movers
- **v0.2 — Paper trading** : ordres market/limit, positions, P&L
- **v0.3 — Classification avancée** : taxonomie éditable, watchlists perso
- **v0.4 — Alertes** : webhooks Discord / Telegram
- **v0.5 — Backtesting** : stratégies simples sur données historiques
- **v1.0 — Polish** : thèmes, exports CSV, mode mobile

---

## 🧠 Principes de design

- **Dark-first** — on regarde ça le soir, au calme.
- **Densité maîtrisée** — Bloomberg, pas MetaMask.
- **Pas de pub, pas de tracking, pas de shill.** Jamais.
- **Tout est local par défaut.** Tes trades, tes notes, tes watchlists ne quittent pas ta machine.

---

## 📜 Licence

MIT — fais-en ce que tu veux.

---

<div align="center">
<sub>Built with ☕ and a healthy distrust of CT influencers.</sub>
</div>
