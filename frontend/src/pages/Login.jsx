import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import styles from './Login.module.css'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    // mock auth — replace with real API call once backend is running
    setTimeout(() => {
      if (form.password.length < 4) {
        setError('Password must be at least 4 characters')
        setLoading(false)
        return
      }
      const username = form.email.split('@')[0]
      login({ email: form.email, username }, 'mock-token')
      navigate('/dashboard')
    }, 600)
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>CloudLabs</h1>
        <p className={styles.subtitle}>Sign in to access your sandboxes</p>

        {error && <div className={styles.error}>{error}</div>}

        <label className={styles.label}>
          Email
          <input
            className={styles.input}
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            required
          />
        </label>

        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

export default Login
