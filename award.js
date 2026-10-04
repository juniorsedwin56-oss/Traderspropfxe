// Awards challenge accounts server-side only after a payment is verified as COMPLETED.
// NEST BOGO awards a second matching account in the same transaction, and only for a client
// who had no prior challenge account when checkout was created.
async function awardChallengeAccount(pool, { trackingId, clientEmail, metadata }) {
  const meta = typeof metadata === 'string' ? JSON.parse(metadata || '{}') : metadata || {}
  const challengeId = Number(meta.challengeId) || 1
  const challengeType = String(meta.challengeType || '1-phase')
  const accountSize = Number(meta.accountSize) || 0
  const fee = Number(meta.originalAmount) || 0
  const offerCode = String(meta.offerCode || '').toUpperCase()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    if (offerCode === 'NEST_BOGO') {
      const prior = await client.query('SELECT 1 FROM tp_challenge_accounts WHERE client_email=$1 LIMIT 1 FOR UPDATE', [clientEmail])
      if (prior.rows.length) {
        await client.query('ROLLBACK')
        return null
      }
    }

    const inserted = await client.query(
      `INSERT INTO tp_challenge_accounts (client_email, challenge_id, challenge_type, account_size, fee, status, tracking_id)
       VALUES ($1,$2,$3,$4,$5,'active',$6)
       ON CONFLICT (tracking_id) DO NOTHING
       RETURNING *`,
      [clientEmail, challengeId, challengeType, accountSize, fee, trackingId]
    )

    let freeAccount = null
    if (offerCode === 'NEST_BOGO' && inserted.rows[0]) {
      freeAccount = await client.query(
        `INSERT INTO tp_challenge_accounts (client_email, challenge_id, challenge_type, account_size, fee, status, tracking_id)
         VALUES ($1,$2,$3,$4,0,'active',$5)
         ON CONFLICT (tracking_id) DO NOTHING
         RETURNING *`,
        [clientEmail, challengeId, challengeType, accountSize, `${trackingId}:FREE`]
      )
    }

    await client.query('UPDATE tp_payments SET awarded=TRUE, updated_at=now() WHERE tracking_id=$1', [trackingId])
    await client.query('COMMIT')
    return inserted.rows[0] ? { ...inserted.rows[0], freeAccount: freeAccount?.rows[0] || null } : null
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { awardChallengeAccount }
