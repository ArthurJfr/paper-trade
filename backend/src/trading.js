/**
 * Cœur d’exécution paper: trade au prix connu (market, limite) avec un flag
 * pour l’achat exécuté depuis un limit dont le cash a déjà été en escrow.
 */

export function createTradingEngine({
  TRADING_FEE_BPS,
  mapTradeRow,
  mapPositionRow,
  mapAccountFromWallet,
  mapWalletRow,
  getWalletById,
  httpError,
}) {
  /**
   * @param {object} client - pg client (transaction)
   * @param {number} walletId
   * @param {object} opts
   * @param {string} opts.pair
   * @param {'buy'|'sell'} opts.side
   * @param {number} opts.quantity - base
   * @param {number} opts.price
   * @param {boolean} [opts.fromEscrowBuy] - ne pas débiter le cash (limite d’achat)
   */
  async function executeTradeAtPrice(client, walletId, { pair, side, quantity, price, fromEscrowBuy = false }) {
    if (!Number.isFinite(quantity) || quantity <= 0) throw httpError(400, 'Quantité invalide')
    if (!Number.isFinite(price) || price <= 0) throw httpError(400, 'Prix invalide')

    const notional = quantity * price
    const fee = (notional * TRADING_FEE_BPS) / 10_000

    const walletRaw = await getWalletById(client, walletId)
    if (!walletRaw) throw httpError(404, 'Wallet introuvable')
    if (walletRaw.archived_at) throw httpError(422, 'Wallet archivé — trades bloqués')

    const currentPositionResult = await client.query(
      'SELECT * FROM position WHERE wallet_id = $1 AND pair = $2',
      [walletId, pair],
    )
    const current = currentPositionResult.rows[0] ?? null

    if (side === 'buy') {
      if (!fromEscrowBuy) {
        const totalCost = notional + fee
        if (Number(walletRaw.cash_balance) < totalCost - 1e-9) {
          throw httpError(422, 'Cash insuffisant')
        }
        await client.query(
          'UPDATE wallet SET cash_balance = $1, updated_at = NOW() WHERE id = $2',
          [Number(walletRaw.cash_balance) - totalCost, walletId],
        )
      }

      const prevQty = Number(current?.quantity ?? 0)
      const prevAvg = Number(current?.avg_cost ?? 0)
      const newQty = prevQty + quantity
      const newAvg = newQty > 0 ? ((prevQty * prevAvg + quantity * price) / newQty) : price

      await client.query(
        `INSERT INTO position (wallet_id, pair, quantity, avg_cost, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (wallet_id, pair)
         DO UPDATE SET quantity = EXCLUDED.quantity, avg_cost = EXCLUDED.avg_cost, updated_at = NOW()`,
        [walletId, pair, newQty, newAvg],
      )

      const tradeInsert = await client.query(
        `INSERT INTO trade (wallet_id, pair, side, quantity, price, notional, fee, realized_pnl)
         VALUES ($1, $2, 'buy', $3, $4, $5, $6, NULL)
         RETURNING *`,
        [walletId, pair, quantity, price, notional, fee],
      )

      const trade = mapTradeRow(tradeInsert.rows[0])
      const wrow = (await client.query('SELECT * FROM wallet WHERE id = $1', [walletId])).rows[0]
      const updatedWallet = mapWalletRow(wrow)
      const posRow = (await client.query(
        'SELECT * FROM position WHERE wallet_id = $1 AND pair = $2',
        [walletId, pair],
      )).rows[0]
      return { trade, account: mapAccountFromWallet(updatedWallet), position: posRow ? mapPositionRow(posRow) : null, wallet: updatedWallet }
    }

    // SELL
    const available = Number(current?.quantity ?? 0)
    if (available < quantity - 1e-12) {
      throw httpError(422, 'Position insuffisante')
    }
    const proceeds = notional - fee
    const avgCost = Number(current?.avg_cost ?? 0)
    const realizedPnl = quantity * (price - avgCost) - fee
    const remaining = available - quantity

    await client.query(
      'UPDATE wallet SET cash_balance = $1, updated_at = NOW() WHERE id = $2',
      [Number(walletRaw.cash_balance) + proceeds, walletId],
    )
    if (remaining <= 1e-12) {
      await client.query('DELETE FROM position WHERE wallet_id = $1 AND pair = $2', [walletId, pair])
    } else {
      await client.query(
        'UPDATE position SET quantity = $1, updated_at = NOW() WHERE wallet_id = $2 AND pair = $3',
        [remaining, walletId, pair],
      )
    }
    const tradeInsert = await client.query(
      `INSERT INTO trade (wallet_id, pair, side, quantity, price, notional, fee, realized_pnl)
       VALUES ($1, $2, 'sell', $3, $4, $5, $6, $7)
       RETURNING *`,
      [walletId, pair, quantity, price, notional, fee, realizedPnl],
    )
    const trade = mapTradeRow(tradeInsert.rows[0])
    const wrow = (await client.query('SELECT * FROM wallet WHERE id = $1', [walletId])).rows[0]
    const updatedWallet = mapWalletRow(wrow)
    const pr = remaining <= 1e-12
      ? null
      : (await client.query('SELECT * FROM position WHERE wallet_id = $1 AND pair = $2', [walletId, pair])).rows[0]
    return { trade, account: mapAccountFromWallet(updatedWallet), position: pr ? mapPositionRow(pr) : null, wallet: updatedWallet }
  }

  return { executeTradeAtPrice }
}
