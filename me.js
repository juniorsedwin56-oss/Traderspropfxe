const { handlePreflight, applyCors } = require('./cors')
const { requireAuthenticatedUser, publicUser } = require('./auth')
module.exports = async function handler(req,res){
  if (handlePreflight(req,res)) return
  applyCors(req,res)
  if(req.method!=='GET')return res.status(405).json({message:'Method not allowed.'})
  try{const row=await requireAuthenticatedUser(req);res.status(200).json({user:publicUser(row)})}
  catch(e){res.status(e.statusCode||401).json({message:e.message||'Not authenticated.'})}
}
