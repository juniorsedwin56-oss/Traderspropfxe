// PesaPal API v3 client (OAuth token, order submission, transaction status).
// Production builds use PesaPal Live by default.
// Set PESAPAL_ENVIRONMENT=sandbox only when intentionally testing.
// Docs: https://developer.pesapal.com/how-to-integrate/api-30-json/api-reference

function baseUrl() {
  const env = String(
    process.env.PESAPAL_ENVIRONMENT ||
    process.env.PESAPAL_ENVIROMENT ||
    'live'
  ).toLowerCase().trim()

  if (env === 'sandbox' || env === 'test' || env === 'testing') {
    return 'https://cybqa.pesapal.com/pesapalv3/api'
  }

  return 'https://pay.pesapal.com/v3/api'
}

let cachedToken = null
let cachedTokenExpiry = 0

async function fetchWithTimeout(url, options, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('PesaPal is taking too long to respond. Please try again.')
      timeoutError.statusCode = 504
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken
  const consumerKey = process.env.PESAPAL_CONSUMER_KEY || process.env.CONSUMER_KEY
  const consumerSecret = process.env.PESAPAL_SECRET_KEY || process.env.CONSUMER_SECRET_KEY
  if (!consumerKey || !consumerSecret) throw new Error('PesaPal credentials are not configured. Add PESAPAL_CONSUMER_KEY and PESAPAL_SECRET_KEY.')
  const res = await fetchWithTimeout(`${baseUrl()}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.token) {
    throw new Error(data?.error?.message || data?.message || 'Unable to authenticate with PesaPal.')
  }
  cachedToken = data.token
  // PesaPal tokens are valid for a short window; refresh a little early.
  cachedTokenExpiry = Date.now() + 4 * 60 * 1000
  return cachedToken
}

async function submitOrder({ id, currency, amount, description, callbackUrl, notificationId, email, phone, firstName, lastName }) {
  const token = await getAccessToken()
  const res = await fetchWithTimeout(`${baseUrl()}/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id,
      currency,
      amount,
      description,
      callback_url: callbackUrl,
      notification_id: notificationId,
      billing_address: {
        email_address: email || '',
        phone_number: phone || '',
        first_name: firstName || '',
        last_name: lastName || '',
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    const upstreamMessage = typeof data?.error === 'string' ? data.error : data?.error?.message
    const message = upstreamMessage || data?.message || data?.error_description
    const error = new Error(message || `PesaPal rejected the order (HTTP ${res.status}). Check the notification ID and callback URL configuration.`)
    error.statusCode = res.status >= 400 && res.status < 500 ? 502 : 503
    throw error
  }
  if (!data?.redirect_url && !data?.redirectUrl) {
    const error = new Error('PesaPal accepted the request but did not return a checkout URL.')
    error.statusCode = 502
    throw error
  }
  return data
}

async function getTransactionStatus(orderTrackingId) {
  const token = await getAccessToken()
  const res = await fetch(`${baseUrl()}/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || data?.message || 'Unable to retrieve PesaPal transaction status.')
  }
  return data
}

module.exports = { getAccessToken, submitOrder, getTransactionStatus }
