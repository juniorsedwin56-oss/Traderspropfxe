const { handlePreflight, applyCors } = require('./cors')
const { ensureSchema, getPool, hashToken } = require('./auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='POST')return res.status(405).json({message:'Method not allowed.'})
  try{const h=req.headers.authorization||'';const token=String(h).replace(/^Bearer\s+/i,'').trim();if(token){await ensureSchema();await getPool().query('DELETE FROM tp_sessions WHERE token_hash=$1',[hashToken(token)])}res.setHeader('Set-Cookie', 'tp_auth_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');res.status(200).json({ok:true})}
  catch(e){res.setHeader('Set-Cookie', 'tp_auth_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');res.status(200).json({ok:true})}
}
