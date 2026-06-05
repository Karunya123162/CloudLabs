import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import AWSSandbox from '../components/sandboxes/AWSSandbox'
import GCPSandbox from '../components/sandboxes/GCPSandbox'
import styles from './Dashboard.module.css'

function Dashboard() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()

  return (
    <div className={styles.page}>
      <header className={styles.navbar}>
        <span className={styles.brand}>CloudLabs</span>
        <div className={styles.navRight}>
          {user && (
            <div className={styles.userChip}>
              <span className={styles.userAvatar}>
                {(user.username || user.email).charAt(0).toUpperCase()}
              </span>
              <span className={styles.userName}>
                {user.username || user.email.split('@')[0]}
              </span>
            </div>
          )}
          <button className={styles.themeBtn} onClick={toggle}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.heading}>
          <h1>CloudLabs SandBoxes</h1>
          <p>Launch an isolated cloud environment to practice and explore.</p>
        </div>

        <div className={styles.sandboxGrid}>
          <AWSSandbox />
          <GCPSandbox />
        </div>
      </main>
    </div>
  )
}

export default Dashboard
