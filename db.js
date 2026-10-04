const { Pool } = require('pg')

let pool
let schemaReady

function getPool() {
  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not configured for authentication and payments.')
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      max: 5,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

async function ensureSchema() {
  if (schemaReady) return schemaReady
  schemaReady = getPool().query(`
    CREATE TABLE IF NOT EXISTS tp_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      phone TEXT,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verified_at TIMESTAMPTZ,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'client',
      referral_code TEXT,
      kyc_status TEXT NOT NULL DEFAULT 'Not submitted',
      linkedin_sub TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'password',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS location TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS password_salt TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'client';
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS referral_code TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'Not submitted';
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS linkedin_sub TEXT;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';
    CREATE UNIQUE INDEX IF NOT EXISTS tp_users_linkedin_sub_idx ON tp_users (linkedin_sub) WHERE linkedin_sub IS NOT NULL;
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE tp_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

    CREATE INDEX IF NOT EXISTS tp_users_email_idx ON tp_users (email);

    CREATE TABLE IF NOT EXISTS tp_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES tp_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE tp_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE tp_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE tp_sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS tp_sessions_user_idx ON tp_sessions (user_id);
    CREATE INDEX IF NOT EXISTS tp_sessions_expires_idx ON tp_sessions (expires_at);

    CREATE TABLE IF NOT EXISTS tp_payments (
      id BIGSERIAL PRIMARY KEY,
      tracking_id TEXT UNIQUE NOT NULL,
      merchant_reference TEXT NOT NULL,
      client_email TEXT NOT NULL,
      product_type TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'PENDING',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      awarded BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS tp_payments_client_email_idx ON tp_payments (client_email);

    CREATE TABLE IF NOT EXISTS tp_challenge_accounts (
      id BIGSERIAL PRIMARY KEY,
      client_email TEXT NOT NULL,
      challenge_id INTEGER NOT NULL,
      challenge_type TEXT NOT NULL,
      account_size NUMERIC NOT NULL,
      fee NUMERIC NOT NULL,
      target TEXT,
      daily NUMERIC,
      total NUMERIC,
      profit_split NUMERIC,
      payout TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      tracking_id TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS tp_challenge_accounts_client_email_idx ON tp_challenge_accounts (client_email);

    CREATE TABLE IF NOT EXISTS tp_competition_registrations (
      id BIGSERIAL PRIMARY KEY,
      client_email TEXT NOT NULL,
      competition_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (client_email, competition_key)
    );
  `).then(() => true)
  return schemaReady
}

module.exports = { getPool, ensureSchema }
