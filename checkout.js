const { randomUUID } = require('crypto')
const { ensureSchema, getPool } = require('./db')
const pesapal = require('./pesapal')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' })
    return
  }
  try {
    const { productType, amount, currency, description, metadata, customerEmail } = req.body || {}
    const email = String(customerEmail || metadata?.customerEmail || '').trim().toLowerCase()
    const offerCode = String(metadata?.offerCode || '').trim().toUpperCase()
    const numericAmount = Number(amount)
    if (offerCode === 'NEST_7_2500') {
      if (numericAmount !== 7 || Number(metadata?.accountSize) !== 2500) {
        res.status(400).json({ message: 'Invalid NEST $7 offer details.' })
        return
      }
    }
    if (offerCode === 'NEST_BOGO') {
      await ensureSchema()
      const prior = await getPool().query('SELECT 1 FROM tp_challenge_accounts WHERE client_email=$1 LIMIT 1', [email])
      if (prior.rows.length) {
        res.status(403).json({ message: 'The NEST Buy One Get One Free offer is available to new clients only.' })
        return
      }
    }
    if (!productType || !Number.isFinite(numericAmount) || numericAmount <= 0 || !email || !email.includes('@')) {
      res.status(400).json({ message: 'A valid productType and amount are required.' })
      return
    }

    const trackingId = randomUUID()
    const merchantReference = `TP-${Date.now()}-${trackingId.slice(0, 8)}`
    const origin = process.env.PESAPAL_NOTIFICATION_URL
      ? new URL(process.env.PESAPAL_NOTIFICATION_URL).origin
      : `https://${req.headers.host}`
    const callbackUrl = `${origin}/#/pesapal-callback`
    const notificationId = String(process.env.PESAPAL_NOTIFICATION_ID || '').trim()
    if (!notificationId) {
      const error = new Error('PesaPal notification ID is not configured. Register the IPN URL and add PESAPAL_NOTIFICATION_ID.')
      error.statusCode = 503
      throw error
    }

    const order = await pesapal.submitOrder({
      id: merchantReference,
      currency: currency || 'USD',
      amount: numericAmount,
      description: description || 'TradersProp payment',
      callbackUrl,
      notificationId,
      email,
    })

    const finalTrackingId = order.order_tracking_id || trackingId

    await ensureSchema()
    await getPool().query(
      `INSERT INTO tp_payments (tracking_id, merchant_reference, client_email, product_type, amount, currency, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7)`,
      [finalTrackingId, merchantReference, email, productType, numericAmount, currency || 'USD', JSON.stringify(metadata || {})]
    )

    res.status(200).json({ redirectUrl: order.redirect_url, trackingId: finalTrackingId, merchantReference })
  } catch (error) {
    console.error('[v0] pesapal checkout error:', error)
    const statusCode = Number(error.statusCode) || 500
    res.status(statusCode).json({ message: error.message || 'Unable to start PesaPal checkout.', code: statusCode === 503 ? 'PAYMENT_CONFIGURATION' : 'PAYMENT_PROVIDER_ERROR' })
  }
}
