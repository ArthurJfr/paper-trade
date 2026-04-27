-- GTC limit orders: cash escrowed on buy, validation-only on sell at creation.

CREATE TABLE IF NOT EXISTS limit_order (
  id              BIGSERIAL PRIMARY KEY,
  wallet_id       BIGINT NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
  pair            TEXT NOT NULL,
  side            TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  limit_price     DOUBLE PRECISION NOT NULL,
  quantity        DOUBLE PRECISION NOT NULL,
  notional        DOUBLE PRECISION NOT NULL,
  fee_bps         INT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('open', 'filled', 'cancelled')) DEFAULT 'open',
  escrow_cash     DOUBLE PRECISION NULL,
  filled_trade_id BIGINT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_limit_order_wallet_status
  ON limit_order (wallet_id, status);

CREATE INDEX IF NOT EXISTS idx_limit_order_status_open
  ON limit_order (id) WHERE status = 'open';

-- FK to trade (added after trade table exists) — use deferrable-safe add:
ALTER TABLE limit_order
  ADD CONSTRAINT fk_limit_order_trade
  FOREIGN KEY (filled_trade_id) REFERENCES trade(id) ON DELETE SET NULL;
