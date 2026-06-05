import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import styles from './Sandbox.module.css'

const SERVICE_ACTIONS = {
  S3: [
    { label: 'List Buckets',   cmd: 'aws s3 ls',                          method: 'GET',  url: '/aws/s3/buckets' },
    { label: 'Create Bucket',  cmd: 'aws s3 mb s3://demo-bucket',         method: 'POST', url: '/aws/s3/buckets', body: () => ({ name: `demo-bucket-${Date.now()}` }) },
  ],
  EC2: [
    { label: 'Describe Instances', cmd: 'aws ec2 describe-instances',     method: 'GET',  url: '/aws/ec2/instances' },
  ],
  Lambda: [
    { label: 'List Functions',     cmd: 'aws lambda list-functions',      method: 'GET',  url: '/aws/lambda/functions' },
  ],
  IAM: [
    { label: 'List Users',         cmd: 'aws iam list-users',             method: 'GET',  url: '/aws/iam/users' },
  ],
  CloudWatch: [
    { label: 'List Metrics',       cmd: 'aws cloudwatch list-metrics',    method: 'GET',  url: '/aws/cloudwatch/metrics' },
  ],
}

const SERVICES = Object.keys(SERVICE_ACTIONS)

function AWSSandbox() {
  const [active, setActive]       = useState(null)
  const [connected, setConnected] = useState(false)
  const [busy, setBusy]           = useState(false)
  const [lines, setLines]         = useState([])
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines])

  const push = (type, text) => setLines(prev => [...prev, { type, text }])

  const connect = async () => {
    setBusy(true)
    push('cmd', 'Initializing AWS environment...')
    try {
      const { data } = await api.get('/aws/health')
      if (data.connected) {
        setConnected(true)
        push('success', `Connected  →  ${data.endpoint}`)
      } else {
        push('error', `Failed: ${data.error}`)
      }
    } catch {
      push('error', 'Backend unreachable — start the backend server first.')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = () => {
    setConnected(false)
    setActive(null)
    setLines([])
  }

  const runAction = async (action) => {
    if (busy) return
    setBusy(true)
    push('cmd', action.cmd)
    try {
      const { data } = action.method === 'GET'
        ? await api.get(action.url)
        : await api.post(action.url, action.body?.())
      push('result', JSON.stringify(data, null, 2))
    } catch (err) {
      push('error', err.response?.data?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  const navigate = useNavigate()
  const status = busy ? 'launching' : connected ? 'running' : 'idle'

  return (
    <div className={`${styles.sandbox} ${styles.aws}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>☁</span>
          <span className={styles.logoText}>Amazon Web Services</span>
        </div>
        <span className={`${styles.badge} ${styles[status]}`}>
          {busy ? 'Working…' : connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <p className={styles.desc}>
        Provision and interact with AWS cloud services in an isolated sandbox environment.
      </p>

      <div className={styles.services}>
        {SERVICES.map((s) => (
          <button
            key={s}
            className={`${styles.chip} ${active === s ? styles.chipActive : ''} ${!connected ? styles.chipDisabled : ''}`}
            onClick={() => connected && setActive(s === active ? null : s)}
          >
            {s}
          </button>
        ))}
      </div>

      {active && connected && (
        <div className={styles.actionRow}>
          {SERVICE_ACTIONS[active].map((action) => (
            <button
              key={action.label}
              className={`${styles.btn} ${styles.btnAction}`}
              onClick={() => runAction(action)}
              disabled={busy}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div className={styles.terminal}>
          <div className={styles.terminalHeader}>
            <span>Output</span>
            <button className={styles.clearBtn} onClick={() => setLines([])}>Clear</button>
          </div>
          <div className={styles.terminalBody} ref={bodyRef}>
            {lines.map((line, i) => (
              <div key={i} className={`${styles.terminalLine} ${styles['line_' + line.type]}`}>
                {line.type === 'cmd' && <span className={styles.prompt}>$ </span>}
                <pre>{line.text}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.connectRow}>
        {!connected ? (
          <button className={`${styles.btn} ${styles.btnStart}`} onClick={connect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect to AWS'}
          </button>
        ) : (
          <>
            <button className={`${styles.btn} ${styles.btnLaunchAws}`} onClick={() => navigate('/aws-portal')}>
              Launch AWS
            </button>
            <button className={`${styles.btn} ${styles.btnStop}`} onClick={disconnect}>
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AWSSandbox
