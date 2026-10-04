const { handlePreflight, applyCors } = require('./cors')
const { ensureSchema, getPool, createSession, verifyPassword, publicUser } = require('./auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'})
  try{
    const {email,password}=req.body||{},normalized=String(email||'').trim().toLowerCase()
    await ensureSchema()
    const result=await getPool().query('SELECT * FROM tp_users WHERE email=$1 LIMIT 1',[normalized])
    const row=result.rows[0]
    if(!row||!await verifyPassword(password||'',row.password_salt,row.password_hash))return res.status(401).json({message:'Incorrect email or password.'})
    const token=await createSession(row.id)
    res.status(200).json({token,user:publicUser(row)})
  }catch(e){console.error('[auth/login]',e);const code=/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500;res.status(code).json({message:code===503?'Authentication database is temporarily unavailable. Please try again shortly.':'Unable to sign in right now.'})}
}
