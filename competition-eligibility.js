const { requireAuthenticatedUser } = require('../../../_lib/auth')
const { ensureSchema, getPool } = require('../../../_lib/db')

const ELIGIBILITY_THRESHOLD = 5

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed.' })
    return
  }
  try {
    const user = await requireAuthenticatedUser(req)
    const email = String(user.email || '').trim().toLowerCase()
    await ensureSchema()
    const result = await getPool().query(
      `SELECT COALESCE(SUM(amount),0) AS total
       FROM tp_payments
       WHERE client_email=$1 AND status='COMPLETED' AND product_type IN ('competition_deposit','challenge')`,
      [email]
    )
    const verifiedDeposit = Number(result.rows[0]?.total || 0)
    res.status(200).json({ verifiedDeposit, eligible: verifiedDeposit >= ELIGIBILITY_THRESHOLD, threshold: ELIGIBILITY_THRESHOLD })
  } catch (error) {
    console.error('[v0] competition eligibility error:', error)
    res.status(error.statusCode || 500).json({ message: error.message || 'Unable to check competition eligibility.' })
  }
}
