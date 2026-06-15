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

function Modal({ title, onClose, children, onSubmit, busy, submitLabel, submitDanger, wide }) {
  return (
    <div className={styles.modal} onClick={onClose}>
      <div
        className={styles.modalBox}
        style={wide ? { width: 620 } : undefined}
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

const SECTIONS = [
  { key: 'functions', label: 'Functions' },
  { key: 'event-source-mappings', label: 'Event Source Mappings' },
]

export default function LambdaConsole({ onBack }) {
  const [section, setSection] = useState('functions')
  const [functions, setFunctions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
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

  useEffect(() => {
    setSelected(null)
    if (section === 'functions') {
      fetchFunctions()
    }
  }, [section, fetchFunctions])

  const toggleRow = (name) => {
    setSelected(prev => (prev === name ? null : name))
  }

  const changeSection = (sec) => {
    setSection(sec)
    setModal(null)
  }

  const rows = section === 'functions' ? functions : []
  const noneSelected = !selected

  const renderToolbar = () => {
    if (section !== 'functions') {
      return (
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setSection('functions')}>
          Back to Functions
        </button>
      )
    }
    return (
      <>
        <span className={styles.tooltipWrap}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} disabled title="Use CLI to create with code">
            Create Function
          </button>
          <span className={styles.tooltip}>Use CLI to create with code</span>
        </span>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          disabled={noneSelected}
          onClick={() => selected && setModal('invoke')}
        >
          Invoke
        </button>
        <button
          className={`${styles.btn} ${styles.btnDanger}`}
          disabled={noneSelected}
          onClick={() => selected && setModal('delete')}
        >
          Delete
        </button>
        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={fetchFunctions}>
          Refresh
        </button>
      </>
    )
  }

  const renderTableBody = () => {
    if (section !== 'functions') {
      return (
        <tr>
          <td colSpan={99} className={styles.tdEmpty}>
            No event source mappings found.
          </td>
        </tr>
      )
    }
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
            No Lambda functions found.
          </td>
        </tr>
      )
    }
    return rows.map(r => {
      const name = r.FunctionName
      const isSelected = selected === name
      return (
        <tr
          key={name}
          className={isSelected ? styles.trSelected : ''}
          onClick={() => toggleRow(name)}
        >
          <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRow(name)}
            />
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
    : ['Name', 'Event Source', 'State', 'Batch Size', 'Last Modified']

  const currentSection = SECTIONS.find(s => s.key === section)

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
          <div className={styles.toolbarLeft}>
            {renderToolbar()}
          </div>
          <div className={styles.toolbarRight}>
            <span className={styles.rowCount}>
              {rows.length} function{rows.length !== 1 ? 's' : ''}
              {selected ? ' · 1 selected' : ''}
            </span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thCheck}`}>
                  <input type="checkbox" style={{ visibility: 'hidden' }} />
                </th>
                {tableHeaders.map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderTableBody()}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'invoke' && selected && (
        <InvokeModal
          funcName={selected}
          onClose={() => setModal(null)}
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

      {toast && (
        <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
