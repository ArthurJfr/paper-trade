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

- [x] **Heatmap** par catégories (taxonomie locale) avec perf 24h / 7j / 30j — page Marché
- [x] **Bougies (Lightweight Charts)** sur fiche paire — avec volume
- [ ] **Vue "bubble chart"** : taille = marketcap, couleur = perf, cluster = catégorie
- [ ] **Corrélations inter-catégories** (matrice + graphe de forces)
- [x] **Top movers** (gainers / losers / volume) — intégré à la page Marché
- [ ] **Dominance BTC / ETH / stables** sur la durée

### 🧪 Paper Trading (backend Express + PostgreSQL, proxy Nitro)

- [x] **Portefeuilles simulés** (solde initial configurable, archivage, restauration)
- [x] **Ordres market** et **ordres limites (GTC)** (exécution serveur, liste, annulation)
- [x] **Positions, trades** + **P&L réalisé** sur la vente (côté backend) ; fiche token / wallets
- [x] **Journal** (UI présente — fonctionnalité annotée bêta selon l’app)
- [x] **Performance** : `GET /wallets/:id/performance` — P&L réalisé agrégé, winrate (par trades sell), max drawdown sur l’**équity trade-time** (courbe fournie côté UI)
- [x] **Multi-wallets** (bascule active, duplicata, reset)
- [x] **Alertes prix** : webhooks (POST) au franchissement d’un seuil, pause / reprise, CRUD

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

### 🔔 À venir (hors périmètre actuel)

- Cibles d’alerte plus riches (ex. canaux prédéfinis Discord/Telegram) ou signatures avancées
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
| **Persistance** | [PostgreSQL](https://www.postgresql.org) (schéma via migrations SQL) | Partagé entre l’API et l’orchestrateur d’ordres / alertes |
| **API paper** | Express (backend dédié dans `paper-trade/backend/`) + routes Nitro proxy | Cohérence d’intégration, auth JWT optionnelle |
| **Runtime** | Node 20+ | — |
| **Deploy** | Docker Compose (le projet vit dans `Docker/server/`) | Self-hosted, un `docker compose up` et c'est en ligne |

---

## 🗂️ Structure du projet

```
paper-trade/
├── app/                     # Nuxt (UI)
├── server/api/              # Proxy Nitro → `BACKEND_API_URL` (wallets, ordres, alertes, market…)
├── shared/types/            # DTOs (portefeuille, ordres, performance, alertes)
├── backend/                 # API Express + moteur paper (migrations SQL, jobs)
├── .env.example, docker-compose.yml, Dockerfile
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
PAPER_TRADE_JOB_TICK_MS=3000   # intervalle d’exécution des ordres limites + alertes (backend)
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

## 🧪 Pipeline Data/ML (BTC) — commandes complètes

Cette section regroupe toutes les commandes de la chaîne data -> features -> modèle -> backtest -> notebook.

### 0) Prérequis Python

```bash
# depuis la racine du projet
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 1) Données BTC (fetch + qualité)

```bash
# Rebuild historique 12 mois (BTCUSDT 15m)
python3 tools/data/fetch_btc_klines.py \
  --symbol BTCUSDT \
  --interval 15m \
  --days 365 \
  --mode historical

# Validation qualité
python3 tools/data/validate_btc_data.py \
  --input data/clean/btcusdt_15m_clean.parquet \
  --report-out data/reports/btcusdt_15m_quality.json \
  --strict

# Mise à jour incrémentale (runs suivants)
python3 tools/data/fetch_btc_klines.py \
  --symbol BTCUSDT \
  --interval 15m \
  --days 365 \
  --mode incremental
```

### 2) Features + label

```bash
python3 tools/data/build_btc_features.py \
  --input data/clean/btcusdt_15m_clean.parquet \
  --output data/features/btcusdt_15m_features.parquet \
  --label-horizon 3 \
  --csv-debug

python3 tools/data/validate_btc_features.py \
  --input data/features/btcusdt_15m_features.parquet \
  --report-out data/reports/btcusdt_15m_features_quality.json \
  --strict
```

### 3) Baseline modèle (phase 3)

```bash
python3 tools/data/train_baseline_btc.py \
  --input data/features/btcusdt_15m_features.parquet \
  --metrics-out data/reports/btcusdt_15m_model_metrics.json \
  --predictions-out data/predictions/btcusdt_15m_test_predictions.parquet \
  --model-out data/models/btcusdt_15m_baseline.joblib \
  --random-state 42

python3 tools/data/validate_model_outputs.py \
  --metrics data/reports/btcusdt_15m_model_metrics.json \
  --predictions data/predictions/btcusdt_15m_test_predictions.parquet \
  --model data/models/btcusdt_15m_baseline.joblib \
  --strict
```

### 4) Backtest réaliste (phase 4)

```bash
python3 tools/data/run_backtest_btc.py \
  --predictions data/predictions/btcusdt_15m_test_predictions.parquet \
  --trades-out data/backtests/btcusdt_15m_trades.parquet \
  --equity-out data/backtests/btcusdt_15m_equity_curve.parquet \
  --report-out data/reports/btcusdt_15m_backtest_report.json \
  --fee-bps 10 \
  --slippage-bps 5 \
  --initial-equity 10000

python3 tools/data/validate_backtest_outputs.py \
  --report data/reports/btcusdt_15m_backtest_report.json \
  --trades data/backtests/btcusdt_15m_trades.parquet \
  --equity data/backtests/btcusdt_15m_equity_curve.parquet \
  --strict
```

### 5) Risk grid search (phase 5)

```bash
python3 tools/data/run_backtest_phase5.py \
  --predictions data/predictions/btcusdt_15m_test_predictions.parquet \
  --clean data/clean/btcusdt_15m_clean.parquet \
  --grid-results-out data/reports/btcusdt_15m_phase5_grid_results.json \
  --top-results-out data/reports/btcusdt_15m_phase5_top_configs.json \
  --best-report-out data/reports/btcusdt_15m_phase5_best_report.json \
  --best-trades-out data/backtests/btcusdt_15m_phase5_best_trades.parquet \
  --best-equity-out data/backtests/btcusdt_15m_phase5_best_equity.parquet \
  --fee-bps 10 \
  --slippage-bps 5 \
  --initial-equity 10000

python3 tools/data/validate_phase5_outputs.py \
  --grid data/reports/btcusdt_15m_phase5_grid_results.json \
  --top data/reports/btcusdt_15m_phase5_top_configs.json \
  --best-report data/reports/btcusdt_15m_phase5_best_report.json \
  --best-trades data/backtests/btcusdt_15m_phase5_best_trades.parquet \
  --best-equity data/backtests/btcusdt_15m_phase5_best_equity.parquet \
  --strict
```

### 6) MongoDB pour Notebook (candles BTC)

```bash
# Lancer MongoDB + interface mongo-express
docker compose --profile tools up -d mongo mongo-express

# Charger les candles clean dans Mongo
python3 tools/data/load_btc_to_mongo.py \
  --input data/clean/btcusdt_15m_clean.parquet \
  --mongo-uri mongodb://localhost:27017 \
  --db paper_trade_data \
  --collection btc_15m_clean
```

Accès interfaces:
- App: http://localhost:3000
- API health: http://localhost:4000/health
- Adminer (Postgres): http://localhost:8080
- Mongo Express: http://localhost:8081

### 7) Notebook CRISP-DM

```bash
# Depuis la racine du projet, avec venv actif
jupyter notebook tools/data/notebooks/btc_crisp_dm_report.ipynb
```

---

## 🛣️ Roadmap (état)

- **Visu / marché** : heatmap, fiche paire, chart bougies, top movers — **livré**
- **Paper trading** : market + limit, multi-wallets, performance (winrate, drawdown, equity), alertes webhooks — **livré** (détails = code + `backend/migrations/`)
- **Piste suivante (non livré)** : taxonomie pleinement éditable côté UI, backtesting, bubble chart, corrélations, mode actions — voir plan produit

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
