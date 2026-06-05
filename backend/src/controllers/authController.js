const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('../config/db')

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' })

async function register(req, res) {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  try {
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email])
    if (exists.rows.length) return res.status(409).json({ message: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)
    const { rows } = await db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1,$2) RETURNING id, email',
      [email, hash]
    )
    const user = rows[0]
    res.status(201).json({ user, token: signToken(user) })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
}

async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  try {
    const { rows } = await db.query(
      'SELECT id, email, password_hash FROM users WHERE email=$1',
      [email]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ message: 'Invalid credentials' })

    res.json({ user: { id: user.id, email: user.email }, token: signToken(user) })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { register, login }
