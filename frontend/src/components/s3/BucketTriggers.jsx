import { useState, useEffect, useCallback } from 'react'
import api from '../../services/api'
import styles from './BucketTriggers.module.css'

const S3_EVENTS = [
  { value: 's3:ObjectCreated:*',                      label: 'All object create events' },
  { value: 's3:ObjectCreated:Put',                    label: 'PUT' },
  { value: 's3:ObjectCreated:Post',                   label: 'POST' },
  { value: 's3:ObjectCreated:Copy',                   label: 'Copy' },
  { value: 's3:ObjectCreated:CompleteMultipartUpload', label: 'CompleteMultipartUpload' },
  { value: 's3:ObjectRemoved:*',                      label: 'All object delete events' },
  { value: 's3:ObjectRemoved:Delete',                 label: 'Delete' },
  { value: 's3:ObjectRemoved:DeleteMarkerCreated',    label: 'DeleteMarkerCreated' },
  { value: 's3:ObjectRestore:*',                      label: 'All restore events' },
]

function extractFuncName(arn) {
  if (!arn) return '—'
  const parts = arn.split(':')
  return parts[parts.length - 1]
}

function AddTriggerModal({ bucket, onClose, onDone }) {
  const [functions, setFunctions] = useState([])
  const [loadingFns, setLoadingFns] = useState(true)
  const [form, setForm] = useState({
    functionName: '',
    events: ['s3:ObjectCreated:*'],
    prefix: '',
    suffix: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    api.get('/aws/lambda/functions')
      .then(({ data }) => setFunctions(data.Functions || []))
      .catch(() => setFunctions([]))
      .finally(() => setLoadingFns(false))
  }, [])

  useEffect(() => {
    if (functions.length && !form.functionName) {
      setForm(f => ({ ...f, functionName: functions[0].FunctionName }))
    }
  }, [functions, form.functionName])

  const toggleEvent = (val) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(val)
        ? f.events.filter(e => e !== val)
        : [...f.events, val],
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!form.functionName) return setErr('Select a Lambda function.')
    if (!form.events.length) return setErr('Select at least one event type.')
    setBusy(true)
    try {
      await api.post(`/aws/s3/buckets/${bucket}/notification`, {
        functionName: form.functionName,
        events: form.events,
        prefix: form.prefix || undefined,
        suffix: form.suffix || undefined,
      })
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h3 className={styles.modalTitle}>Add Lambda Trigger</h3>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div className={styles.field}>
              <label className={styles.label}>Lambda Function</label>
              {loadingFns
                ? <p className={styles.hint}>Loading functions…</p>
                : functions.length === 0
                  ? <p className={styles.err}>No Lambda functions found. Create one first.</p>
                  : (
                    <>
                      <select
                        className={styles.input}
                        value={form.functionName}
                        onChange={e => setForm(f => ({ ...f, functionName: e.target.value }))}
                      >
                        {functions.map(fn => (
                          <option key={fn.FunctionName} value={fn.FunctionName}>{fn.FunctionName}</option>
                        ))}
                      </select>
                      {(() => {
                        const sel = functions.find(fn => fn.FunctionName === form.functionName)
                        return sel?.Handler
                          ? <p className={styles.hint}>Handler: <code className={styles.handlerCode}>{sel.Handler}</code> · Runtime: {sel.Runtime}</p>
                          : null
                      })()}
                    </>
                  )
              }
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Event Types</label>
              <div className={styles.checkGrid}>
                {S3_EVENTS.map(ev => (
                  <label key={ev.value} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={form.events.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className={styles.checkbox}
                    />
                    <span className={styles.checkLabel}>{ev.label}</span>
                    <span className={styles.checkValue}>{ev.value}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.filterRow}>
              <div className={styles.field}>
                <label className={styles.label}>Prefix filter <span className={styles.optional}>(optional)</span></label>
                <input
                  className={styles.input}
                  value={form.prefix}
                  onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                  placeholder="e.g. uploads/"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Suffix filter <span className={styles.optional}>(optional)</span></label>
                <input
                  className={styles.input}
                  value={form.suffix}
                  onChange={e => setForm(f => ({ ...f, suffix: e.target.value }))}
                  placeholder="e.g. .jpg"
                />
              </div>
            </div>

            {err && <p className={styles.err}>{err}</p>}
          </div>
          <div className={styles.modalFoot}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy || loadingFns || functions.length === 0}>
              {busy ? 'Adding…' : 'Add Trigger'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function BucketTriggers({ bucket }) {
  const [triggers, setTriggers] = useState([])
  const [funcMap, setFuncMap] = useState({})   // functionName → { handler, runtime }
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const load = useCallback(async () => {
    if (!bucket) return
    setLoading(true); setErr('')
    try {
      const [notifRes, fnRes] = await Promise.all([
        api.get(`/aws/s3/buckets/${bucket}/notification`),
        api.get('/aws/lambda/functions'),
      ])
      setTriggers(notifRes.data.LambdaFunctionConfigurations || [])
      const map = {}
      for (const fn of fnRes.data.Functions || []) {
        map[fn.FunctionName] = { handler: fn.Handler, runtime: fn.Runtime }
      }
      setFuncMap(map)
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setLoading(false)
    }
  }, [bucket])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await api.delete(`/aws/s3/buckets/${bucket}/notification/${id}`)
      setTriggers(prev => prev.filter(t => t.Id !== id))
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={styles.page}>

      {/* Flow diagram */}
      <div className={styles.flow}>
        <div className={styles.flowSteps}>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}>🪣</span>
            <span className={styles.flowLabel}>S3 Bucket</span>
            <span className={styles.flowSub}>{bucket}</span>
          </div>
          <span className={styles.flowArrow}>→</span>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}>⚡</span>
            <span className={styles.flowLabel}>Event</span>
            <span className={styles.flowSub}>ObjectCreated / Deleted…</span>
          </div>
          <span className={styles.flowArrow}>→</span>
          <div className={styles.flowStep}>
            <span className={styles.flowIcon}>λ</span>
            <span className={styles.flowLabel}>Lambda</span>
            <span className={styles.flowSub}>Invoked asynchronously</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <span className={styles.sectionTitle}>Lambda Triggers ({triggers.length})</span>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
          + Add Trigger
        </button>
      </div>

      {err && <p className={styles.errBanner}>{err}</p>}

      {/* Triggers list */}
      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : triggers.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>⚡</span>
          <p>No Lambda triggers configured for this bucket.</p>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowAdd(true)}>
            Add your first trigger
          </button>
        </div>
      ) : (
        <div className={styles.triggerList}>
          {triggers.map(t => {
            const filterRules = t.Filter?.Key?.FilterRules || []
            const prefix = filterRules.find(r => r.Name === 'prefix')?.Value
            const suffix = filterRules.find(r => r.Name === 'suffix')?.Value
            const funcName = extractFuncName(t.LambdaFunctionArn)
            const fnMeta = funcMap[funcName]
            return (
              <div key={t.Id} className={styles.triggerCard}>
                <div className={styles.triggerCardHead}>
                  <div className={styles.triggerInfo}>
                    <div className={styles.triggerConnect}>
                      <span className={styles.triggerBucket}>🪣 {bucket}</span>
                      <span className={styles.triggerArrow}>→</span>
                      <span className={styles.triggerFunc}>λ {funcName}</span>
                      {fnMeta?.handler && (
                        <span className={styles.handlerBadge}>{fnMeta.handler}</span>
                      )}
                    </div>
                    <span className={styles.triggerId}>{t.Id}</span>
                  </div>
                  <button
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => handleDelete(t.Id)}
                    disabled={deleting === t.Id}
                  >
                    {deleting === t.Id ? 'Removing…' : 'Remove'}
                  </button>
                </div>

                <div className={styles.triggerMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Function ARN</span>
                    <span className={styles.metaValue}>{t.LambdaFunctionArn}</span>
                  </div>
                  {fnMeta && (
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Handler</span>
                      <span className={`${styles.metaValue} ${styles.handlerValue}`}>
                        {fnMeta.handler || '—'}
                        {fnMeta.runtime && <span className={styles.runtimeChip}>{fnMeta.runtime}</span>}
                      </span>
                    </div>
                  )}
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Events</span>
                    <div className={styles.eventTags}>
                      {(t.Events || []).map(ev => (
                        <span key={ev} className={styles.eventTag}>{ev}</span>
                      ))}
                    </div>
                  </div>
                  {(prefix || suffix) && (
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Filters</span>
                      <span className={styles.metaValue}>
                        {prefix && <span className={styles.filterChip}>prefix: <code>{prefix}</code></span>}
                        {suffix && <span className={styles.filterChip}>suffix: <code>{suffix}</code></span>}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddTriggerModal
          bucket={bucket}
          onClose={() => setShowAdd(false)}
          onDone={load}
        />
      )}
    </div>
  )
}
