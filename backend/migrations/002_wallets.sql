-- ─────────────────────────────────────────────────────────────────────────────
-- Paper-Trade · 002_wallets
-- Passage de l'ancienne table `account` (un seul compte, id = 1) à une vraie
-- table `wallet` permettant la gestion de plusieurs portefeuilles simulés.
-- Les tables `position` et `trade` sont scopées par `wallet_id`.
-- La table `account` est conservée pour permettre un rollback éventuel ; elle
-- sera retirée par la migration 003 une fois la UI multi-wallets stabilisée.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT,
  icon            TEXT,
  base_currency   TEXT NOT NULL DEFAULT 'USDC',
  initial_balance DOUBLE PRECISION NOT NULL,
  cash_balance    DOUBLE PRECISION NOT NULL,
  archived_at     TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill du wallet "legacy" depuis account.id = 1 (si déploiement existant).
-- Sur un déploiement neuf, cette insertion ne fait rien : c'est alors au
-- runtime (backend/src/server.js → ensureAtLeastOneWallet) de créer un
-- wallet par défaut au démarrage.
INSERT INTO wallet (id, name, initial_balance, cash_balance, updated_at)
SELECT 1, 'Portefeuille principal', initial_balance, cash_balance, updated_at
FROM account WHERE id = 1
ON CONFLICT (id) DO NOTHING;

-- Remet la séquence à jour pour éviter toute collision d'id.
SELECT setval('wallet_id_seq', GREATEST(1, COALESCE((SELECT MAX(id) FROM wallet), 1)));

-- ─── Scope des positions par wallet ────────────────────────────────────────
ALTER TABLE position
  ADD COLUMN IF NOT EXISTS wallet_id BIGINT REFERENCES wallet(id) ON DELETE CASCADE;

UPDATE position SET wallet_id = 1 WHERE wallet_id IS NULL;

-- Si aucune ligne n'a été mise à jour (déploiement neuf sans position), on
-- n'a pas besoin d'aller plus loin mais on applique quand même la contrainte
-- NOT NULL + la nouvelle PK composite.
ALTER TABLE position ALTER COLUMN wallet_id SET NOT NULL;
ALTER TABLE position DROP CONSTRAINT IF EXISTS position_pkey;
ALTER TABLE position ADD PRIMARY KEY (wallet_id, pair);

-- ─── Scope des trades par wallet ───────────────────────────────────────────
ALTER TABLE trade
  ADD COLUMN IF NOT EXISTS wallet_id BIGINT REFERENCES wallet(id) ON DELETE CASCADE;

UPDATE trade SET wallet_id = 1 WHERE wallet_id IS NULL;
ALTER TABLE trade ALTER COLUMN wallet_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trade_wallet_created ON trade (wallet_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_trade_wallet_pair    ON trade (wallet_id, pair);

-- ─── Log simple d'événements par wallet (audit léger) ──────────────────────
CREATE TABLE IF NOT EXISTS wallet_event (
  id         BIGSERIAL PRIMARY KEY,
  wallet_id  BIGINT NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,      -- created, updated, archived, restored, reset, hard_deleted
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_event_wallet_created
  ON wallet_event (wallet_id, created_at DESC);
