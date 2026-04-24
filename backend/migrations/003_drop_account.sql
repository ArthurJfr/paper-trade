-- ─────────────────────────────────────────────────────────────────────────────
-- Paper-Trade · 003_drop_account
-- Retrait définitif de l'ancienne table `account` désormais remplacée par
-- `wallet` (cf. migration 002_wallets).
--
-- Pré-requis : la migration 002 a déjà backfillé un wallet (id = 1) à partir
-- de `account.id = 1`, et tous les trades / positions ont été scopés via
-- `wallet_id`. Il n'y a donc plus aucune lecture/écriture sur `account` dans
-- le backend (`backend/src/server.js`).
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS account;
