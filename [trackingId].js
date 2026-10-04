const { ensureSchema, getPool } = require('../../../../_lib/db')
const pesapal = require('../../../../_lib/pesapal')
const { awardChallengeAccount } = require('../../../../_lib/award')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed.' })
    return
  }
  try {
    const trackingId = String(req.query.trackingId || '').trim()
    if (!trackingId) {
      res.status(400).json({ message: 'A trackingId is required.' })
      return
    }

    await ensureSchema()
    const pool = getPool()
    const existing = await pool.query('SELECT * FROM tp_payments WHERE tracking_id=$1', [trackingId])
    const record = existing.rows[0]
    if (!record) {
      res.status(404).json({ message: 'Payment record not found.' })
      return
    }

    const remote = await pesapal.getTransactionStatus(trackingId)
    const statusCode = Number(remote.payment_status_description ? remote.status_code : remote.status_code)
    const description = String(remote.payment_status_description || remote.status || 'PENDING').toUpperCase()
    let normalizedStatus = 'PENDING'
    if (description.includes('COMPLETED') || statusCode === 1) normalizedStatus = 'COMPLETED'
    else if (description.includes('FAILED') || statusCode === 2) normalizedStatus = 'FAILED'
    else if (description.includes('INVALID') || statusCode === 3) normalizedStatus = 'INVALID'
    else if (description.includes('REVERSED')) normalizedStatus = 'FAILED'

    await pool.query('UPDATE tp_payments SET status=$1, updated_at=now() WHERE tracking_id=$2', [normalizedStatus, trackingId])

    let awarded = null
    if (normalizedStatus === 'COMPLETED' && record.product_type === 'challenge' && !record.awarded) {
      awarded = await awardChallengeAccount(pool, { trackingId, clientEmail: record.client_email, metadata: record.metadata })
    }

    res.status(200).json({
      status: normalizedStatus,
      paymentStatus: normalizedStatus,
      message: remote.payment_status_description || undefined,
      awarded: !!awarded,
      account: awarded || undefined,
    })
  } catch (error) {
    console.error('[v0] pesapal status error:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Unable to verify PesaPal payment status.' })
  }
}
