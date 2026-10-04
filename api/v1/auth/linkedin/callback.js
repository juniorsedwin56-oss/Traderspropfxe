const linkedinHandler = require('../../../../linkedin')

module.exports = async function handler(req, res) {
  req.query = { ...(req.query || {}), action: 'callback' }
  return linkedinHandler(req, res)
}
