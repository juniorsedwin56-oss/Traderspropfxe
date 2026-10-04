const { randomUUID } = require('crypto')
const { ensureSchema, getPool } = require('../../../db')
const pesapal = require('../../../pesapal')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed.' })
  try {
    const { productType, amount, currency, description, metadata, customerEmail } = req.body || {}
    const email = String(customerEmail || metadata?.customerEmail || '').trim().toLowerCase()
    const numericAmount = Number(amount)
    const meta = metadata && typeof metadata === 'object' ? metadata : {}
    if (productType === 'challenge' && !meta.offerCode) {
      const baseFees = { '5000': 29, '10000': 69, '25000': 169, '50000': 279, '100000': 529 }
      const multiplier = { '1-phase': 1, '2-phase': 0.9, '3-phase': 0.8 }[String(meta.challengeType)] || 1
      const expectedAmount = Math.round((baseFees[String(meta.accountSize)] || 0) * multiplier)
      if (!expectedAmount || numericAmount !== expectedAmount) return res.status(400).json({ message: 'The challenge price is invalid. Please return to Challenges and select the account again.' })
    }
    if (!productType || !Number.isFinite(numericAmount) || numericAmount <= 0 || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'A valid productType, amount, and customer email are required.' })
    }

  const trackingId = randomUUID()
    const merchantReference = `TP-${Date.now()}-${trackingId.slice(0, 8)}`
    const configuredOrigin = process.env.PESAPAL_NOTIFICATION_URL
      ? new URL(process.env.PESAPAL_NOTIFICATION_URL).origin
      : `https://${req.headers['x-forwarded-host'] || req.headers.host}`
    const order = await pesapal.submitOrder({
      id: merchantReference,
      currency: currency || 'USD',
      amount: numericAmount,
      description: description || 'TradersProp payment',
      callbackUrl: `${configuredOrigin}/#/pesapal-callback`,
      notificationId: process.env.PESAPAL_NOTIFICATION_ID,
      email,
    })
    const finalTrackingId = order.order_tracking_id || trackingId
  setImmediate(async () => {
    try {
      await ensureSchema()
      await getPool().query(
      `INSERT INTO tp_payments (tracking_id, merchant_reference, client_email, product_type, amount, currency, status, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7)`,
      [finalTrackingId, merchantReference, email, productType, numericAmount, currency || 'USD', JSON.stringify(metadata || {})]
      )
    } catch (recordError) {
      console.error('[v0] PesaPal payment record failed after checkout was created:', recordError.message)
    }
  })
  return res.status(200).json({ redirectUrl: order.redirect_url, trackingId: finalTrackingId, merchantReference })
  } catch (error) {
  console.error('[v0] pesapal checkout error:', error)
  const status = error.statusCode || 500
  return res.status(status).json({ message: error.message || 'Unable to start PesaPal checkout.', code: status === 502 ? 'PESAPAL_CONFIGURATION_ERROR' : 'PESAPAL_CHECKOUT_ERROR' })
  }
}
