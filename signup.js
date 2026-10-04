const { handlePreflight, applyCors } = require('./cors')
const crypto = require('crypto')
const { ensureSchema, getPool, publicUser } = require('./auth')
const { signUp } = require('./supabase-auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'})
  try{
    const {email,password,fullName,location,phone,referralCode}=req.body||{}
    const normalized=String(email||'').trim().toLowerCase()
    if(!/^\S+@\S+\.\S+$/.test(normalized))return res.status(400).json({message:'Enter a valid email address.'})
    if(String(password||'').length<8)return res.status(400).json({message:'Password must contain at least 8 characters.'})
    if(!String(fullName||'').trim())return res.status(400).json({message:'Full name is required.'})
    if(!String(location||'').trim())return res.status(400).json({message:'Location is required.'})
    const profile = { fullName: String(fullName).trim(), location: String(location).trim(), phone: String(phone || '').trim(), referralCode: String(referralCode || '').trim() }
    const auth = await signUp(normalized, password, profile)
    const id = auth.user?.id || crypto.randomUUID()
    let user = { rows: [{ id, email: normalized, name: profile.fullName, location: profile.location, phone: profile.phone, referral_code: profile.referralCode || null, auth_provider: 'supabase' }] }
    try {
      await ensureSchema()
      const passwordHashPlaceholder = crypto.createHash('sha256').update(`${id}:${normalized}`).digest('hex')
      user = await getPool().query(`INSERT INTO tp_users (id,email,name,location,phone,password_salt,password_hash,referral_code,auth_provider) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'supabase') ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, location=EXCLUDED.location, phone=EXCLUDED.phone, referral_code=EXCLUDED.referral_code RETURNING *`,[id,normalized,profile.fullName,profile.location,profile.phone,'supabase',passwordHashPlaceholder,profile.referralCode || null])
    } catch (profileError) {
      console.error('[v0] Supabase account created but profile sync failed:', profileError.message)
    }
    res.status(201).json({token: auth.access_token || '', user: publicUser(user.rows[0]), requiresEmailConfirmation: !auth.access_token})
  }catch(e){console.error('[auth/signup]',e);const code=Number(e?.statusCode)||(/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500);if(code===429)res.setHeader('Retry-After','300');res.status(code).json({message:e?.message||'Unable to create your account right now.',code:code===429?'EMAIL_RATE_LIMIT':'SIGNUP_ERROR'})}
}
