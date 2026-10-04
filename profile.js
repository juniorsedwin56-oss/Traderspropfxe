const { handlePreflight, applyCors } = require('../../_lib/cors')
const { ensureSchema, getPool, requireAuthenticatedUser, publicUser, createPasswordRecord } = require('../../_lib/auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='PATCH')return res.status(405).json({message:'Method not allowed.'})
  try{
    const row=await requireAuthenticatedUser(req),body=req.body||{}
    const name=String(body.name||'').trim(),email=String(body.email||'').trim().toLowerCase(),phone=String(body.phone||'').trim(),password=String(body.password||'')
    if(!name||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({message:'Name and a valid email are required.'})
    if(password&&password.length<8)return res.status(400).json({message:'New password must contain at least 8 characters.'})
    await ensureSchema()
    const dup=await getPool().query('SELECT id FROM tp_users WHERE email=$1 AND id<>$2 LIMIT 1',[email,row.id])
    if(dup.rowCount)return res.status(409).json({message:'That email address is already in use.'})
    if(password){const pass=await createPasswordRecord(password);await getPool().query(`UPDATE tp_users SET name=$1,email=$2,phone=$3,password_salt=$4,password_hash=$5,updated_at=now() WHERE id=$6`,[name,email,phone,pass.salt,pass.hash,row.id])}
    else await getPool().query(`UPDATE tp_users SET name=$1,email=$2,phone=$3,updated_at=now() WHERE id=$4`,[name,email,phone,row.id])
    const updated=await getPool().query('SELECT * FROM tp_users WHERE id=$1',[row.id])
    res.status(200).json({user:publicUser(updated.rows[0])})
  }catch(e){console.error('[auth/profile]',e);res.status(e.statusCode||500).json({message:e.message||'Unable to update your profile.'})}
}
