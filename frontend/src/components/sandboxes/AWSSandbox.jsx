import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import styles from './Sandbox.module.css'

/* ─── Non-EC2 service actions ──────────────────────────────── */
const SERVICE_ACTIONS = {
  S3: [
    { label: 'List Buckets',   cmd: 'aws s3 ls',              method: 'GET',  url: '/aws/s3/buckets' },
    { label: 'Create Bucket',  cmd: 'aws s3 mb s3://demo-bucket', method: 'POST', url: '/aws/s3/buckets', body: () => ({ name: `demo-bucket-${Date.now()}` }) },
  ],
  Lambda: [
    { label: 'List Functions', cmd: 'aws lambda list-functions', method: 'GET', url: '/aws/lambda/functions' },
  ],
  IAM: [
    { label: 'List Users',     cmd: 'aws iam list-users',        method: 'GET', url: '/aws/iam/users' },
  ],
  CloudWatch: [
    { label: 'List Metrics',   cmd: 'aws cloudwatch list-metrics', method: 'GET', url: '/aws/cloudwatch/metrics' },
  ],
}

/* ─── EC2 sub-sections ─────────────────────────────────────── */
const EC2_SECTIONS = ['Instances', 'Key Pairs', 'Security Groups', 'Elastic IPs', 'VPC', 'Volumes', 'AMIs']

const EC2_FIELDS = {
  Instances: [
    { key: 'amiId',        label: 'AMI ID',           placeholder: 'ami-0abcdef1234567890' },
    { key: 'instanceType', label: 'Instance Type',    placeholder: 't2.micro' },
    { key: 'instanceId',   label: 'Instance ID',      placeholder: 'i-0123456789abcdef0' },
  ],
  'Key Pairs': [
    { key: 'keyName', label: 'Key Pair Name', placeholder: 'my-key-pair' },
  ],
  'Security Groups': [
    { key: 'sgName',   label: 'Group Name',   placeholder: 'my-security-group' },
    { key: 'sgDesc',   label: 'Description',  placeholder: 'My security group' },
    { key: 'sgId',     label: 'Group ID',     placeholder: 'sg-0123456789abcdef0' },
    { key: 'protocol', label: 'Protocol',     placeholder: 'tcp' },
    { key: 'port',     label: 'Port',         placeholder: '22' },
    { key: 'cidr',     label: 'CIDR',         placeholder: '0.0.0.0/0' },
  ],
  'Elastic IPs': [
    { key: 'instanceId',    label: 'Instance ID',    placeholder: 'i-0123456789abcdef0' },
    { key: 'allocationId',  label: 'Allocation ID',  placeholder: 'eipalloc-...' },
    { key: 'associationId', label: 'Association ID', placeholder: 'eipassoc-...' },
  ],
  VPC: [
    { key: 'cidr', label: 'CIDR Block', placeholder: '10.0.0.0/16' },
  ],
  Volumes: [
    { key: 'volumeId',   label: 'Volume ID',          placeholder: 'vol-0123456789abcdef0' },
    { key: 'volumeSize', label: 'Size (GB)',           placeholder: '8' },
    { key: 'az',         label: 'Availability Zone',  placeholder: 'us-east-1a' },
    { key: 'device',     label: 'Device Name',        placeholder: '/dev/sdf' },
    { key: 'instanceId', label: 'Instance ID',        placeholder: 'i-0123456789abcdef0' },
  ],
  AMIs: [],
}

const EC2_ACTIONS = {
  Instances: [
    { label: 'Launch',    cmd: (f) => `aws ec2 run-instances --image-id ${f.amiId} --instance-type ${f.instanceType||'t2.micro'}`, method: 'POST', url: () => '/aws/ec2/instances/run',       requires: ['amiId'],                         body: (f) => ({ imageId: f.amiId, instanceType: f.instanceType||'t2.micro', minCount: 1, maxCount: 1 }) },
    { label: 'Describe',  cmd: () => 'aws ec2 describe-instances',                                                                  method: 'GET',  url: () => '/aws/ec2/instances' },
    { label: 'Status',    cmd: () => 'aws ec2 describe-instance-status',                                                            method: 'GET',  url: () => '/aws/ec2/instances/status' },
    { label: 'Start',     cmd: (f) => `aws ec2 start-instances --instance-ids ${f.instanceId}`,                                    method: 'POST', url: () => '/aws/ec2/instances/start',     requires: ['instanceId'],                    body: (f) => ({ instanceId: f.instanceId }) },
    { label: 'Stop',      cmd: (f) => `aws ec2 stop-instances --instance-ids ${f.instanceId}`,                                     method: 'POST', url: () => '/aws/ec2/instances/stop',      requires: ['instanceId'],                    body: (f) => ({ instanceId: f.instanceId }) },
    { label: 'Reboot',    cmd: (f) => `aws ec2 reboot-instances --instance-ids ${f.instanceId}`,                                   method: 'POST', url: () => '/aws/ec2/instances/reboot',    requires: ['instanceId'],                    body: (f) => ({ instanceId: f.instanceId }) },
    { label: 'Hibernate', cmd: (f) => `aws ec2 stop-instances --instance-ids ${f.instanceId} --hibernate`,                        method: 'POST', url: () => '/aws/ec2/instances/hibernate', requires: ['instanceId'],                    body: (f) => ({ instanceId: f.instanceId }) },
    { label: 'Terminate', cmd: (f) => `aws ec2 terminate-instances --instance-ids ${f.instanceId}`,                                method: 'POST', url: () => '/aws/ec2/instances/terminate', requires: ['instanceId'],                    body: (f) => ({ instanceId: f.instanceId }) },
  ],
  'Key Pairs': [
    { label: 'Describe', cmd: () => 'aws ec2 describe-key-pairs',                             method: 'GET',    url: () => '/aws/ec2/keypairs' },
    { label: 'Create',   cmd: (f) => `aws ec2 create-key-pair --key-name ${f.keyName}`,      method: 'POST',   url: () => '/aws/ec2/keypairs',          requires: ['keyName'], body: (f) => ({ keyName: f.keyName }) },
    { label: 'Delete',   cmd: (f) => `aws ec2 delete-key-pair --key-name ${f.keyName}`,      method: 'DELETE', url: (f) => `/aws/ec2/keypairs/${f.keyName}`, requires: ['keyName'] },
  ],
  'Security Groups': [
    { label: 'Describe',      cmd: () => 'aws ec2 describe-security-groups',                                                                                                            method: 'GET',    url: () => '/aws/ec2/security-groups' },
    { label: 'Create',        cmd: (f) => `aws ec2 create-security-group --group-name ${f.sgName} --description "${f.sgDesc}"`,                                                       method: 'POST',   url: () => '/aws/ec2/security-groups',              requires: ['sgName','sgDesc'], body: (f) => ({ groupName: f.sgName, description: f.sgDesc }) },
    { label: 'Auth Ingress',  cmd: (f) => `aws ec2 authorize-security-group-ingress --group-id ${f.sgId} --protocol ${f.protocol} --port ${f.port} --cidr ${f.cidr}`,                method: 'POST',   url: (f) => `/aws/ec2/security-groups/${f.sgId}/ingress`, requires: ['sgId','protocol','port','cidr'], body: (f) => ({ protocol: f.protocol, fromPort: Number(f.port), toPort: Number(f.port), cidrIp: f.cidr }) },
    { label: 'Delete',        cmd: (f) => `aws ec2 delete-security-group --group-id ${f.sgId}`,                                                                                       method: 'DELETE', url: (f) => `/aws/ec2/security-groups/${f.sgId}`,  requires: ['sgId'] },
  ],
  'Elastic IPs': [
    { label: 'Describe',     cmd: () => 'aws ec2 describe-addresses',                                                                                    method: 'GET',  url: () => '/aws/ec2/addresses' },
    { label: 'Allocate',     cmd: () => 'aws ec2 allocate-address',                                                                                      method: 'POST', url: () => '/aws/ec2/addresses/allocate' },
    { label: 'Associate',    cmd: (f) => `aws ec2 associate-address --instance-id ${f.instanceId} --allocation-id ${f.allocationId}`,                    method: 'POST', url: () => '/aws/ec2/addresses/associate',    requires: ['instanceId','allocationId'],  body: (f) => ({ instanceId: f.instanceId, allocationId: f.allocationId }) },
    { label: 'Disassociate', cmd: (f) => `aws ec2 disassociate-address --association-id ${f.associationId}`,                                             method: 'POST', url: () => '/aws/ec2/addresses/disassociate', requires: ['associationId'],              body: (f) => ({ associationId: f.associationId }) },
    { label: 'Release',      cmd: (f) => `aws ec2 release-address --allocation-id ${f.allocationId}`,                                                    method: 'POST', url: () => '/aws/ec2/addresses/release',      requires: ['allocationId'],               body: (f) => ({ allocationId: f.allocationId }) },
  ],
  VPC: [
    { label: 'Describe VPCs',    cmd: () => 'aws ec2 describe-vpcs',                                 method: 'GET',  url: () => '/aws/ec2/vpcs' },
    { label: 'Create VPC',       cmd: (f) => `aws ec2 create-vpc --cidr-block ${f.cidr}`,           method: 'POST', url: () => '/aws/ec2/vpcs',    requires: ['cidr'], body: (f) => ({ cidrBlock: f.cidr }) },
    { label: 'Describe Subnets', cmd: () => 'aws ec2 describe-subnets',                              method: 'GET',  url: () => '/aws/ec2/subnets' },
  ],
  Volumes: [
    { label: 'Describe', cmd: () => 'aws ec2 describe-volumes',                                                                                                     method: 'GET',    url: () => '/aws/ec2/volumes' },
    { label: 'Create',   cmd: (f) => `aws ec2 create-volume --size ${f.volumeSize} --availability-zone ${f.az||'us-east-1a'}`,                                     method: 'POST',   url: () => '/aws/ec2/volumes',          requires: ['volumeSize'],                              body: (f) => ({ size: Number(f.volumeSize), availabilityZone: f.az||'us-east-1a' }) },
    { label: 'Attach',   cmd: (f) => `aws ec2 attach-volume --volume-id ${f.volumeId} --instance-id ${f.instanceId} --device ${f.device||'/dev/sdf'}`,             method: 'POST',   url: () => '/aws/ec2/volumes/attach',   requires: ['volumeId','instanceId'],                   body: (f) => ({ volumeId: f.volumeId, instanceId: f.instanceId, device: f.device||'/dev/sdf' }) },
    { label: 'Detach',   cmd: (f) => `aws ec2 detach-volume --volume-id ${f.volumeId}`,                                                                             method: 'POST',   url: () => '/aws/ec2/volumes/detach',   requires: ['volumeId'],                                body: (f) => ({ volumeId: f.volumeId }) },
    { label: 'Delete',   cmd: (f) => `aws ec2 delete-volume --volume-id ${f.volumeId}`,                                                                             method: 'DELETE', url: (f) => `/aws/ec2/volumes/${f.volumeId}`, requires: ['volumeId'] },
  ],
  AMIs: [
    { label: 'Describe Images', cmd: () => 'aws ec2 describe-images --owners self', method: 'GET', url: () => '/aws/ec2/images' },
  ],
}

const SERVICES = ['S3', 'EC2', 'Lambda', 'IAM', 'CloudWatch']

const DEFAULT_FORM = {
  instanceId: '', amiId: '', instanceType: 't2.micro',
  keyName: '',
  sgName: '', sgDesc: '', sgId: '', protocol: 'tcp', port: '22', cidr: '0.0.0.0/0',
  allocationId: '', associationId: '',
  volumeId: '', volumeSize: '8', az: 'us-east-1a', device: '/dev/sdf',
}

function AWSSandbox() {
  const [active,     setActive]     = useState(null)
  const [ec2Section, setEc2Section] = useState('Instances')
  const [connected,  setConnected]  = useState(false)
  const [busy,       setBusy]       = useState(false)
  const [form,       setForm]       = useState(DEFAULT_FORM)
  const [lines,      setLines]      = useState([])
  const bodyRef = useRef(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines])

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
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
    setForm(DEFAULT_FORM)
    setLines([])
  }

  const runEc2Action = async (action) => {
    if (busy) return
    const missing = (action.requires || []).find(k => !form[k]?.trim())
    if (missing) {
      const fieldDef = (EC2_FIELDS[ec2Section] || []).find(f => f.key === missing)
      push('error', `Please fill in "${fieldDef?.label || missing}".`)
      return
    }
    setBusy(true)
    push('cmd', action.cmd(form))
    try {
      const urlStr = typeof action.url === 'function' ? action.url(form) : action.url
      const payload = action.body ? action.body(form) : undefined
      let data
      if (action.method === 'GET')         ({ data } = await api.get(urlStr))
      else if (action.method === 'DELETE') ({ data } = await api.delete(urlStr))
      else                                 ({ data } = await api.post(urlStr, payload))
      push('result', JSON.stringify(data, null, 2))
    } catch (err) {
      push('error', err.response?.data?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  const runServiceAction = async (action) => {
    if (busy) return
    setBusy(true)
    push('cmd', action.cmd)
    try {
      const payload = action.body?.()
      const { data } = action.method === 'GET'
        ? await api.get(action.url)
        : await api.post(action.url, payload)
      push('result', JSON.stringify(data, null, 2))
    } catch (err) {
      push('error', err.response?.data?.message || err.message)
    } finally {
      setBusy(false)
    }
  }

  const navigate = useNavigate()
  const status = busy ? 'launching' : connected ? 'running' : 'idle'
  const currentEc2Actions = EC2_ACTIONS[ec2Section] || []
  const currentEc2Fields  = EC2_FIELDS[ec2Section]  || []

  return (
    <div className={`${styles.sandbox} ${styles.aws}`}>

      {/* Header */}
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

      {/* Service selector */}
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

      {/* EC2 sub-navigation */}
      {active === 'EC2' && connected && (
        <div className={styles.subNav}>
          {EC2_SECTIONS.map((sec) => (
            <button
              key={sec}
              className={`${styles.subChip} ${ec2Section === sec ? styles.subChipActive : ''}`}
              onClick={() => setEc2Section(sec)}
            >
              {sec}
            </button>
          ))}
        </div>
      )}

      {/* EC2 form fields */}
      {active === 'EC2' && connected && currentEc2Fields.length > 0 && (
        <div className={styles.fieldGrid}>
          {currentEc2Fields.map(({ key, label, placeholder }) => (
            <div key={key} className={styles.fieldRow}>
              <label className={styles.fieldLabel} htmlFor={key}>{label}</label>
              <input
                id={key}
                className={styles.input}
                value={form[key] || ''}
                onChange={(e) => setField(key, e.target.value)}
                placeholder={placeholder}
                spellCheck="false"
              />
            </div>
          ))}
        </div>
      )}

      {/* EC2 action buttons */}
      {active === 'EC2' && connected && (
        <div className={styles.actionRow}>
          {currentEc2Actions.map((action) => (
            <button
              key={action.label}
              className={`${styles.btn} ${styles.btnAction}`}
              onClick={() => runEc2Action(action)}
              disabled={busy}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Non-EC2 action buttons */}
      {active && active !== 'EC2' && connected && (
        <div className={styles.actionRow}>
          {(SERVICE_ACTIONS[active] || []).map((action) => (
            <button
              key={action.label}
              className={`${styles.btn} ${styles.btnAction}`}
              onClick={() => runServiceAction(action)}
              disabled={busy}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Terminal output */}
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

      {/* Connect / Disconnect */}
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
