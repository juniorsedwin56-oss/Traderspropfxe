function applyCors(req, res) {
  const origin = String(req.headers.origin || '').trim()
  const configured = String(process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean)
  const allowed = origin === 'null' || (configured.length ? (origin && configured.includes(origin)) : (!origin || /^https:\/\/(www\.)?tradersprop\.com$/i.test(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin) || /^http:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)))

  if (origin && allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
}

function handlePreflight(req, res) {
  applyCors(req, res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

module.exports = { applyCors, handlePreflight }
