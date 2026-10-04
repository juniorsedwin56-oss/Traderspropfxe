const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase Auth is not configured.')
}

async function supabaseRequest(path, body, headers = {}) {
  assertConfigured()
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const rawMessage = data.error_description || data.msg || data.message || data.error || 'Supabase authentication failed.'
    const isRateLimited = response.status === 429 || /rate limit|too many|email.*sent|over_email_send_rate_limit/i.test(String(rawMessage))
    const error = new Error(isRateLimited ? 'Too many signup emails were requested. Please wait a few minutes before trying again.' : rawMessage)
    error.statusCode = isRateLimited ? 429 : response.status >= 500 ? 503 : 401
    throw error
  }
  return data
}

function signUp(email, password, data) { return supabaseRequest('/auth/v1/signup', { email, password, data }) }
function signIn(email, password) { return supabaseRequest('/auth/v1/token?grant_type=password', { email, password }) }

async function getUser(accessToken) {
  assertConfigured()
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Invalid Supabase session.')
  return data
}

module.exports = { signUp, signIn, getUser }
