const { ensureSchema, getPool } = require('../../../_lib/db')
const pesapal = require('../../../_lib/pesapal')
const { awardChallengeAccount } = require('../../../_lib/award')

// PesaPal server-to-server IPN. Registered via PESAPAL_NOTIFICATION_ID and called
// directly by PesaPal, independent of whether the client's browser is still open.
module.exports = async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : { ...req.query, ...(req.body || {}) }
  const trackingId = String(params.OrderTrackingId || params.orderTrackingId || '').trim()
  const merchantReference = String(params.OrderMerchantReference || params.orderMerchantReference || '')

  try {
    if (!trackingId) throw new Error('Missing OrderTrackingId.')
    await ensureSchema()
    const pool = getPool()
    const existing = await pool.query('SELECT * FROM tp_payments WHERE tracking_id=$1', [trackingId])
    const record = existing.rows[0]

    const remote = await pesapal.getTransactionStatus(trackingId)
    const description = String(remote.payment_status_description || '').toUpperCase()
    let normalizedStatus = 'PENDING'
    if (description.includes('COMPLETED')) normalizedStatus = 'COMPLETED'
    else if (description.includes('FAILED')) normalizedStatus = 'FAILED'
    else if (description.includes('INVALID')) normalizedStatus = 'INVALID'

    if (record) {
      await pool.query('UPDATE tp_payments SET status=$1, updated_at=now() WHERE tracking_id=$2', [normalizedStatus, trackingId])
      if (normalizedStatus === 'COMPLETED' && record.product_type === 'challenge' && !record.awarded) {
        await awardChallengeAccount(pool, { trackingId, clientEmail: record.client_email, metadata: record.metadata })
      }
    }

    res.status(200).json({
      orderNotificationType: params.OrderNotificationType || params.orderNotificationType || 'IPNCHANGE',
      orderTrackingId: trackingId,
      orderMerchantReference: merchantReference,
      status: 200,
    })
  } catch (error) {
    console.error('[v0] pesapal ipn error:', error)
    res.status(200).json({
      orderNotificationType: params.OrderNotificationType || 'IPNCHANGE',
      orderTrackingId: trackingId,
      orderMerchantReference: merchantReference,
      status: 500,
    })
  }
}
