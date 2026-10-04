const crypto = require('crypto')
const { ensureSchema, getPool, createSession, publicUser } = require('./auth')
const { applyCors } = require('./cors')

const AUTH_ENDPOINT = 'https://www.linkedin.com/oauth/v2/authorization'
const TOKEN_ENDPOINT = 'https://www.linkedin.com/oauth/v2/accessToken'
const USERINFO_ENDPOINT = 'https://api.linkedin.com/v2/userinfo'
const JWKS_ENDPOINT = 'https://www.linkedin.com/oauth/openid/jwks'
const ISSUER = 'https://www.linkedin.com'
const STATE_COOKIE = 'tp_linkedin_state'
const SESSION_COOKIE = 'tp_auth_session'
const SCOPES = 'openid profile email'

function base64urlJson(value) {
  return JSON.parse(Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}
function b64url(value) { return Buffer.from(value).toString('base64url') }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
}
function parseCookies(req) {
  const out = {}
  String(req.headers.cookie || '').split(';').forEach(part => {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  })
  return out
}
function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
}
function redirectUri(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  return String(process.env.LINKEDIN_REDIRECT_URI || `${forwardedProto}://${host}/api/v1/auth/linkedin/callback`).replace(/\/$/, '')
}
function fail(res, status, message) {
  const target = String(process.env.LINKEDIN_ERROR_REDIRECT || '/#/login')
  const separator = target.includes('?') ? '&' : '?'
  res.writeHead(302, { Location: `${target}${separator}linkedin_error=${encodeURIComponent(message)}` })
  res.end()
}
async function verifyIdToken(idToken, clientId, nonce) {
  const parts = String(idToken || '').split('.')
  if (parts.length !== 3) throw new Error('Invalid LinkedIn ID token.')
  const header = base64urlJson(parts[0])
  const payload = base64urlJson(parts[1])
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported LinkedIn ID token.')
  if (payload.iss !== ISSUER || payload.aud !== clientId || Number(payload.exp || 0) <= Math.floor(Date.now() / 1000)) throw new Error('LinkedIn authentication token is invalid or expired.')
  if (!payload.sub || !safeEqual(payload.nonce, nonce)) throw new Error('LinkedIn authentication could not be verified.')
  const jwks = await fetch(JWKS_ENDPOINT).then(r => { if (!r.ok) throw new Error('Unable to load LinkedIn signing keys.'); return r.json() })
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid)
  if (!jwk) throw new Error('LinkedIn signing key not found.')
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' })
  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(`${parts[0]}.${parts[1]}`)
  verify.end()
  if (!verify.verify(key, Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'))) throw new Error('LinkedIn authentication signature is invalid.')
  return payload
}

module.exports = async function handler(req, res) {
  applyCors(req, res)
  if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed.' })
  const clientId = String(process.env.LINKEDIN_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.LINKEDIN_CLIENT_SECRET || '').trim()
  if (!clientId || !clientSecret) return fail(res, 503, 'LinkedIn sign-in is not configured yet.')

  const action = String(req.query?.action || 'login').toLowerCase()
  try {
    if (action === 'login') {
      const state = b64url(crypto.randomBytes(32))
      const nonce = b64url(crypto.randomBytes(32))
      const statePayload = `${state}.${nonce}`
      res.setHeader('Set-Cookie', cookie(STATE_COOKIE, statePayload, 600))
      const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri(req), state, scope: SCOPES, nonce })
      res.writeHead(302, { Location: `${AUTH_ENDPOINT}?${params.toString()}` })
      return res.end()
    }

    if (action !== 'callback') return res.status(400).json({ message: 'Unknown LinkedIn authentication action.' })
    const { code, state, error } = req.query || {}
    if (error) return fail(res, 400, 'LinkedIn sign-in was cancelled or denied.')
    const stateCookie = parseCookies(req)[STATE_COOKIE] || ''
    const [expectedState, nonce] = String(stateCookie).split('.')
    if (!state || !expectedState || !safeEqual(state, expectedState) || !nonce) return fail(res, 400, 'LinkedIn sign-in session expired. Please try again.')

    const tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: redirectUri(req), client_id: clientId, client_secret: clientSecret }).toString()
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.access_token || !tokenData.id_token) throw new Error('LinkedIn token exchange failed.')

    const claims = await verifyIdToken(tokenData.id_token, clientId, nonce)
    const profileResponse = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
    const profile = await profileResponse.json()
    if (!profileResponse.ok) throw new Error('Unable to retrieve your LinkedIn profile.')
    const email = String(profile.email || claims.email || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('LinkedIn did not provide an email address. Please use email/password sign-in.')
    if (profile.email_verified === false || claims.email_verified === false) throw new Error('The LinkedIn email address could not be verified.')

    await ensureSchema()
    const db = getPool()
    const existingByLinkedIn = await db.query('SELECT * FROM tp_users WHERE linkedin_sub=$1 LIMIT 1', [String(profile.sub || claims.sub)])
    let row = existingByLinkedIn.rows[0]
    if (!row) {
      const existingByEmail = await db.query('SELECT * FROM tp_users WHERE email=$1 LIMIT 1', [email])
      row = existingByEmail.rows[0]
      if (row) {
        await db.query('UPDATE tp_users SET linkedin_sub=$1, auth_provider=\'linkedin\', updated_at=now() WHERE id=$2', [String(profile.sub || claims.sub), row.id])
        row = (await db.query('SELECT * FROM tp_users WHERE id=$1', [row.id])).rows[0]
      } else {
        const id = crypto.randomUUID()
        const name = String(profile.name || claims.name || [profile.given_name, profile.family_name].filter(Boolean).join(' ') || email.split('@')[0]).trim()
        const passwordSalt = crypto.randomBytes(16).toString('hex')
        const passwordHash = crypto.randomBytes(32).toString('hex')
        const inserted = await db.query(`INSERT INTO tp_users (id,email,name,location,phone,password_salt,password_hash,referral_code,linkedin_sub,auth_provider) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'linkedin') RETURNING *`, [id, email, name, '', '', passwordSalt, passwordHash, null, String(profile.sub || claims.sub)])
        row = inserted.rows[0]
      }
    }
    const token = await createSession(row.id)
    res.setHeader('Set-Cookie', [cookie(SESSION_COOKIE, token, 30 * 24 * 60 * 60), cookie(STATE_COOKIE, '', 0)])
    const target = String(process.env.LINKEDIN_SUCCESS_REDIRECT || '/#/dashboard')
    res.writeHead(302, { Location: target })
    return res.end()
  } catch (e) {
    console.error('[auth/linkedin]', e)
    return fail(res, 500, e.message || 'Unable to sign in with LinkedIn.')
  }
}
