-- Alertes prix: webhook optionnel, déclencheur one_shot par défaut.

CREATE TABLE IF NOT EXISTS price_alert (
  id                 BIGSERIAL PRIMARY KEY,
  wallet_id          BIGINT NULL REFERENCES wallet(id) ON DELETE CASCADE,
  pair               TEXT NOT NULL,
  op                 TEXT NOT NULL CHECK (op IN ('above', 'below')),
  target_price       DOUBLE PRECISION NOT NULL,
  one_shot           BOOLEAN NOT NULL DEFAULT true,
  webhook_url        TEXT,
  last_triggered_at  TIMESTAMPTZ NULL,
  cooldown_ms        INT NOT NULL DEFAULT 60000,
  active             BOOLEAN NOT NULL DEFAULT true,
  label              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alert_active_pair
  ON price_alert (active, pair) WHERE active = true;
