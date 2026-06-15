import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import styles from './CloudWatchConsole.module.css'

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

function formatDimensions(dimensions) {
  if (!dimensions || dimensions.length === 0) return '—'
  return dimensions.map(d => `${d.Name}=${d.Value}`).join(', ')
}

function AlarmStateBadge({ state }) {
  if (!state) return <span className={`${styles.badge} ${styles.badgeOther}`}>—</span>
  const s = state.toUpperCase()
  let cls = styles.badgeOther
  if (s === 'OK')                  cls = styles.badgeOk
  else if (s === 'ALARM')          cls = styles.badgeAlarm
  else if (s === 'INSUFFICIENT_DATA') cls = styles.badgeInsufficient
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
   Create Alarm Modal
───────────────────────────────────────── */
function CreateAlarmModal({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({
    alarmName: '',
    metricName: '',
    namespace: '',
    statistic: 'Average',
    period: 300,
    evaluationPeriods: 1,
    threshold: '',
    comparisonOperator: 'GreaterThanThreshold',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.alarmName.trim()) return setErr('Alarm Name is required.')
    if (!form.metricName.trim()) return setErr('Metric Name is required.')
    if (!form.namespace.trim()) return setErr('Namespace is required.')
    if (form.threshold === '' || form.threshold === null) return setErr('Threshold is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/cloudwatch/alarms', {
        alarmName: form.alarmName.trim(),
        metricName: form.metricName.trim(),
        namespace: form.namespace.trim(),
        statistic: form.statistic,
        period: Number(form.period),
        evaluationPeriods: Number(form.evaluationPeriods),
        threshold: Number(form.threshold),
        comparisonOperator: form.comparisonOperator,
      })
      showToast(`Alarm "${form.alarmName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Alarm" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create Alarm">
      <Field label="Alarm Name *">
        <input
          className={styles.fieldInput}
          value={form.alarmName}
          onChange={e => { set('alarmName', e.target.value); setErr('') }}
          placeholder="MyAlarm"
          autoFocus
        />
      </Field>
      <Field label="Metric Name *">
        <input
          className={styles.fieldInput}
          value={form.metricName}
          onChange={e => { set('metricName', e.target.value); setErr('') }}
          placeholder="CPUUtilization"
        />
      </Field>
      <Field label="Namespace *">
        <input
          className={styles.fieldInput}
          value={form.namespace}
          onChange={e => { set('namespace', e.target.value); setErr('') }}
          placeholder="AWS/EC2"
        />
      </Field>
      <Field label="Statistic">
        <select className={styles.fieldInput} value={form.statistic} onChange={e => set('statistic', e.target.value)}>
          {['Average', 'Sum', 'Minimum', 'Maximum', 'SampleCount'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <div className={styles.formRow}>
        <Field label="Period (seconds)">
          <input
            className={styles.fieldInput}
            type="number"
            min="1"
            value={form.period}
            onChange={e => set('period', e.target.value)}
          />
        </Field>
        <Field label="Evaluation Periods">
          <input
            className={styles.fieldInput}
            type="number"
            min="1"
            value={form.evaluationPeriods}
            onChange={e => set('evaluationPeriods', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Threshold *">
        <input
          className={styles.fieldInput}
          type="number"
          value={form.threshold}
          onChange={e => { set('threshold', e.target.value); setErr('') }}
          placeholder="80"
        />
      </Field>
      <Field label="Comparison Operator">
        <select className={styles.fieldInput} value={form.comparisonOperator} onChange={e => set('comparisonOperator', e.target.value)}>
          <option value="GreaterThanThreshold">GreaterThanThreshold</option>
          <option value="GreaterThanOrEqualToThreshold">GreaterThanOrEqualToThreshold</option>
          <option value="LessThanThreshold">LessThanThreshold</option>
          <option value="LessThanOrEqualToThreshold">LessThanOrEqualToThreshold</option>
        </select>
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

/* ─────────────────────────────────────────
   Section configs
───────────────────────────────────────── */
const SECTIONS = [
  { key: 'metrics', label: 'Metrics' },
  { key: 'alarms',  label: 'Alarms'  },
]

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function CloudWatchConsole({ onBack }) {
  const [section, setSection] = useState('metrics')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const toastId = useRef(0)

  const showToast = useCallback((msg) => {
    const id = ++toastId.current
    setToast({ id, msg })
  }, [])

  const fetchSection = useCallback(async (sec) => {
    setLoading(true)
    setError('')
    try {
      let rows = []
      if (sec === 'metrics') {
        const { data: d } = await api.get('/aws/cloudwatch/metrics')
        rows = d.Metrics || []
      } else if (sec === 'alarms') {
        const { data: d } = await api.get('/aws/cloudwatch/alarms')
        rows = d.MetricAlarms || []
      }
      setData(prev => ({ ...prev, [sec]: rows }))
    } catch (ex) {
      setError(ex.response?.data?.message || ex.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelected(new Set())
    fetchSection(section)
  }, [section, fetchSection])

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

  /* ── generic action helper ── */
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

  /* ── section change ── */
  const changeSection = (sec) => {
    setSection(sec)
    setModal(null)
  }

  /* ── toolbar ── */
  const renderToolbar = () => {
    const noneSelected = selected.size === 0
    if (section === 'metrics') {
      return (
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
      )
    }
    if (section === 'alarms') {
      return (
        <>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createAlarm')}>Create Alarm</button>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            disabled={noneSelected}
            onClick={() => {
              if (!firstSelected) return
              doAction(
                () => api.post(`/aws/cloudwatch/alarms/${encodeURIComponent(firstSelected)}/enable`),
                'Actions enabled.'
              )
            }}
          >
            Enable Actions
          </button>
          <button
            className={`${styles.btn} ${styles.btnGhost}`}
            disabled={noneSelected}
            onClick={() => {
              if (!firstSelected) return
              doAction(
                () => api.post(`/aws/cloudwatch/alarms/${encodeURIComponent(firstSelected)}/disable`),
                'Actions disabled.'
              )
            }}
          >
            Disable Actions
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            disabled={noneSelected}
            onClick={() => {
              if (!firstSelected) return
              doAction(
                () => api.delete('/aws/cloudwatch/alarms', { data: { alarmNames: [firstSelected] } }),
                'Alarm deleted.'
              )
            }}
          >
            Delete
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>Refresh</button>
        </>
      )
    }
    return null
  }

  /* ── table body rows ── */
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
            No {SECTIONS.find(s => s.key === section)?.label || 'resources'} found.
          </td>
        </tr>
      )
    }
    if (section === 'metrics') {
      return rows.map((r, idx) => {
        const id = `${r.Namespace}::${r.MetricName}::${idx}`
        return (
          <tr key={id}>
            <td className={styles.tdCheck}>
              <input type="checkbox" style={{ visibility: 'hidden' }} />
            </td>
            <td>{r.Namespace || '—'}</td>
            <td className={styles.tdLink}>{r.MetricName || '—'}</td>
            <td className={styles.tdMono}>{formatDimensions(r.Dimensions)}</td>
          </tr>
        )
      })
    }
    if (section === 'alarms') {
      return rows.map(r => {
        const id = r.AlarmName
        return (
          <tr
            key={id}
            className={selected.has(id) ? styles.trSelected : ''}
            onClick={() => toggleRow(id)}
          >
            <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} />
            </td>
            <td className={styles.tdLink}>{r.AlarmName}</td>
            <td><AlarmStateBadge state={r.StateValue} /></td>
            <td>{r.MetricName || '—'}</td>
            <td>{r.Namespace || '—'}</td>
            <td>{r.Threshold != null ? `${r.Threshold}` : '—'}</td>
            <td>{r.Statistic || '—'}</td>
            <td>{formatDate(r.StateUpdatedTimestamp)}</td>
          </tr>
        )
      })
    }
    return null
  }

  /* ── column headers ── */
  const renderHeaders = () => {
    if (section === 'metrics') {
      return ['Namespace', 'Metric Name', 'Dimensions']
    }
    if (section === 'alarms') {
      return ['Alarm Name', 'State', 'Metric', 'Namespace', 'Threshold', 'Statistic', 'Last Updated']
    }
    return []
  }

  const currentSection = SECTIONS.find(s => s.key === section)

  return (
    <div className={styles.console}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTitle}>CloudWatch</div>
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
            ← Back to Console
          </button>
          <span className={styles.breadcrumb}>
            <span className={styles.breadLink}>CloudWatch</span>
            <span className={styles.breadSep}>›</span>
            <span className={styles.breadCurrent}>{currentSection?.label}</span>
          </span>
        </div>

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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thCheck}`}>
                  {section === 'alarms' && (
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={toggleAll}
                    />
                  )}
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
      </div>

      {modal === 'createAlarm' && (
        <CreateAlarmModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('alarms')}
          showToast={showToast}
        />
      )}

      {toast && (
        <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />
      )}
    </div>
  )
}

/* ── Helper: derive row ID per section ── */
function rowId(section, row) {
  if (section === 'alarms') return row.AlarmName
  return null
}
