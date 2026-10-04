const { handlePreflight, applyCors } = require('./cors')
const { getPool, publicUser } = require('./auth')
const { signIn } = require('./supabase-auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'})
  try{
    const {email,password}=req.body||{},normalized=String(email||'').trim().toLowerCase()
    const auth = await signIn(normalized, password || '')
    let row
    try {
      const profileLookup=getPool().query('SELECT * FROM tp_users WHERE id=$1 OR email=$2 LIMIT 1',[auth.user?.id, normalized])
      const result=await Promise.race([profileLookup,new Promise((_, reject)=>setTimeout(()=>reject(new Error('profile lookup timeout')),1200))])
      row=result.rows[0]
    } catch (profileError) {
      console.error('[v0] Login profile lookup failed:', profileError.message)
    }
    row ||= { id: auth.user?.id, email: auth.user?.email || normalized, name: auth.user?.user_metadata?.fullName || normalized.split('@')[0], location: auth.user?.user_metadata?.location || '', phone: auth.user?.user_metadata?.phone || '', role: 'client' }
    res.status(200).json({token: auth.access_token, user:publicUser(row), refreshToken: auth.refresh_token, expiresIn: auth.expires_in})
  }catch(e){console.error('[auth/login]',e);const code=Number(e?.statusCode)||(/POSTGRES_URL|database|connection|connect/i.test(String(e?.message||''))?503:500);res.status(code).json({message:e?.message||'Unable to sign in right now.'})}
}
