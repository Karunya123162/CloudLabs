const jwt = require('jsonwebtoken')

function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'Token is not valid' })
  }
}

module.exports = auth
