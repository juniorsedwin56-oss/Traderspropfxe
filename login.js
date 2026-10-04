const { handlePreflight, applyCors } = require('./cors')
const { ensureSchema, getPool, publicUser } = require('./auth')
const { signIn } = require('./supabase-auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'})
  try{
    const {email,password}=req.body||{},normalized=String(email||'').trim().toLowerCase()
    await ensureSchema()
    const auth = await signIn(normalized, password || '')
    const result=await getPool().query('SELECT * FROM tp_users WHERE email=$1 LIMIT 1',[normalized])
    const row=result.rows[0]
    if(!row)return res.status(404).json({message:'Your account profile is not available yet.'})
    res.status(200).json({token: auth.access_token, user:publicUser(row), refreshToken: auth.refresh_token, expiresIn: auth.expires_in})
  }catch(e){console.error('[auth/login]',e);const code=Number(e?.statusCode)||(/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500);res.status(code).json({message:e?.message||'Unable to sign in right now.'})}
}
