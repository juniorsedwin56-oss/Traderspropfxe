const crypto = require('crypto')
const { ensureSchema, getPool } = require('./db')

const SESSION_DAYS = 30

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

function passwordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1 }, (err, derived) => {
      if (err) reject(err)
      else resolve(derived.toString('hex'))
    })
  })
}

async function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  return { salt, hash: await passwordHash(password, salt) }
}

async function verifyPassword(password, salt, expected) {
  if (!salt || !expected || !/^[0-9a-f]{64}$/i.test(String(expected))) return false
  const actual = await passwordHash(password, salt)
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(String(expected), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    fullName: row.name,
    location: row.location || '',
    phone: row.phone || '',
    phoneVerified: !!row.phone_verified,
    phoneVerifiedAt: row.phone_verified_at || '',
    role: row.role || 'client',
    referralCode: row.referral_code || '',
    kycStatus: row.kyc_status || 'Not submitted',
    joined: row.created_at,
  }
}

async function createSession(userId) {
  await ensureSchema()
  const raw = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(raw)
  await getPool().query(
    `INSERT INTO tp_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,now()+($3 || ' days')::interval)`,
    [tokenHash, userId, SESSION_DAYS]
  )
  return raw
}

async function requireAuthenticatedUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || ''
  const cookies = String(req.headers.cookie || '').split(';').reduce((o,p) => { const i=p.indexOf('='); if(i>0)o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1).trim()); return o }, {})
  const token = String(header).replace(/^Bearer\s+/i, '').trim() || String(cookies.tp_auth_session || '').trim()
  if (!token) {
    const err = new Error('Missing authentication token.')
    err.statusCode = 401
    throw err
  }
  await ensureSchema()
  const result = await getPool().query(
    `SELECT u.* FROM tp_sessions s JOIN tp_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>now() LIMIT 1`,
    [hashToken(token)]
  )
  const row = result.rows[0]
  if (!row) {
    const err = new Error('Invalid or expired session.')
    err.statusCode = 401
    throw err
  }
  await getPool().query(`UPDATE tp_sessions SET last_seen_at=now() WHERE token_hash=$1`, [hashToken(token)])
  return row
}

module.exports = { getPool, ensureSchema, publicUser, createSession, requireAuthenticatedUser, createPasswordRecord, verifyPassword, hashToken }
