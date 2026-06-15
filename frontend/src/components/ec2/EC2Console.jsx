import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import styles from './EC2Console.module.css'

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StateBadge({ state }) {
  if (!state) return <span className={`${styles.badge} ${styles.badgeOther}`}>—</span>
  const s = state.toLowerCase()
  let cls = styles.badgeOther
  if (s === 'running')                        cls = styles.badgeRunning
  else if (s === 'stopped')                   cls = styles.badgeStopped
  else if (s === 'pending')                   cls = styles.badgePending
  else if (s === 'stopping')                  cls = styles.badgeStopping
  return <span className={`${styles.badge} ${cls}`}>{state}</span>
}

/* ─────────────────────────────────────────
   Toast
───────────────────────────────────────── */
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className={styles.toast}>{message}</div>
}

/* ─────────────────────────────────────────
   Modal wrapper
───────────────────────────────────────── */
function Modal({ title, onClose, children, onSubmit, busy, submitLabel, submitDanger }) {
  return (
    <div className={styles.modal} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className={styles.modalBody}>{children}</div>
          <div className={styles.modalFoot}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className={`${styles.btn} ${submitDanger ? styles.btnDanger : styles.btnPrimary}`}
              disabled={busy}
            >
              {busy ? 'Working…' : (submitLabel || 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
      {hint && <p className={styles.fieldHint}>{hint}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────
   MODALS
───────────────────────────────────────── */
function LaunchInstanceModal({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({ imageId: '', instanceType: 't2.micro', keyName: '', minCount: 1, maxCount: 1 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [userData, setUserData] = useState('')
  const [s3Buckets, setS3Buckets] = useState([])
  const [s3BucketsLoading, setS3BucketsLoading] = useState(false)

  useEffect(() => {
    api.get('/aws/s3/buckets')
      .then(r => setS3Buckets(r.data.Buckets || []))
      .catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.imageId.trim()) return setErr('AMI ID is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/instances/run', {
        imageId: form.imageId.trim(),
        instanceType: form.instanceType,
        minCount: Number(form.minCount),
        maxCount: Number(form.maxCount),
        ...(form.keyName.trim() ? { keyName: form.keyName.trim() } : {}),
        ...(userData.trim() ? { userData: userData.trim() } : {}),
      })
      showToast('Instance launch requested.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Launch Instance" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Launch">
      <Field label="AMI ID *">
        <input className={styles.fieldInput} value={form.imageId}
          onChange={e => set('imageId', e.target.value)} placeholder="ami-0abcdef1234567890" autoFocus />
      </Field>
      <Field label="Instance Type">
        <select className={styles.fieldInput} value={form.instanceType} onChange={e => set('instanceType', e.target.value)}>
          {['t2.micro','t2.small','t2.medium','t3.micro','m5.large'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="Key Pair Name" hint="Leave blank to launch without a key pair.">
        <input className={styles.fieldInput} value={form.keyName}
          onChange={e => set('keyName', e.target.value)} placeholder="my-key-pair" />
      </Field>
      <div className={styles.formRow}>
        <Field label="Min Count">
          <input className={styles.fieldInput} type="number" min="1" value={form.minCount}
            onChange={e => set('minCount', e.target.value)} style={{ width: 100 }} />
        </Field>
        <Field label="Max Count">
          <input className={styles.fieldInput} type="number" min="1" value={form.maxCount}
            onChange={e => set('maxCount', e.target.value)} style={{ width: 100 }} />
        </Field>
      </div>
      <div style={{ borderTop: '1px solid #30363d', marginTop: 16, paddingTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className={styles.fieldLabel}>User Data (optional)</label>
          {s3Buckets.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>S3 bootstrap:</span>
              <select
                className={styles.fieldInput}
                style={{ width: 'auto', fontSize: '0.8rem', padding: '2px 6px' }}
                defaultValue=""
                onChange={e => {
                  const bucket = e.target.value
                  if (!bucket) return
                  const endpoint = 'http://localhost:4566'
                  setUserData(
`#!/bin/bash
yum update -y
yum install -y aws-cli
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
aws s3 sync s3://${bucket}/ /home/ec2-user/s3-data/ --endpoint-url=${endpoint}
echo "S3 sync complete" >> /var/log/bootstrap.log`
                  )
                }}
              >
                <option value="">— pick bucket —</option>
                {s3Buckets.map(b => (
                  <option key={b.Name} value={b.Name}>{b.Name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <textarea
          className={styles.fieldInput}
          value={userData}
          onChange={e => setUserData(e.target.value)}
          placeholder="#!/bin/bash&#10;echo 'Hello, World!' > /tmp/hello.txt"
          rows={5}
          style={{ fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }}
        />
        <p style={{ color: '#8b949e', fontSize: '0.75rem', margin: '4px 0 0' }}>
          Script runs on first boot. Select an S3 bucket above to auto-generate an S3 sync script.
        </p>
      </div>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateKeyPairModal({ onClose, onDone, showToast }) {
  const [keyName, setKeyName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!keyName.trim()) return setErr('Key pair name is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/keypairs', { keyName: keyName.trim() })
      showToast(`Key pair "${keyName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Key Pair" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create Key Pair">
      <Field label="Key Pair Name *">
        <input className={styles.fieldInput} value={keyName}
          onChange={e => { setKeyName(e.target.value); setErr('') }} placeholder="my-key-pair" autoFocus />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateSecurityGroupModal({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({ groupName: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.groupName.trim()) return setErr('Group name is required.')
    if (!form.description.trim()) return setErr('Description is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/security-groups', { groupName: form.groupName.trim(), description: form.description.trim() })
      showToast(`Security group "${form.groupName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Security Group" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create">
      <Field label="Group Name *">
        <input className={styles.fieldInput} value={form.groupName}
          onChange={e => set('groupName', e.target.value)} placeholder="my-security-group" autoFocus />
      </Field>
      <Field label="Description *">
        <input className={styles.fieldInput} value={form.description}
          onChange={e => set('description', e.target.value)} placeholder="My security group" />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function AuthorizeIngressModal({ groupId, onClose, onDone, showToast }) {
  const [form, setForm] = useState({ protocol: 'tcp', fromPort: '', toPort: '', cidrIp: '0.0.0.0/0' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.cidrIp.trim()) return setErr('CIDR IP is required.')
    setBusy(true); setErr('')
    try {
      await api.post(`/aws/ec2/security-groups/${groupId}/ingress`, {
        protocol: form.protocol,
        fromPort: form.protocol === '-1' ? undefined : Number(form.fromPort),
        toPort: form.protocol === '-1' ? undefined : Number(form.toPort),
        cidrIp: form.cidrIp.trim(),
      })
      showToast('Ingress rule authorized.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Authorize Ingress Rule" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Authorize">
      <Field label="Security Group ID">
        <input className={styles.fieldInput} value={groupId} readOnly />
      </Field>
      <Field label="Protocol">
        <select className={styles.fieldInput} value={form.protocol} onChange={e => set('protocol', e.target.value)}>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
          <option value="icmp">ICMP</option>
          <option value="-1">All traffic (-1)</option>
        </select>
      </Field>
      {form.protocol !== '-1' && (
        <div className={styles.formRow}>
          <Field label="From Port">
            <input className={styles.fieldInput} type="number" min="0" max="65535" value={form.fromPort}
              onChange={e => set('fromPort', e.target.value)} placeholder="22" style={{ width: 110 }} />
          </Field>
          <Field label="To Port">
            <input className={styles.fieldInput} type="number" min="0" max="65535" value={form.toPort}
              onChange={e => set('toPort', e.target.value)} placeholder="22" style={{ width: 110 }} />
          </Field>
        </div>
      )}
      <Field label="CIDR IP">
        <input className={styles.fieldInput} value={form.cidrIp}
          onChange={e => set('cidrIp', e.target.value)} placeholder="0.0.0.0/0" />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateVpcModal({ onClose, onDone, showToast }) {
  const [cidrBlock, setCidrBlock] = useState('10.0.0.0/16')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!cidrBlock.trim()) return setErr('CIDR block is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/vpcs', { cidrBlock: cidrBlock.trim() })
      showToast('VPC created.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create VPC" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create VPC">
      <Field label="CIDR Block *" hint="e.g. 10.0.0.0/16">
        <input className={styles.fieldInput} value={cidrBlock}
          onChange={e => { setCidrBlock(e.target.value); setErr('') }} autoFocus />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateVolumeModal({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({ size: 8, availabilityZone: 'us-east-1a', volumeType: 'gp2' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.availabilityZone.trim()) return setErr('Availability Zone is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/volumes', {
        size: Number(form.size),
        availabilityZone: form.availabilityZone.trim(),
        volumeType: form.volumeType,
      })
      showToast('Volume created.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Volume" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create Volume">
      <Field label="Size (GiB)">
        <input className={styles.fieldInput} type="number" min="1" value={form.size}
          onChange={e => set('size', e.target.value)} style={{ width: 120 }} />
      </Field>
      <Field label="Availability Zone">
        <input className={styles.fieldInput} value={form.availabilityZone}
          onChange={e => set('availabilityZone', e.target.value)} placeholder="us-east-1a" />
      </Field>
      <Field label="Volume Type">
        <select className={styles.fieldInput} value={form.volumeType} onChange={e => set('volumeType', e.target.value)}>
          {['gp2','gp3','io1','st1','sc1'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function AttachVolumeModal({ volumeId, onClose, onDone, showToast }) {
  const [form, setForm] = useState({ instanceId: '', device: '/dev/sdf' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.instanceId.trim()) return setErr('Instance ID is required.')
    if (!form.device.trim()) return setErr('Device name is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/ec2/volumes/attach', {
        volumeId,
        instanceId: form.instanceId.trim(),
        device: form.device.trim(),
      })
      showToast('Volume attached.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Attach Volume" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Attach">
      <Field label="Volume ID">
        <input className={styles.fieldInput} value={volumeId} readOnly />
      </Field>
      <Field label="Instance ID *">
        <input className={styles.fieldInput} value={form.instanceId}
          onChange={e => set('instanceId', e.target.value)} placeholder="i-0abcdef1234567890" autoFocus />
      </Field>
      <Field label="Device Name">
        <input className={styles.fieldInput} value={form.device}
          onChange={e => set('device', e.target.value)} placeholder="/dev/sdf" />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

/* ─────────────────────────────────────────
   Sidebar navigation structure
───────────────────────────────────────── */
const NAV_GROUPS = [
  {
    items: [
      { key: 'dashboard',    label: 'EC2 Dashboard' },
      { key: 'global-view',  label: 'EC2 Global View' },
      { key: 'events',       label: 'Events' },
      { key: 'tags',         label: 'Tags' },
      { key: 'limits',       label: 'Limits' },
    ],
  },
  {
    heading: 'Instances',
    items: [
      { key: 'instances',      label: 'Instances' },
      { key: 'instance-types', label: 'Instance Types' },
    ],
  },
  {
    heading: 'Images',
    items: [
      { key: 'amis', label: 'AMIs' },
    ],
  },
  {
    heading: 'Elastic Block Store',
    items: [
      { key: 'volumes', label: 'Volumes' },
    ],
  },
  {
    heading: 'Network & Security',
    items: [
      { key: 'security-groups', label: 'Security Groups' },
      { key: 'keypairs',        label: 'Key Pairs' },
      { key: 'elastic-ips',     label: 'Elastic IPs' },
    ],
  },
  {
    heading: 'Network & Content Delivery',
    items: [
      { key: 'vpcs',    label: 'VPCs' },
      { key: 'subnets', label: 'Subnets' },
    ],
  },
]

/* Flat list of all section items (for label lookup) */
const ALL_SECTIONS = NAV_GROUPS.flatMap(g => g.items)

/* Sections that have real data tables */
const TABLE_SECTIONS = new Set([
  'instances', 'keypairs', 'security-groups', 'elastic-ips',
  'vpcs', 'subnets', 'volumes', 'amis',
])

/* Sections that show a stub empty state */
const STUB_SECTIONS = new Set(['global-view', 'events', 'tags', 'limits', 'instance-types'])

const STUB_META = {
  'global-view':     { title: 'EC2 Global View',    icon: '🌍' },
  'events':          { title: 'Events',              icon: '📋' },
  'tags':            { title: 'Tags',                icon: '🏷' },
  'limits':          { title: 'Limits',              icon: '📊' },
  'instance-types':  { title: 'Instance Types',      icon: '🖥' },
}

/* ─────────────────────────────────────────
   Dashboard sub-components
───────────────────────────────────────── */
function DashboardView({ onNavigate, onOpenLaunch, dashData, dashLoading, dashHealth, onRefresh, onNavigateToS3 }) {
  const counts = dashData

  const defaultVpc = counts.vpcs
    ? (counts.vpcs.find(v => v.IsDefault) || null)
    : null

  const resourceItems = [
    { label: 'Instances (running)', value: counts.instances ? counts.instances.filter(i => i.State?.Name === 'running').length : 0, section: 'instances' },
    { label: 'Dedicated Hosts', value: 0, section: null },
    { label: 'Elastic IPs', value: counts.addresses ? counts.addresses.length : 0, section: 'elastic-ips' },
    { label: 'Instances', value: counts.instances ? counts.instances.length : 0, section: 'instances' },
    { label: 'Key pairs', value: counts.keypairs ? counts.keypairs.length : 0, section: 'keypairs' },
    { label: 'Load balancers', value: 0, section: null },
    { label: 'Placement groups', value: 0, section: null },
    { label: 'Security groups', value: counts.securityGroups ? counts.securityGroups.length : 0, section: 'security-groups' },
    { label: 'Snapshots', value: 0, section: null },
    { label: 'Volumes', value: counts.volumes ? counts.volumes.length : 0, section: 'volumes' },
    { label: 'S3 Buckets', value: counts.s3Buckets ?? 0, section: null, isS3: true },
    { label: null, value: null, section: null },
  ]

  return (
    <div className={styles.dashboardGrid}>
      {/* Resources card */}
      <div className={styles.dashCard}>
        <div className={styles.dashCardTitle}>
          <span>Resources</span>
          <button className={styles.refreshIconBtn} onClick={onRefresh} title="Refresh">&#8635;</button>
        </div>
        <p className={styles.dashCardSubtitle}>
          You are using the following Amazon EC2 resources in the US East (N. Virginia) Region:
        </p>
        {dashLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <span className={styles.spinner} /> Loading…
          </div>
        ) : (
          <div className={styles.resourceGrid}>
            {resourceItems.map((item, idx) => (
              <div key={idx} className={styles.resourceItem}>
                {item.label !== null ? (
                  <>
                    <div className={styles.resourceLabel}>{item.label}</div>
                    <div
                      className={styles.resourceCount}
                      onClick={item.isS3 ? onNavigateToS3 : (item.section ? () => onNavigate(item.section) : undefined)}
                      style={(item.isS3 || item.section) ? { cursor: 'pointer' } : { cursor: 'default' }}
                    >
                      {item.value}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account attributes card */}
      <div className={styles.dashCard}>
        <div className={styles.dashCardTitle}>
          <span>Account attributes</span>
          <button className={styles.refreshIconBtn} onClick={onRefresh} title="Refresh">&#8635;</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className={styles.accountLink} style={{ marginBottom: 4 }}>Supported platforms</div>
            <div style={{ paddingLeft: 12, color: '#8b949e', fontSize: '0.85rem' }}>• VPC</div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', marginBottom: 4 }}>Default VPC</div>
            <div style={{ color: '#e6edf3', fontSize: '0.85rem' }}>
              {defaultVpc ? defaultVpc.VpcId : '—'}
            </div>
          </div>
          <div>
            <div style={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Settings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['EBS encryption', 'Zones', 'EC2 Serial Console', 'Default credit specification'].map(link => (
                <span key={link} className={styles.accountLink}>{link}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className={styles.dashboardBottomRow}>
        {/* Launch instance card */}
        <div className={styles.dashCard}>
          <div className={styles.dashCardTitle}>
            <span>Launch instance</span>
          </div>
          <p style={{ color: '#8b949e', fontSize: '0.875rem', marginBottom: 16 }}>
            To get started, launch an Amazon EC2 instance, which is a virtual server in the cloud.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button className={styles.launchBtn} onClick={onOpenLaunch}>
              Launch instance ▾
            </button>
            <button className={styles.migrateBtn} onClick={() => onNavigate('instances')}>
              Migrate a server →
            </button>
          </div>
          <button className={styles.migrateBtn} onClick={onNavigateToS3} style={{ marginTop: 4, fontSize: '0.82rem' }}>
            Open S3 Console →
          </button>
          <p style={{ color: '#8b949e', fontSize: '0.78rem', fontStyle: 'italic' }}>
            Note: Your instances will launch in the US East (N. Virginia) Region
          </p>
        </div>

        {/* Service health card */}
        <div className={styles.dashCard}>
          <div className={styles.dashCardTitle}>
            <span>Service health</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className={styles.refreshIconBtn} onClick={onRefresh} title="Refresh">&#8635;</button>
              <span className={styles.accountLink}>AWS Health Dashboard →</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.875rem' }}>
            <div style={{ color: '#8b949e' }}>
              <strong style={{ color: '#e6edf3' }}>Region:</strong> US East (N. Virginia)
            </div>
            {dashHealth && (
              <div style={{ color: '#8b949e' }}>
                <strong style={{ color: '#e6edf3' }}>Endpoint:</strong>{' '}
                {dashHealth.endpoint || 'http://localhost:4566'}
              </div>
            )}
            <div className={styles.healthStatus}>
              <strong style={{ color: '#e6edf3' }}>Status:</strong>
              {dashHealth === null ? (
                <><span className={styles.spinner} style={{ width: 10, height: 10 }} /> Checking…</>
              ) : dashHealth.connected ? (
                <><span className={`${styles.healthDot} ${styles.healthDotGreen}`} /> This service is operating normally</>
              ) : (
                <><span className={`${styles.healthDot} ${styles.healthDotRed}`} /> Service unavailable</>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function EC2Console({ onBack, onNavigateTo }) {
  const [section, setSection] = useState('dashboard')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const toastId = useRef(0)

  /* ── Dashboard-specific state ── */
  const [dashData, setDashData] = useState({})
  const [dashLoading, setDashLoading] = useState(false)
  const [dashHealth, setDashHealth] = useState(null)

  const showToast = useCallback((msg) => {
    const id = ++toastId.current
    setToast({ id, msg })
  }, [])

  /* ── Fetch dashboard data ── */
  const fetchDashboard = useCallback(async () => {
    setDashLoading(true)
    const [instRes, kpRes, sgRes, addrRes, volRes, vpcRes, healthRes, s3Res] = await Promise.allSettled([
      api.get('/aws/ec2/instances'),
      api.get('/aws/ec2/keypairs'),
      api.get('/aws/ec2/security-groups'),
      api.get('/aws/ec2/addresses'),
      api.get('/aws/ec2/volumes'),
      api.get('/aws/ec2/vpcs'),
      api.get('/aws/health'),
      api.get('/aws/s3/buckets'),
    ])

    setDashData({
      instances:      instRes.status === 'fulfilled' ? (instRes.value.data.Reservations || []).flatMap(r => r.Instances || []) : [],
      keypairs:       kpRes.status === 'fulfilled'   ? (kpRes.value.data.KeyPairs || []) : [],
      securityGroups: sgRes.status === 'fulfilled'   ? (sgRes.value.data.SecurityGroups || []) : [],
      addresses:      addrRes.status === 'fulfilled' ? (addrRes.value.data.Addresses || []) : [],
      volumes:        volRes.status === 'fulfilled'  ? (volRes.value.data.Volumes || []) : [],
      vpcs:           vpcRes.status === 'fulfilled'  ? (vpcRes.value.data.Vpcs || []) : [],
      s3Buckets:      s3Res.status === 'fulfilled' ? (s3Res.value.data.Buckets || []).length : 0,
    })

    if (healthRes.status === 'fulfilled') {
      const h = healthRes.value.data
      setDashHealth({
        connected: h.connected === true,
        endpoint: h.endpoint || 'http://localhost:4566',
      })
    } else {
      setDashHealth({ connected: false, endpoint: 'http://localhost:4566' })
    }

    setDashLoading(false)
  }, [])

  const fetchSection = useCallback(async (sec) => {
    if (!TABLE_SECTIONS.has(sec)) return
    setLoading(true)
    setError('')
    try {
      let rows = []
      if (sec === 'instances') {
        const { data: d } = await api.get('/aws/ec2/instances')
        rows = (d.Reservations || []).flatMap(r => r.Instances || [])
      } else if (sec === 'keypairs') {
        const { data: d } = await api.get('/aws/ec2/keypairs')
        rows = d.KeyPairs || []
      } else if (sec === 'security-groups') {
        const { data: d } = await api.get('/aws/ec2/security-groups')
        rows = d.SecurityGroups || []
      } else if (sec === 'elastic-ips') {
        const { data: d } = await api.get('/aws/ec2/addresses')
        rows = d.Addresses || []
      } else if (sec === 'vpcs') {
        const { data: d } = await api.get('/aws/ec2/vpcs')
        rows = d.Vpcs || []
      } else if (sec === 'subnets') {
        const { data: d } = await api.get('/aws/ec2/subnets')
        rows = d.Subnets || []
      } else if (sec === 'volumes') {
        const { data: d } = await api.get('/aws/ec2/volumes')
        rows = d.Volumes || []
      } else if (sec === 'amis') {
        const { data: d } = await api.get('/aws/ec2/images')
        rows = d.Images || []
      }
      setData(prev => ({ ...prev, [sec]: rows }))
    } catch (ex) {
      setError(ex.response?.data?.message || ex.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (section === 'dashboard') {
      fetchDashboard()
    } else if (TABLE_SECTIONS.has(section)) {
      setSelected(new Set())
      fetchSection(section)
    }
  }, [section, fetchSection, fetchDashboard])

  const rows = data[section] || []

  /* ── row selection ── */
  const toggleRow = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(rows.map(r => rowId(section, r))))
    }
  }
  const firstSelected = selected.size === 1 ? [...selected][0] : null

  /* ── generic confirm action ── */
  const doAction = async (fn, successMsg) => {
    try {
      await fn()
      showToast(successMsg)
      fetchSection(section)
      setSelected(new Set())
    } catch (ex) {
      showToast(`Error: ${ex.response?.data?.message || ex.message}`)
    }
  }

  /* ── instance actions ── */
  const instanceAction = (endpoint, label) => {
    if (!firstSelected) return
    doAction(() => api.post(`/aws/ec2/instances/${endpoint}`, { instanceId: firstSelected }), `${label} requested.`)
  }

  /* ── section change ── */
  const changeSection = (sec) => {
    setSection(sec)
    setModal(null)
    setError('')
  }

  /* ── toolbar actions per section ── */
  const renderToolbar = () => {
    const noneSelected = selected.size === 0
    switch (section) {
      case 'instances':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('launch')}>Launch Instance</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => instanceAction('start', 'Start')}>Start</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => instanceAction('stop', 'Stop')}>Stop</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => instanceAction('reboot', 'Reboot')}>Reboot</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => instanceAction('hibernate', 'Hibernate')}>Hibernate</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={noneSelected}
              onClick={() => instanceAction('terminate', 'Terminate')}>Terminate</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'keypairs':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createKeypair')}>Create Key Pair</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={noneSelected}
              onClick={() => {
                if (!firstSelected) return
                doAction(() => api.delete(`/aws/ec2/keypairs/${firstSelected}`), 'Key pair deleted.')
              }}>Delete</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'security-groups':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createSG')}>Create</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => firstSelected && setModal('authorizeIngress')}>Authorize Ingress</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={noneSelected}
              onClick={() => {
                if (!firstSelected) return
                doAction(() => api.delete(`/aws/ec2/security-groups/${firstSelected}`), 'Security group deleted.')
              }}>Delete</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'elastic-ips':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => doAction(() => api.post('/aws/ec2/addresses/allocate'), 'Elastic IP allocated.')}>
              Allocate
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => {
                const row = rows.find(r => r.AllocationId === firstSelected)
                if (!row) return
                const instanceId = prompt('Enter Instance ID to associate with:')
                if (!instanceId) return
                doAction(() => api.post('/aws/ec2/addresses/associate', { instanceId, allocationId: row.AllocationId }), 'Elastic IP associated.')
              }}>Associate</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => {
                const row = rows.find(r => r.AllocationId === firstSelected)
                if (!row?.AssociationId) return showToast('No association to remove.')
                doAction(() => api.post('/aws/ec2/addresses/disassociate', { associationId: row.AssociationId }), 'Elastic IP disassociated.')
              }}>Disassociate</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={noneSelected}
              onClick={() => {
                if (!firstSelected) return
                doAction(() => api.post('/aws/ec2/addresses/release', { allocationId: firstSelected }), 'Elastic IP released.')
              }}>Release</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'vpcs':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createVpc')}>Create VPC</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'subnets':
        return (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
        )
      case 'volumes':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createVolume')}>Create Volume</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => firstSelected && setModal('attachVolume')}>Attach</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} disabled={noneSelected}
              onClick={() => {
                if (!firstSelected) return
                doAction(() => api.post('/aws/ec2/volumes/detach', { volumeId: firstSelected }), 'Volume detach requested.')
              }}>Detach</button>
            <button className={`${styles.btn} ${styles.btnDanger}`} disabled={noneSelected}
              onClick={() => {
                if (!firstSelected) return
                doAction(() => api.delete(`/aws/ec2/volumes/${firstSelected}`), 'Volume deleted.')
              }}>Delete</button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
          </>
        )
      case 'amis':
        return (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
        )
      default:
        return null
    }
  }

  /* ── table columns and cells ── */
  const renderTable = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={99} className={styles.tdCenter}>
            <span className={styles.spinner} /> Loading…
          </td>
        </tr>
      )
    }
    if (error) {
      return (
        <tr>
          <td colSpan={99} className={styles.tdCenter} style={{ color: '#e05252' }}>
            {error}
          </td>
        </tr>
      )
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={99} className={styles.tdEmpty}>
            No {ALL_SECTIONS.find(s => s.key === section)?.label || 'resources'} found.
          </td>
        </tr>
      )
    }
    switch (section) {
      case 'instances':
        return rows.map(r => {
          const id = r.InstanceId
          const state = r.State?.Name || '—'
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{id}</td>
              <td><StateBadge state={state} /></td>
              <td>{r.InstanceType || '—'}</td>
              <td>{r.ImageId || '—'}</td>
              <td>{r.PrivateIpAddress || '—'}</td>
              <td>{r.KeyName || '—'}</td>
              <td>{formatDate(r.LaunchTime)}</td>
            </tr>
          )
        })
      case 'keypairs':
        return rows.map(r => {
          const id = r.KeyName
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.KeyName}</td>
              <td>{r.KeyPairId || '—'}</td>
              <td>{r.KeyType || '—'}</td>
              <td className={styles.tdMono}>{r.KeyFingerprint || '—'}</td>
            </tr>
          )
        })
      case 'security-groups':
        return rows.map(r => {
          const id = r.GroupId
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.GroupId}</td>
              <td>{r.GroupName || '—'}</td>
              <td>{r.Description || '—'}</td>
              <td>{r.VpcId || '—'}</td>
            </tr>
          )
        })
      case 'elastic-ips':
        return rows.map(r => {
          const id = r.AllocationId
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.AllocationId || '—'}</td>
              <td>{r.PublicIp || '—'}</td>
              <td>{r.Domain || '—'}</td>
              <td>{r.InstanceId || '—'}</td>
            </tr>
          )
        })
      case 'vpcs':
        return rows.map(r => {
          const id = r.VpcId
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.VpcId}</td>
              <td><StateBadge state={r.State} /></td>
              <td>{r.CidrBlock || '—'}</td>
              <td>{r.IsDefault ? 'Yes' : 'No'}</td>
            </tr>
          )
        })
      case 'subnets':
        return rows.map(r => {
          const id = r.SubnetId
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.SubnetId}</td>
              <td><StateBadge state={r.State} /></td>
              <td>{r.CidrBlock || '—'}</td>
              <td>{r.VpcId || '—'}</td>
              <td>{r.AvailabilityZone || '—'}</td>
            </tr>
          )
        })
      case 'volumes':
        return rows.map(r => {
          const id = r.VolumeId
          const attachedTo = r.Attachments?.map(a => a.InstanceId).join(', ') || '—'
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.VolumeId}</td>
              <td><StateBadge state={r.State} /></td>
              <td>{r.Size != null ? `${r.Size} GiB` : '—'}</td>
              <td>{r.VolumeType || '—'}</td>
              <td>{r.AvailabilityZone || '—'}</td>
              <td>{attachedTo}</td>
            </tr>
          )
        })
      case 'amis':
        return rows.map(r => {
          const id = r.ImageId
          return (
            <tr key={id} className={selected.has(id) ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.ImageId}</td>
              <td>{r.Name || '—'}</td>
              <td><StateBadge state={r.State} /></td>
              <td>{r.Architecture || '—'}</td>
            </tr>
          )
        })
      default:
        return null
    }
  }

  const renderHeaders = () => {
    switch (section) {
      case 'instances':
        return ['Instance ID','State','Type','AMI ID','Private IP','Key Name','Launch Time']
      case 'keypairs':
        return ['Key Name','Key Pair ID','Type','Fingerprint']
      case 'security-groups':
        return ['Group ID','Group Name','Description','VPC ID']
      case 'elastic-ips':
        return ['Allocation ID','Public IP','Domain','Instance ID']
      case 'vpcs':
        return ['VPC ID','State','CIDR Block','Default']
      case 'subnets':
        return ['Subnet ID','State','CIDR','VPC ID','AZ']
      case 'volumes':
        return ['Volume ID','State','Size','Type','AZ','Attached To']
      case 'amis':
        return ['Image ID','Name','State','Architecture']
      default:
        return []
    }
  }

  const currentSectionLabel = ALL_SECTIONS.find(s => s.key === section)?.label || ''

  return (
    <div className={styles.console}>
      {/* ── Sidebar ── */}
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTitle}>EC2</div>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.heading && (
              <div className={styles.sectionTitle}>{group.heading}</div>
            )}
            {group.items.map(item => (
              <button
                key={item.key}
                className={`${styles.navItem} ${section === item.key ? styles.navItemActive : ''}`}
                onClick={() => changeSection(item.key)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* ── Main area ── */}
      <div className={styles.main}>
        {/* Header breadcrumb */}
        <div className={styles.header}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.backBtn}`} onClick={onBack}>
            ← Back to Console
          </button>
          <span className={styles.breadcrumb}>
            <span className={styles.breadLink}>EC2</span>
            <span className={styles.breadSep}>›</span>
            <span className={styles.breadCurrent}>{currentSectionLabel}</span>
          </span>
        </div>

        {/* Dashboard view */}
        {section === 'dashboard' && (
          <div className={styles.mainScroll}>
            <DashboardView
              onNavigate={changeSection}
              onOpenLaunch={() => setModal('launch')}
              dashData={dashData}
              dashLoading={dashLoading}
              dashHealth={dashHealth}
              onRefresh={fetchDashboard}
              onNavigateToS3={() => onNavigateTo && onNavigateTo('S3')}
            />
          </div>
        )}

        {/* Stub empty state */}
        {STUB_SECTIONS.has(section) && (
          <div className={styles.stubState}>
            <div className={styles.stubIcon}>{STUB_META[section]?.icon}</div>
            <div className={styles.stubTitle}>{STUB_META[section]?.title}</div>
            <div className={styles.stubDesc}>This feature is not available in the sandbox environment.</div>
          </div>
        )}

        {/* Table view for real data sections */}
        {TABLE_SECTIONS.has(section) && (
          <>
            {/* Toolbar */}
            <div className={styles.toolbar}>
              <div className={styles.toolbarLeft}>
                {renderToolbar()}
              </div>
              <div className={styles.toolbarRight}>
                <span className={styles.rowCount}>
                  {rows.length} resource{rows.length !== 1 ? 's' : ''}
                  {selected.size > 0 && ` · ${selected.size} selected`}
                </span>
              </div>
            </div>

            {/* Table */}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.th} ${styles.thCheck}`}>
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.size === rows.length}
                        onChange={toggleAll}
                      />
                    </th>
                    {renderHeaders().map(h => (
                      <th key={h} className={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renderTable()}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {modal === 'launch' && (
        <LaunchInstanceModal
          onClose={() => setModal(null)}
          onDone={() => {
            if (section === 'dashboard') {
              fetchDashboard()
            } else {
              fetchSection('instances')
            }
          }}
          showToast={showToast}
        />
      )}
      {modal === 'createKeypair' && (
        <CreateKeyPairModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('keypairs')}
          showToast={showToast}
        />
      )}
      {modal === 'createSG' && (
        <CreateSecurityGroupModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('security-groups')}
          showToast={showToast}
        />
      )}
      {modal === 'authorizeIngress' && firstSelected && (
        <AuthorizeIngressModal
          groupId={firstSelected}
          onClose={() => setModal(null)}
          onDone={() => fetchSection('security-groups')}
          showToast={showToast}
        />
      )}
      {modal === 'createVpc' && (
        <CreateVpcModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('vpcs')}
          showToast={showToast}
        />
      )}
      {modal === 'createVolume' && (
        <CreateVolumeModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('volumes')}
          showToast={showToast}
        />
      )}
      {modal === 'attachVolume' && firstSelected && (
        <AttachVolumeModal
          volumeId={firstSelected}
          onClose={() => setModal(null)}
          onDone={() => fetchSection('volumes')}
          showToast={showToast}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />
      )}
    </div>
  )
}

/* ── Helper: derive row ID per section ── */
function rowId(section, row) {
  switch (section) {
    case 'instances':       return row.InstanceId
    case 'keypairs':        return row.KeyName
    case 'security-groups': return row.GroupId
    case 'elastic-ips':     return row.AllocationId
    case 'vpcs':            return row.VpcId
    case 'subnets':         return row.SubnetId
    case 'volumes':         return row.VolumeId
    case 'amis':            return row.ImageId
    default:                return null
  }
}
