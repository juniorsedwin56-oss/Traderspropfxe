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
    await ensureSchema()
    const exists=await getPool().query('SELECT id FROM tp_users WHERE email=$1 LIMIT 1',[normalized])
    if(exists.rowCount)return res.status(409).json({message:'An account with this email already exists.'})
    const auth = await signUp(normalized, password, { fullName: String(fullName).trim(), location: String(location).trim(), phone: String(phone || '').trim(), referralCode: String(referralCode || '').trim() })
    const id = auth.user?.id || crypto.randomUUID()
    const passwordHashPlaceholder = crypto.createHash('sha256').update(`${id}:${normalized}`).digest('hex')
    const user=await getPool().query(`INSERT INTO tp_users (id,email,name,location,phone,password_salt,password_hash,referral_code,auth_provider) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'supabase') RETURNING *`,[id,normalized,String(fullName).trim(),String(location).trim(),String(phone||'').trim(),'supabase',passwordHashPlaceholder,String(referralCode||'').trim()||null])
    res.status(201).json({token: auth.access_token || '', user: publicUser(user.rows[0]), requiresEmailConfirmation: !auth.access_token})
  }catch(e){console.error('[auth/signup]',e);const code=Number(e?.statusCode)||(/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500);res.status(code).json({message:e?.message||'Unable to create your account right now.'})}
}
