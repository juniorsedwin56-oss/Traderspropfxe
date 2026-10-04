const { handlePreflight, applyCors } = require('../../_lib/cors')
const crypto = require('crypto')
const { ensureSchema, getPool, createSession, createPasswordRecord, publicUser } = require('../../_lib/auth')
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
    const id=crypto.randomUUID(), pass=await createPasswordRecord(password)
    const user=await getPool().query(`INSERT INTO tp_users (id,email,name,location,phone,password_salt,password_hash,referral_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,normalized,String(fullName).trim(),String(location).trim(),String(phone||'').trim(),pass.salt,pass.hash,String(referralCode||'').trim()||null])
    const token=await createSession(id)
    res.status(201).json({token,user:publicUser(user.rows[0])})
  }catch(e){console.error('[auth/signup]',e);const code=/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500;res.status(code).json({message:code===503?'Authentication database is temporarily unavailable. Please try again shortly.':'Unable to create your account right now.'})}
}
