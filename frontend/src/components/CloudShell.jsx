import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import styles from './CloudShell.module.css'

/* ─────────────────────────────────────────
   Help content
───────────────────────────────────────── */
const HELP_GROUPS = [
  {
    title: 'S3',
    items: [
      { cmd: 'aws s3 ls',                        desc: 'List all buckets' },
      { cmd: 'aws s3 ls s3://<bucket>',           desc: 'List objects in bucket' },
      { cmd: 'aws s3 mb s3://<bucket>',           desc: 'Create bucket' },
      { cmd: 'aws s3 rb s3://<bucket>',           desc: 'Delete bucket' },
      { cmd: 'aws s3 rm s3://<bucket>/<key>',     desc: 'Delete object' },
    ],
  },
  {
    title: 'S3 API',
    items: [
      { cmd: 'aws s3api list-buckets',                            desc: 'List buckets (JSON)' },
      { cmd: 'aws s3api create-bucket --bucket <name>',           desc: 'Create bucket' },
      { cmd: 'aws s3api delete-bucket --bucket <name>',           desc: 'Delete bucket' },
      { cmd: 'aws s3api list-objects-v2 --bucket <name>',         desc: 'List objects' },
      { cmd: 'aws s3api delete-object --bucket <b> --key <k>',    desc: 'Delete object' },
      { cmd: 'aws s3api get-bucket-versioning --bucket <name>',   desc: 'Get versioning' },
      { cmd: 'aws s3api get-bucket-policy --bucket <name>',       desc: 'Get bucket policy' },
      { cmd: 'aws s3api list-object-versions --bucket <name>',    desc: 'List versions' },
    ],
  },
  {
    title: 'EC2 — Instances',
    items: [
      { cmd: 'aws ec2 describe-instances',                                            desc: 'List instances' },
      { cmd: 'aws ec2 describe-instance-status',                                      desc: 'Instance health status' },
      { cmd: 'aws ec2 run-instances --image-id <ami> --instance-type <type>',         desc: 'Launch instance' },
      { cmd: 'aws ec2 start-instances --instance-ids <id>',                           desc: 'Start instance(s)' },
      { cmd: 'aws ec2 stop-instances --instance-ids <id>',                            desc: 'Stop instance(s)' },
      { cmd: 'aws ec2 stop-instances --instance-ids <id> --hibernate',                desc: 'Hibernate instance(s)' },
      { cmd: 'aws ec2 reboot-instances --instance-ids <id>',                          desc: 'Reboot instance(s)' },
      { cmd: 'aws ec2 terminate-instances --instance-ids <id>',                       desc: 'Terminate instance(s)' },
    ],
  },
  {
    title: 'EC2 — Network & Security',
    items: [
      { cmd: 'aws ec2 describe-key-pairs',                                                              desc: 'List key pairs' },
      { cmd: 'aws ec2 create-key-pair --key-name <name>',                                              desc: 'Create key pair' },
      { cmd: 'aws ec2 delete-key-pair --key-name <name>',                                              desc: 'Delete key pair' },
      { cmd: 'aws ec2 describe-security-groups',                                                        desc: 'List security groups' },
      { cmd: 'aws ec2 create-security-group --group-name <name> --description <desc>',                 desc: 'Create security group' },
      { cmd: 'aws ec2 authorize-security-group-ingress --group-id <id> --protocol tcp --port <port> --cidr <cidr>', desc: 'Add ingress rule' },
      { cmd: 'aws ec2 delete-security-group --group-id <id>',                                          desc: 'Delete security group' },
      { cmd: 'aws ec2 describe-addresses',                                                              desc: 'List Elastic IPs' },
      { cmd: 'aws ec2 allocate-address',                                                                desc: 'Allocate Elastic IP' },
      { cmd: 'aws ec2 associate-address --instance-id <id> --allocation-id <aid>',                     desc: 'Associate Elastic IP' },
      { cmd: 'aws ec2 disassociate-address --association-id <id>',                                     desc: 'Disassociate Elastic IP' },
      { cmd: 'aws ec2 release-address --allocation-id <id>',                                           desc: 'Release Elastic IP' },
    ],
  },
  {
    title: 'EC2 — VPC & Storage',
    items: [
      { cmd: 'aws ec2 describe-vpcs',                                                         desc: 'List VPCs' },
      { cmd: 'aws ec2 create-vpc --cidr-block <cidr>',                                        desc: 'Create VPC' },
      { cmd: 'aws ec2 describe-subnets',                                                       desc: 'List subnets' },
      { cmd: 'aws ec2 describe-volumes',                                                       desc: 'List EBS volumes' },
      { cmd: 'aws ec2 create-volume --size <gb> --availability-zone <az>',                    desc: 'Create EBS volume' },
      { cmd: 'aws ec2 attach-volume --volume-id <vid> --instance-id <iid> --device /dev/sdf', desc: 'Attach volume' },
      { cmd: 'aws ec2 detach-volume --volume-id <vid>',                                        desc: 'Detach volume' },
      { cmd: 'aws ec2 delete-volume --volume-id <vid>',                                        desc: 'Delete volume' },
      { cmd: 'aws ec2 describe-images --owners self',                                          desc: 'List AMIs' },
    ],
  },
  {
    title: 'Other Services',
    items: [
      { cmd: 'aws lambda list-functions',   desc: 'List Lambda functions' },
      { cmd: 'aws iam list-users',          desc: 'List IAM users' },
      { cmd: 'aws cloudwatch list-metrics', desc: 'List CloudWatch metrics' },
      { cmd: 'aws --version',               desc: 'Show version' },
    ],
  },
  {
    title: 'Shell',
    items: [
      { cmd: 'help',  desc: 'Show this help' },
      { cmd: 'clear', desc: 'Clear terminal' },
      { cmd: 'exit',  desc: 'Close CloudShell' },
    ],
  },
]

const COMPLETIONS = [
  'aws s3 ls', 'aws s3 mb s3://', 'aws s3 rb s3://', 'aws s3 rm s3://',
  'aws s3api list-buckets', 'aws s3api create-bucket --bucket ',
  'aws s3api delete-bucket --bucket ', 'aws s3api list-objects-v2 --bucket ',
  'aws s3api delete-object --bucket ', 'aws s3api get-bucket-versioning --bucket ',
  'aws s3api put-bucket-versioning --bucket ',
  'aws s3api get-bucket-policy --bucket ', 'aws s3api list-object-versions --bucket ',
  'aws ec2 describe-instances', 'aws ec2 describe-instance-status',
  'aws ec2 run-instances --image-id ', 'aws ec2 start-instances --instance-ids ',
  'aws ec2 stop-instances --instance-ids ', 'aws ec2 reboot-instances --instance-ids ',
  'aws ec2 terminate-instances --instance-ids ',
  'aws ec2 describe-key-pairs', 'aws ec2 create-key-pair --key-name ', 'aws ec2 delete-key-pair --key-name ',
  'aws ec2 describe-security-groups', 'aws ec2 create-security-group --group-name ', 'aws ec2 delete-security-group --group-id ',
  'aws ec2 authorize-security-group-ingress --group-id ',
  'aws ec2 describe-addresses', 'aws ec2 allocate-address', 'aws ec2 associate-address --instance-id ',
  'aws ec2 disassociate-address --association-id ', 'aws ec2 release-address --allocation-id ',
  'aws ec2 describe-vpcs', 'aws ec2 create-vpc --cidr-block ', 'aws ec2 describe-subnets',
  'aws ec2 describe-images', 'aws ec2 describe-volumes', 'aws ec2 create-volume --size ',
  'aws ec2 attach-volume --volume-id ', 'aws ec2 detach-volume --volume-id ', 'aws ec2 delete-volume --volume-id ',
  'aws lambda list-functions',
  'aws iam list-users', 'aws cloudwatch list-metrics', 'aws --version',
  'help', 'clear', 'exit',
]

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
// Normalize a single output string into one record per visual line.
// Type is preserved for all sub-lines.
function toLineRecords(type, text) {
  if (type === 'help') return [{ type: 'help', text: '' }]
  const raw = text ?? ''
  const parts = raw.split('\n')
  // drop a single trailing empty string that split() adds
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts.map(t => ({ type, text: t }))
}

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */
const BOOT_MSGS = [
  { text: 'Connecting to CloudShell…',          delay: 0    },
  { text: 'Authenticating session…',             delay: 500  },
  { text: 'Starting environment in us-east-1…', delay: 950  },
  { text: 'Attaching storage…',                 delay: 1350 },
  { text: 'Environment ready.',                 delay: 1700 },
]

const EXIT_MSGS = [
  { text: 'Saving session state…', delay: 0   },
  { text: 'Closing connections…',  delay: 500 },
  { text: 'Disconnected.',         delay: 1000 },
]

export default function CloudShell({ onClose }) {
  const [connecting,  setConnecting]  = useState(true)
  const [exiting,     setExiting]     = useState(false)
  const [bootLines,   setBootLines]   = useState([])
  const [exitLines,   setExitLines]   = useState([])
  const [lines,       setLines]       = useState([])
  const [input,       setInput]       = useState('')
  const [history,     setHistory]     = useState([])
  const [histIdx,     setHistIdx]     = useState(-1)
  const [busy,        setBusy]        = useState(false)
  const [height,      setHeight]      = useState(320)

  const outputRef = useRef(null)
  const inputRef  = useRef(null)

  /* ── Boot sequence ── */
  useEffect(() => {
    const timers = BOOT_MSGS.map(({ text, delay }) =>
      setTimeout(() => setBootLines(prev => [...prev, text]), delay)
    )
    const done = setTimeout(() => {
      setConnecting(false)
      setLines([
        { type: 'info', text: 'CloudLabs CloudShell  ·  us-east-1' },
        { type: 'info', text: 'Type  help  for available commands.' },
        { type: 'info', text: '' },
      ])
    }, 2100)
    return () => { timers.forEach(clearTimeout); clearTimeout(done) }
  }, [])

  /* auto-focus once shell is ready */
  useEffect(() => {
    if (!connecting) inputRef.current?.focus()
  }, [connecting])

  /* scroll to bottom whenever lines change */
  useEffect(() => {
    const el = outputRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  /* ── append lines to state ── */
  const emit = (type, text) =>
    setLines(prev => [...prev, ...toLineRecords(type, text)])

  /* ── Exit with loading animation ── */
  const closeShell = () => {
    if (exiting) return
    setExiting(true)
    setInput('')
    EXIT_MSGS.forEach(({ text, delay }) =>
      setTimeout(() => setExitLines(prev => [...prev, text]), delay)
    )
    setTimeout(() => onClose(), 1900)
  }

  /* ── drag-to-resize ── */
  const startDrag = (e) => {
    e.preventDefault()
    const y0 = e.clientY
    const h0 = height
    const move = (ev) =>
      setHeight(Math.max(180, Math.min(window.innerHeight * 0.8, h0 + y0 - ev.clientY)))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  /* ── execute a command ── */
  const execute = async (raw) => {
    const cmd = raw.trim()
    if (!cmd) return

    /* echo the command */
    setLines(prev => [...prev, { type: 'cmd', text: cmd }])

    /* update history */
    setHistory(h => [cmd, ...h.filter(c => c !== cmd)].slice(0, 200))
    setHistIdx(-1)
    setInput('')

    /* built-ins */
    if (cmd === 'clear') { setLines([]); return }
    if (cmd === 'help')  { emit('help', ''); return }
    if (cmd === 'exit')  { closeShell(); return }

    /* send to backend */
    setBusy(true)
    try {
      const { data } = await api.post('/aws/cli', { command: cmd })
      if (data.output) {
        emit(data.exitCode === 0 ? 'out' : 'err', data.output)
      } else if (data.exitCode === 0) {
        emit('info', '(done)')
      }
    } catch (ex) {
      emit('err', ex.response?.data?.message ?? ex.message ?? 'Request failed')
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  /* ── keyboard handler ── */
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!busy) execute(input)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(idx)
      setInput(history[idx] ?? '')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = Math.max(histIdx - 1, -1)
      setHistIdx(idx)
      setInput(idx === -1 ? '' : (history[idx] ?? ''))
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const hits = COMPLETIONS.filter(c => c.startsWith(input))
      if (hits.length === 1) {
        setInput(hits[0])
      } else if (hits.length > 1 && input) {
        emit('info', hits.join('    '))
      }
      return
    }
    if (e.ctrlKey && e.key === 'c') {
      setLines(prev => [...prev, { type: 'cmd', text: '^C' }])
      setInput('')
      setBusy(false)
      return
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      setLines([])
    }
  }

  /* ─────────────────────────────────────────
     Render
  ───────────────────────────────────────── */
  return (
    <div className={styles.shell} style={{ height }} onMouseDown={e => e.stopPropagation()}>

      {/* resize grip */}
      <div className={styles.grip} onMouseDown={startDrag} />

      {/* ── Disconnecting / exit overlay ── */}
      {exiting && (
        <div className={styles.bootOverlay}>
          <div className={styles.bootBox}>
            <div className={styles.bootLogo}>
              <span className={styles.bootPrompt}>cloudlabs:~&nbsp;$&nbsp;</span>
              <span className={styles.bootCmd}>exit</span>
            </div>
            <div className={styles.bootLines}>
              {exitLines.map((msg, i) => {
                const isDone = i === exitLines.length - 1 && exitLines.length === EXIT_MSGS.length
                return (
                  <div key={i} className={styles.bootLine}>
                    <span className={isDone ? styles.bootIconDone : styles.bootIconSpin}>
                      {isDone ? '✓' : '⟳'}
                    </span>
                    <span>{msg}</span>
                  </div>
                )
              })}
            </div>
            <div className={styles.bootBar}>
              <div className={styles.exitBarFill} />
            </div>
          </div>
        </div>
      )}

      {/* ── Connecting overlay ── */}
      {connecting && (
        <div className={styles.bootOverlay}>
          <div className={styles.bootBox}>
            <div className={styles.bootLogo}>
              <span className={styles.bootPrompt}>cloudlabs:~&nbsp;$&nbsp;</span>
              <span className={styles.bootCmd}>cloudshell --region us-east-1</span>
            </div>
            <div className={styles.bootLines}>
              {bootLines.map((msg, i) => (
                <div key={i} className={styles.bootLine}>
                  <span className={`${styles.bootIcon} ${i === bootLines.length - 1 && bootLines.length === BOOT_MSGS.length ? styles.bootIconDone : styles.bootIconSpin}`}>
                    {i === bootLines.length - 1 && bootLines.length === BOOT_MSGS.length ? '✓' : '⟳'}
                  </span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>
            <div className={styles.bootBar}>
              <div className={styles.bootBarFill} />
            </div>
          </div>
        </div>
      )}

      {/* header + output + input — hidden during boot */}
      <div className={styles.bar} style={{ display: (connecting || exiting) ? 'none' : undefined }}>
        <div className={styles.dots}>
          <span className={styles.dot} style={{ background: '#ff5f57' }} onClick={closeShell} />
          <span className={styles.dot} style={{ background: '#febc2e' }} />
          <span className={styles.dot} style={{ background: '#28c840' }} />
        </div>
        <span className={styles.barTitle}>CloudShell — us-east-1</span>
        <div className={styles.barRight}>
          {busy && <span className={styles.spinner} />}
          <span className={styles.shortcuts}>Tab · ↑↓ · Ctrl+C · Ctrl+L</span>
          <button className={styles.closeX} onClick={closeShell}>✕</button>
        </div>
      </div>

      {/* scrollable output */}
      <div
        className={styles.output}
        ref={outputRef}
        onClick={() => inputRef.current?.focus()}
        style={{ display: (connecting || exiting) ? 'none' : undefined }}
      >
        {lines.map((line, i) => {
          /* ── help block ── */
          if (line.type === 'help') {
            return (
              <div key={i} className={styles.helpBlock}>
                <div className={styles.helpTitle}>CloudLabs CloudShell  ·  us-east-1</div>
                {HELP_GROUPS.map(g => (
                  <div key={g.title} className={styles.helpGroup}>
                    <div className={styles.helpGroupTitle}>{g.title}</div>
                    {g.items.map(item => (
                      <div key={item.cmd} className={styles.helpRow}>
                        <code className={styles.helpCmd}>{item.cmd}</code>
                        <span className={styles.helpSep}>·</span>
                        <span className={styles.helpDesc}>{item.desc}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          }

          /* ── command echo ── */
          if (line.type === 'cmd') {
            return (
              <div key={i} className={styles.row}>
                <span className={styles.ps1}>cloudlabs:~&nbsp;$&nbsp;</span>
                <span className={styles.cmdText}>{line.text}</span>
              </div>
            )
          }

          /* ── all other output types ── */
          const color =
            line.type === 'err'  ? 'var(--sh-err)'  :
            line.type === 'out'  ? 'var(--sh-out)'  :
            /* info */             'var(--sh-info)'

          return (
            <div key={i} className={styles.row}>
              <span style={{ color }}>{line.text || ' '}</span>
            </div>
          )
        })}
      </div>

      {/* pinned input row */}
      <div className={styles.inputRow} onClick={() => inputRef.current?.focus()} style={{ display: (connecting || exiting) ? 'none' : undefined }}>
        <span className={styles.ps1}>cloudlabs:~&nbsp;$&nbsp;</span>
        <input
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {busy && <span className={styles.blink}>▋</span>}
      </div>

    </div>
  )
}
