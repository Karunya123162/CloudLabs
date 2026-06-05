import { useState } from 'react'
import styles from './Sandbox.module.css'

const SERVICES = ['Compute Engine', 'Cloud Run', 'BigQuery', 'Cloud Storage', 'Pub/Sub', 'GKE']

function GCPSandbox() {
  const [active, setActive] = useState(null)
  const [status, setStatus] = useState('idle')

  const launch = () => {
    setStatus('launching')
    setTimeout(() => setStatus('running'), 1500)
  }

  const stop = () => setStatus('stopped')
  const reset = () => { setStatus('idle'); setActive(null) }

  const cliName = active
    ? active.toLowerCase().replace(/\s+/g, '-').replace('gke', 'container')
    : ''

  return (
    <div className={`${styles.sandbox} ${styles.gcp}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⬡</span>
          <span className={styles.logoText}>Google Cloud Platform</span>
        </div>
        <span className={`${styles.badge} ${styles[status]}`}>
          {status === 'launching' ? 'Launching…' : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      <p className={styles.desc}>
        Explore and practice GCP services in an isolated sandbox environment.
      </p>

      <div className={styles.services}>
        {SERVICES.map((s) => (
          <button
            key={s}
            className={`${styles.chip} ${active === s ? styles.chipActive : ''}`}
            onClick={() => setActive(s === active ? null : s)}
          >
            {s}
          </button>
        ))}
      </div>

      {active && (
        <div className={styles.terminal}>
          <span className={styles.prompt}>$</span>
          <span className={styles.cmd}>gcloud {cliName} list</span>
        </div>
      )}

      <div className={styles.actions}>
        {status === 'idle' || status === 'stopped' ? (
          <button className={`${styles.btn} ${styles.btnStart}`} onClick={launch}>
            Launch Sandbox
          </button>
        ) : status === 'launching' ? (
          <button className={styles.btn} disabled>Launching…</button>
        ) : (
          <>
            <button className={`${styles.btn} ${styles.btnStop}`} onClick={stop}>Stop</button>
            <button className={`${styles.btn} ${styles.btnReset}`} onClick={reset}>Reset</button>
          </>
        )}
      </div>
    </div>
  )
}

export default GCPSandbox
