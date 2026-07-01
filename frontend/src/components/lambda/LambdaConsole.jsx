import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import styles from './LambdaConsole.module.css'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function StateBadge({ state }) {
  if (!state) return <span className={`${styles.badge} ${styles.badgeOther}`}>—</span>
  const s = state.toLowerCase()
  let cls = styles.badgeOther
  if (s === 'active')   cls = styles.badgeActive
  else if (s === 'inactive') cls = styles.badgeInactive
  else if (s === 'failed')   cls = styles.badgeFailed
  else if (s === 'pending')  cls = styles.badgePending
  return <span className={`${styles.badge} ${cls}`}>{state}</span>
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return <div className={styles.toast}>{message}</div>
}

function Modal({ title, onClose, children, onSubmit, busy, submitLabel, submitDanger, wide, wider }) {
  return (
    <div className={styles.modal} onClick={onClose}>
      <div
        className={styles.modalBox}
        style={wider ? { width: 780 } : wide ? { width: 620 } : undefined}
        onClick={e => e.stopPropagation()}
      >
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

function InvokeModal({ funcName, onClose, showToast }) {
  const [payload, setPayload] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    let parsed
    try {
      parsed = JSON.parse(payload)
    } catch {
      return setErr('Payload must be valid JSON.')
    }
    setBusy(true)
    try {
      const { data } = await api.post(`/aws/lambda/functions/${encodeURIComponent(funcName)}/invoke`, { payload: parsed })
      setResult(data)
      showToast(`Function "${funcName}" invoked.`)
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  let prettyPayload = null
  if (result?.Payload) {
    try {
      prettyPayload = JSON.stringify(
        typeof result.Payload === 'string' ? JSON.parse(result.Payload) : result.Payload,
        null, 2
      )
    } catch {
      prettyPayload = String(result.Payload)
    }
  }

  return (
    <Modal
      title={`Invoke: ${funcName}`}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel="Invoke"
      wide
    >
      <Field label="Function Name">
        <input className={styles.fieldInput} value={funcName} readOnly />
      </Field>
      <Field label="Payload (JSON)" hint="Event payload to send to the function.">
        <textarea
          className={styles.fieldTextarea}
          value={payload}
          onChange={e => { setPayload(e.target.value); setErr('') }}
          rows={5}
          spellCheck={false}
        />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
      {result && (
        <div className={styles.invokeResult}>
          <div className={styles.invokeResultRow}>
            <span className={styles.invokeResultLabel}>Status Code</span>
            <span className={styles.invokeResultValue}>{result.StatusCode ?? '—'}</span>
          </div>
          {result.FunctionError && (
            <div className={styles.invokeResultRow}>
              <span className={styles.invokeResultLabel}>Function Error</span>
              <span className={styles.invokeResultError}>{result.FunctionError}</span>
            </div>
          )}
          {prettyPayload && (
            <div className={styles.invokeResultRow} style={{ flexDirection: 'column', gap: 6 }}>
              <span className={styles.invokeResultLabel}>Response Payload</span>
              <pre className={styles.invokeResultCode}>{prettyPayload}</pre>
            </div>
          )}
          {result.LogResult && (
            <div className={styles.invokeResultRow} style={{ flexDirection: 'column', gap: 6 }}>
              <span className={styles.invokeResultLabel}>Log (tail)</span>
              <pre className={styles.invokeResultCode}>
                {atob(result.LogResult)}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function DeleteModal({ funcName, onClose, onDone, showToast }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.delete(`/aws/lambda/functions/${encodeURIComponent(funcName)}`)
      showToast(`Function "${funcName}" deleted.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Delete Function"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel="Delete"
      submitDanger
    >
      <p className={styles.confirmText}>
        Delete function <strong>{funcName}</strong>? This cannot be undone.
      </p>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

const RUNTIMES = ['nodejs18.x', 'nodejs16.x', 'python3.11', 'python3.9', 'python3.8']

const RUNTIME_CODE_DEFAULTS = {
  'nodejs18.x':  { file: 'index.js',           handler: 'index.handler',                  code: "exports.handler = async (event) => ({\n  statusCode: 200,\n  body: JSON.stringify('Hello from Lambda!'),\n});\n" },
  'nodejs16.x':  { file: 'index.js',           handler: 'index.handler',                  code: "exports.handler = async (event) => ({\n  statusCode: 200,\n  body: JSON.stringify('Hello from Lambda!'),\n});\n" },
  'python3.11':  { file: 'lambda_function.py', handler: 'lambda_function.lambda_handler', code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
  'python3.9':   { file: 'lambda_function.py', handler: 'lambda_function.lambda_handler', code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
  'python3.8':   { file: 'lambda_function.py', handler: 'lambda_function.lambda_handler', code: "def lambda_handler(event, context):\n    return {\n        'statusCode': 200,\n        'body': 'Hello from Lambda!'\n    }\n" },
}

const BLUEPRINTS = [
  { id: 'hello-node',   name: 'hello-world',             runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'General',     icon: '🚀', desc: 'Simple Hello World starter.',
    code: "exports.handler = async (event) => {\n  console.log('Event:', JSON.stringify(event, null, 2));\n  return { statusCode: 200, body: JSON.stringify('Hello from Lambda!') };\n};" },
  { id: 's3-node',      name: 's3-get-object',            runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'S3',          icon: '🪣', desc: 'Process S3 ObjectCreated events.',
    code: "const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');\nconst s3 = new S3Client({});\nexports.handler = async (event) => {\n  const bucket = event.Records[0].s3.bucket.name;\n  const key    = decodeURIComponent(event.Records[0].s3.object.key.replace(/\\+/g, ' '));\n  const obj    = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));\n  console.log('ContentType:', obj.ContentType);\n  return obj.ContentType;\n};" },
  { id: 'sqs-node',     name: 'sqs-processor',            runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'SQS',         icon: '📨', desc: 'Process records from an SQS queue.',
    code: "exports.handler = async (event) => {\n  for (const record of event.Records) {\n    console.log('MessageId:', record.messageId);\n    console.log('Body:', record.body);\n  }\n  return { batchItemFailures: [] };\n};" },
  { id: 'dynamo-node',  name: 'dynamodb-process-stream',  runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'DynamoDB',    icon: '🗄', desc: 'Process DynamoDB Streams records.',
    code: "exports.handler = async (event) => {\n  for (const record of event.Records) {\n    console.log('EventName:', record.eventName);\n    console.log('DynamoDB:', JSON.stringify(record.dynamodb, null, 2));\n  }\n  return `Processed ${event.Records.length} records.`;\n};" },
  { id: 'schedule-node',name: 'scheduled-event',          runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'EventBridge', icon: '⏰', desc: 'Triggered on a cron schedule.',
    code: "exports.handler = async (event) => {\n  console.log('Scheduled at:', event.time);\n  return 'Job complete.';\n};" },
  { id: 'apigw-node',   name: 'api-gateway-proxy',        runtime: 'nodejs18.x', handler: 'index.handler',                  category: 'API Gateway', icon: '🔌', desc: 'Handle API Gateway proxy requests.',
    code: "exports.handler = async (event) => ({\n  statusCode: 200,\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({ method: event.httpMethod, path: event.path }),\n});" },
  { id: 'hello-py',     name: 'hello-world-python',       runtime: 'python3.11', handler: 'lambda_function.lambda_handler', category: 'General',     icon: '🐍', desc: 'Hello World starter in Python.',
    code: "import json\n\ndef lambda_handler(event, context):\n    print('Event:', json.dumps(event, indent=2))\n    return {\n        'statusCode': 200,\n        'body': json.dumps('Hello from Lambda!')\n    }" },
  { id: 's3-py',        name: 's3-trigger-python',        runtime: 'python3.11', handler: 'lambda_function.lambda_handler', category: 'S3',          icon: '🪣', desc: 'Process S3 events in Python.',
    code: "import json, urllib.parse, boto3\n\ns3 = boto3.client('s3')\n\ndef lambda_handler(event, context):\n    bucket = event['Records'][0]['s3']['bucket']['name']\n    key    = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'])\n    resp   = s3.get_object(Bucket=bucket, Key=key)\n    print('ContentType:', resp['ContentType'])\n    return resp['ContentType']" },
]

const CREATION_METHODS = [
  { id: 'scratch',   icon: '✏️', label: 'Author from scratch', sub: 'Start with a Hello World example.' },
  { id: 'blueprint', icon: '📋', label: 'Use a blueprint',     sub: 'Build from a pre-built template.' },
  { id: 'container', icon: '📦', label: 'Container image',     sub: 'Deploy code packaged as a container.' },
]

function CreateFunctionModal({ onClose, onDone, showToast }) {
  const [method,     setMethod]     = useState('scratch')
  const [selectedBp, setSelectedBp] = useState(null)
  const [bpSearch,   setBpSearch]   = useState('')
  const [form, setForm] = useState({
    name: '', runtime: 'nodejs18.x', handler: 'index.handler',
    description: '', role: 'arn:aws:iam::000000000000:role/lambda-role',
    code: RUNTIME_CODE_DEFAULTS['nodejs18.x'].code,
    imageUri: '',
  })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const handleRuntimeChange = (rt) => {
    const def = RUNTIME_CODE_DEFAULTS[rt] || {}
    setForm(prev => ({ ...prev, runtime: rt, handler: def.handler || prev.handler, code: def.code || prev.code }))
  }

  const handleMethodChange = (m) => {
    setMethod(m); setSelectedBp(null); setBpSearch(''); setErr('')
  }

  const selectBlueprint = (bp) => {
    setSelectedBp(bp)
    setForm(prev => ({
      ...prev,
      name:    prev.name || bp.name,
      runtime: bp.runtime,
      handler: bp.handler,
      code:    bp.code,
    }))
  }

  const filteredBps = bpSearch
    ? BLUEPRINTS.filter(b =>
        b.name.toLowerCase().includes(bpSearch.toLowerCase()) ||
        b.category.toLowerCase().includes(bpSearch.toLowerCase()) ||
        b.desc.toLowerCase().includes(bpSearch.toLowerCase())
      )
    : BLUEPRINTS

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.name.trim()) return setErr('Function name is required.')
    if (method === 'blueprint' && !selectedBp) return setErr('Select a blueprint first.')
    if (method === 'container' && !form.imageUri.trim()) return setErr('Container image URI is required.')
    setBusy(true)
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        role:        form.role.trim(),
      }
      if (method === 'container') {
        payload.imageUri = form.imageUri.trim()
      } else {
        payload.runtime = form.runtime
        payload.handler = form.handler.trim()
        payload.code    = form.code
      }
      await api.post('/aws/lambda/functions', payload)
      showToast(`Function "${form.name}" created.`)
      onDone(); onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create Function"
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel="Create"
      wider={method === 'blueprint'}
      wide={method !== 'blueprint'}
    >
      {/* ── Method selector ── */}
      <div className={styles.methodGrid}>
        {CREATION_METHODS.map(m => (
          <div
            key={m.id}
            className={`${styles.methodCard} ${method === m.id ? styles.methodCardActive : ''}`}
            onClick={() => handleMethodChange(m.id)}
          >
            <span className={styles.methodIcon}>{m.icon}</span>
            <span className={styles.methodLabel}>{m.label}</span>
            <span className={styles.methodSub}>{m.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Blueprint grid ── */}
      {method === 'blueprint' && (
        <div className={styles.bpSection}>
          <input
            className={styles.fieldInput}
            placeholder="Search blueprints…"
            value={bpSearch}
            onChange={e => setBpSearch(e.target.value)}
          />
          <div className={styles.bpGrid}>
            {filteredBps.map(bp => (
              <div
                key={bp.id}
                className={`${styles.bpCard} ${selectedBp?.id === bp.id ? styles.bpCardActive : ''}`}
                onClick={() => selectBlueprint(bp)}
              >
                <div className={styles.bpCardHead}>
                  <span className={styles.bpIcon}>{bp.icon}</span>
                  <div className={styles.bpCardTitles}>
                    <span className={styles.bpName}>{bp.name}</span>
                    <span className={styles.bpCategory}>{bp.category}</span>
                  </div>
                  {selectedBp?.id === bp.id && <span className={styles.bpCheck}>✓</span>}
                </div>
                <p className={styles.bpDesc}>{bp.desc}</p>
                <span className={styles.bpRuntime}>{bp.runtime}</span>
              </div>
            ))}
            {filteredBps.length === 0 && (
              <p className={styles.bpEmpty}>No blueprints match your search.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Shared fields ── */}
      <Field label="Function Name">
        <input className={styles.fieldInput} value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-function" autoFocus />
      </Field>
      <Field label="IAM Role ARN" hint="Use the default ARN for LocalStack environments.">
        <input className={styles.fieldInput} value={form.role} onChange={e => set('role', e.target.value)} />
      </Field>
      <Field label="Description (optional)">
        <input className={styles.fieldInput} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What does this function do?" />
      </Field>

      {/* ── Container image URI ── */}
      {method === 'container' && (
        <Field label="Container Image URI" hint="ECR image URI — e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/repo:latest">
          <input className={styles.fieldInput} value={form.imageUri} onChange={e => set('imageUri', e.target.value)} placeholder="123456789.dkr.ecr.us-east-1.amazonaws.com/my-repo:latest" />
        </Field>
      )}

      {/* ── Zip-based fields (scratch + blueprint) ── */}
      {method !== 'container' && (
        <>
          <Field label="Runtime">
            <select className={styles.fieldInput} value={form.runtime} onChange={e => handleRuntimeChange(e.target.value)}>
              {RUNTIMES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Handler" hint="filename.exported_function — e.g. index.handler">
            <input className={styles.fieldInput} value={form.handler} onChange={e => set('handler', e.target.value)} placeholder="index.handler" />
          </Field>
          <Field label="Inline Code">
            <textarea className={styles.fieldTextarea} rows={8} value={form.code} onChange={e => set('code', e.target.value)} spellCheck={false} />
          </Field>
        </>
      )}

      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function UpdateCodeModal({ funcName, runtime, onClose, onDone, showToast }) {
  const rt = runtime || 'nodejs18.x'
  const def = RUNTIME_CODE_DEFAULTS[rt] || RUNTIME_CODE_DEFAULTS['nodejs18.x']
  const [code, setCode] = useState(def.code)
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await api.put(`/aws/lambda/functions/${encodeURIComponent(funcName)}/code`, { runtime: rt, code })
      showToast(`Code updated for "${funcName}".`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Update Code: ${funcName}`} onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Deploy" wide>
      <Field label="Inline Code">
        <textarea className={styles.fieldTextarea} rows={10} value={code} onChange={e => { setCode(e.target.value); setErr('') }} spellCheck={false} />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateMappingModal({ functions, onClose, onDone, showToast }) {
  const [form, setForm] = useState({ functionName: functions[0]?.FunctionName || '', eventSourceArn: '', batchSize: '10' })
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.eventSourceArn.trim()) return setErr('Event Source ARN is required.')
    setBusy(true)
    try {
      await api.post('/aws/lambda/event-source-mappings', {
        functionName: form.functionName,
        eventSourceArn: form.eventSourceArn.trim(),
        batchSize: Number(form.batchSize) || 10,
      })
      showToast('Event source mapping created.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create Event Source Mapping" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create">
      <Field label="Function">
        <select className={styles.fieldInput} value={form.functionName} onChange={e => set('functionName', e.target.value)}>
          {functions.map(f => <option key={f.FunctionName} value={f.FunctionName}>{f.FunctionName}</option>)}
        </select>
      </Field>
      <Field label="Event Source ARN" hint="SQS queue ARN, DynamoDB stream ARN, or Kinesis stream ARN.">
        <input className={styles.fieldInput} value={form.eventSourceArn} onChange={e => set('eventSourceArn', e.target.value)} placeholder="arn:aws:sqs:us-east-1:000000000000:my-queue" />
      </Field>
      <Field label="Batch Size">
        <input className={styles.fieldInput} type="number" min={1} max={10000} value={form.batchSize} onChange={e => set('batchSize', e.target.value)} />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function DeleteMappingModal({ uuid, onClose, onDone, showToast }) {
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.delete(`/aws/lambda/event-source-mappings/${uuid}`)
      showToast('Event source mapping deleted.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Delete Event Source Mapping" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Delete" submitDanger>
      <p className={styles.confirmText}>Delete mapping <strong>{uuid}</strong>? This cannot be undone.</p>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

const SECTIONS = [
  { key: 'functions', label: 'Functions' },
  { key: 'event-source-mappings', label: 'Event Source Mappings' },
]

export default function LambdaConsole({ onBack }) {
  const [section,   setSection]   = useState('functions')
  const [functions, setFunctions] = useState([])
  const [mappings,  setMappings]  = useState([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [selected,  setSelected]  = useState(null)
  const [toast,     setToast]     = useState(null)
  const [modal,     setModal]     = useState(null)
  const toastId = useRef(0)

  const showToast = useCallback((msg) => {
    const id = ++toastId.current
    setToast({ id, msg })
  }, [])

  const fetchFunctions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/aws/lambda/functions')
      setFunctions(data.Functions || [])
    } catch (ex) {
      setError(ex.response?.data?.message || ex.message || 'Failed to load functions.')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMappings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/aws/lambda/event-source-mappings')
      setMappings(data.EventSourceMappings || [])
    } catch (ex) {
      setError(ex.response?.data?.message || ex.message || 'Failed to load mappings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelected(null)
    setModal(null)
    if (section === 'functions') fetchFunctions()
    else fetchMappings()
  }, [section, fetchFunctions, fetchMappings])

  const toggleRow = (id) => setSelected(prev => (prev === id ? null : id))
  const changeSection = (sec) => { setSection(sec); setModal(null) }

  const selectedFunc = functions.find(f => f.FunctionName === selected)
  const rows = section === 'functions' ? functions : mappings
  const noneSelected = !selected

  const renderToolbar = () => {
    if (section === 'event-source-mappings') {
      return (
        <>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setModal('create-mapping')}
            disabled={functions.length === 0}
          >
            Create Mapping
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={noneSelected}
            onClick={() => selected && setModal('delete-mapping')}
          >
            Delete
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={fetchMappings}>Refresh</button>
        </>
      )
    }
    return (
      <>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setModal('create')}
        >
          Create Function
        </button>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          disabled={noneSelected}
          onClick={() => selected && setModal('invoke')}
        >
          Invoke
        </button>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          disabled={noneSelected}
          onClick={() => selected && setModal('update-code')}
        >
          Update Code
        </button>
        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={noneSelected}
          onClick={() => selected && setModal('delete')}
        >
          Delete
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={fetchFunctions}>Refresh</button>
      </>
    )
  }

  const renderTableBody = () => {
    if (loading) {
      return <tr><td colSpan={99} className={styles.tdCenter}><span className={styles.spinner} /> Loading…</td></tr>
    }
    if (error) {
      return <tr><td colSpan={99} className={styles.tdCenter} style={{ color: '#e05252' }}>{error}</td></tr>
    }

    if (section === 'event-source-mappings') {
      if (mappings.length === 0) {
        return <tr><td colSpan={99} className={styles.tdEmpty}>No event source mappings found.</td></tr>
      }
      return mappings.map(m => {
        const id = m.UUID
        const isSelected = selected === id
        return (
          <tr key={id} className={isSelected ? styles.trSelected : ''} onClick={() => toggleRow(id)}>
            <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={isSelected} onChange={() => toggleRow(id)} />
            </td>
            <td className={styles.tdLink}>{id}</td>
            <td className={styles.tdMono} style={{ maxWidth: 260 }}>{m.EventSourceArn || '—'}</td>
            <td>{m.FunctionArn?.split(':').slice(-1)[0] || '—'}</td>
            <td><StateBadge state={m.State} /></td>
            <td>{m.BatchSize ?? '—'}</td>
            <td>{formatDate(m.LastModified)}</td>
          </tr>
        )
      })
    }

    if (functions.length === 0) {
      return <tr><td colSpan={99} className={styles.tdEmpty}>No Lambda functions found.</td></tr>
    }
    return functions.map(r => {
      const name = r.FunctionName
      const isSelected = selected === name
      return (
        <tr key={name} className={isSelected ? styles.trSelected : ''} onClick={() => toggleRow(name)}>
          <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleRow(name)} />
          </td>
          <td className={styles.tdLink}>{name}</td>
          <td>{r.Runtime || '—'}</td>
          <td className={styles.tdMono}>{r.Handler || '—'}</td>
          <td>{r.MemorySize != null ? `${r.MemorySize}` : '—'}</td>
          <td>{r.Timeout != null ? `${r.Timeout}` : '—'}</td>
          <td>{formatBytes(r.CodeSize)}</td>
          <td>{r.PackageType || '—'}</td>
          <td>{formatDate(r.LastModified)}</td>
          <td><StateBadge state={r.State} /></td>
        </tr>
      )
    })
  }

  const tableHeaders = section === 'functions'
    ? ['Function Name', 'Runtime', 'Handler', 'Memory (MB)', 'Timeout (s)', 'Code Size', 'Package Type', 'Last Modified', 'State']
    : ['UUID', 'Event Source ARN', 'Function', 'State', 'Batch Size', 'Last Modified']

  const currentSection = SECTIONS.find(s => s.key === section)
  const rowCount = rows.length
  const countLabel = section === 'functions'
    ? `${rowCount} function${rowCount !== 1 ? 's' : ''}${selected ? ' · 1 selected' : ''}`
    : `${rowCount} mapping${rowCount !== 1 ? 's' : ''}${selected ? ' · 1 selected' : ''}`

  return (
    <div className={styles.console}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Lambda</div>
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`${styles.navItem} ${section === s.key ? styles.navItemActive : ''}`}
            onClick={() => changeSection(s.key)}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      <div className={styles.main}>
        <div className={styles.header}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.backBtn}`} onClick={onBack}>
            &larr; Back to Console
          </button>
          <span className={styles.breadcrumb}>
            <span className={styles.breadLink}>Lambda</span>
            <span className={styles.breadSep}>›</span>
            <span className={styles.breadCurrent}>{currentSection?.label}</span>
          </span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>{renderToolbar()}</div>
          <div className={styles.toolbarRight}>
            <span className={styles.rowCount}>{countLabel}</span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thCheck}`}>
                  <input type="checkbox" style={{ visibility: 'hidden' }} />
                </th>
                {tableHeaders.map(h => <th key={h} className={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>{renderTableBody()}</tbody>
          </table>
        </div>
      </div>

      {modal === 'create' && (
        <CreateFunctionModal
          onClose={() => setModal(null)}
          onDone={() => { fetchFunctions(); setSelected(null) }}
          showToast={showToast}
        />
      )}
      {modal === 'invoke' && selected && (
        <InvokeModal funcName={selected} onClose={() => setModal(null)} showToast={showToast} />
      )}
      {modal === 'update-code' && selected && (
        <UpdateCodeModal
          funcName={selected}
          runtime={selectedFunc?.Runtime}
          onClose={() => setModal(null)}
          onDone={fetchFunctions}
          showToast={showToast}
        />
      )}
      {modal === 'delete' && selected && (
        <DeleteModal
          funcName={selected}
          onClose={() => setModal(null)}
          onDone={() => { fetchFunctions(); setSelected(null) }}
          showToast={showToast}
        />
      )}
      {modal === 'create-mapping' && (
        <CreateMappingModal
          functions={functions}
          onClose={() => setModal(null)}
          onDone={() => { fetchMappings(); setSelected(null) }}
          showToast={showToast}
        />
      )}
      {modal === 'delete-mapping' && selected && (
        <DeleteMappingModal
          uuid={selected}
          onClose={() => setModal(null)}
          onDone={() => { fetchMappings(); setSelected(null) }}
          showToast={showToast}
        />
      )}

      {toast && <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />}
    </div>
  )
}
