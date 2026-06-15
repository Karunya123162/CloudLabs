import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import styles from './IAMConsole.module.css'

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
function CreateUserModal({ onClose, onDone, showToast }) {
  const [userName, setUserName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!userName.trim()) return setErr('Username is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/iam/users', { userName: userName.trim() })
      showToast(`User "${userName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create User" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create User">
      <Field label="Username *">
        <input
          className={styles.fieldInput}
          value={userName}
          onChange={e => { setUserName(e.target.value); setErr('') }}
          placeholder="my-iam-user"
          autoFocus
        />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function CreateGroupModal({ onClose, onDone, showToast }) {
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return setErr('Group name is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/iam/groups', { groupName: groupName.trim() })
      showToast(`Group "${groupName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Group" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create Group">
      <Field label="Group Name *">
        <input
          className={styles.fieldInput}
          value={groupName}
          onChange={e => { setGroupName(e.target.value); setErr('') }}
          placeholder="my-iam-group"
          autoFocus
        />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function AddUserToGroupModal({ prefillGroup, onClose, onDone, showToast }) {
  const [form, setForm] = useState({ userName: '', groupName: prefillGroup || '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.userName.trim()) return setErr('Username is required.')
    if (!form.groupName.trim()) return setErr('Group name is required.')
    setBusy(true); setErr('')
    try {
      await api.post('/aws/iam/groups/add-user', {
        userName: form.userName.trim(),
        groupName: form.groupName.trim(),
      })
      showToast(`User "${form.userName.trim()}" added to group "${form.groupName.trim()}".`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Add User to Group" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Add User">
      <Field label="Username *">
        <input
          className={styles.fieldInput}
          value={form.userName}
          onChange={e => set('userName', e.target.value)}
          placeholder="my-iam-user"
          autoFocus
        />
      </Field>
      <Field label="Group Name *">
        <input
          className={styles.fieldInput}
          value={form.groupName}
          onChange={e => set('groupName', e.target.value)}
          placeholder="my-iam-group"
        />
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

const SERVICE_PRINCIPALS = [
  'lambda.amazonaws.com',
  'ec2.amazonaws.com',
  'ecs-tasks.amazonaws.com',
]

function CreateRoleModal({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({ roleName: '', servicePrincipal: SERVICE_PRINCIPALS[0] })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.roleName.trim()) return setErr('Role name is required.')
    setBusy(true); setErr('')
    try {
      const assumeRolePolicyDocument = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: form.servicePrincipal },
            Action: 'sts:AssumeRole',
          },
        ],
      })
      await api.post('/aws/iam/roles', {
        roleName: form.roleName.trim(),
        assumeRolePolicyDocument,
      })
      showToast(`Role "${form.roleName.trim()}" created.`)
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Create Role" onClose={onClose} onSubmit={submit} busy={busy} submitLabel="Create Role">
      <Field label="Role Name *">
        <input
          className={styles.fieldInput}
          value={form.roleName}
          onChange={e => { set('roleName', e.target.value); setErr('') }}
          placeholder="my-iam-role"
          autoFocus
        />
      </Field>
      <Field label="Service Principal">
        <select
          className={styles.fieldInput}
          value={form.servicePrincipal}
          onChange={e => set('servicePrincipal', e.target.value)}
        >
          {SERVICE_PRINCIPALS.map(sp => (
            <option key={sp} value={sp}>{sp}</option>
          ))}
        </select>
      </Field>
      {err && <p className={styles.fieldError}>{err}</p>}
    </Modal>
  )
}

function ConfirmDeleteModal({ resourceType, resourceName, onClose, onConfirm, busy }) {
  const submit = (e) => {
    e.preventDefault()
    onConfirm()
  }

  return (
    <Modal
      title={`Delete ${resourceType}`}
      onClose={onClose}
      onSubmit={submit}
      busy={busy}
      submitLabel="Delete"
      submitDanger
    >
      <p style={{ margin: 0, color: '#d4d8e2', fontSize: '0.88rem' }}>
        Are you sure you want to delete <strong style={{ color: '#fff' }}>{resourceName}</strong>?
        This action cannot be undone.
      </p>
    </Modal>
  )
}

/* ─────────────────────────────────────────
   Section configs
───────────────────────────────────────── */
const SECTIONS = [
  { key: 'users',    label: 'Users'    },
  { key: 'groups',   label: 'Groups'   },
  { key: 'roles',    label: 'Roles'    },
  { key: 'policies', label: 'Policies' },
]

/* ─────────────────────────────────────────
   Main Component
───────────────────────────────────────── */
export default function IAMConsole({ onBack }) {
  const [section, setSection] = useState('users')
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
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
      if (sec === 'users') {
        const { data: d } = await api.get('/aws/iam/users')
        rows = d.Users || []
      } else if (sec === 'groups') {
        const { data: d } = await api.get('/aws/iam/groups')
        rows = d.Groups || []
      } else if (sec === 'roles') {
        const { data: d } = await api.get('/aws/iam/roles')
        rows = d.Roles || []
      } else if (sec === 'policies') {
        const { data: d } = await api.get('/aws/iam/policies')
        rows = d.Policies || []
      }
      setData(prev => ({ ...prev, [sec]: rows }))
    } catch (ex) {
      setError(ex.response?.data?.message || ex.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelected(null)
    fetchSection(section)
  }, [section, fetchSection])

  const rows = data[section] || []

  const getRowId = (row) => {
    switch (section) {
      case 'users':    return row.UserName
      case 'groups':   return row.GroupName
      case 'roles':    return row.RoleName
      case 'policies': return row.PolicyName
      default:         return null
    }
  }

  const toggleRow = (id) => {
    setSelected(prev => prev === id ? null : id)
  }

  const selectedRow = rows.find(r => getRowId(r) === selected) || null

  const doDelete = async () => {
    if (!selected) return
    setDeleteBusy(true)
    try {
      if (section === 'users') {
        await api.delete(`/aws/iam/users/${selected}`)
        showToast(`User "${selected}" deleted.`)
      } else if (section === 'groups') {
        await api.delete(`/aws/iam/groups/${selected}`)
        showToast(`Group "${selected}" deleted.`)
      } else if (section === 'roles') {
        await api.delete(`/aws/iam/roles/${selected}`)
        showToast(`Role "${selected}" deleted.`)
      }
      fetchSection(section)
      setSelected(null)
      setModal(null)
    } catch (ex) {
      showToast(`Error: ${ex.response?.data?.message || ex.message}`)
      setModal(null)
    } finally {
      setDeleteBusy(false)
    }
  }

  const changeSection = (sec) => {
    setSection(sec)
    setModal(null)
    setSelected(null)
  }

  const renderToolbar = () => {
    const noneSelected = !selected
    switch (section) {
      case 'users':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createUser')}>
              Create User
            </button>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={noneSelected}
              onClick={() => setModal('confirmDelete')}
            >
              Delete
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>
              Refresh
            </button>
          </>
        )
      case 'groups':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createGroup')}>
              Create Group
            </button>
            <button
              className={`${styles.btn} ${styles.btnGhost}`}
              disabled={noneSelected}
              onClick={() => setModal('addUserToGroup')}
            >
              Add User to Group
            </button>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={noneSelected}
              onClick={() => setModal('confirmDelete')}
            >
              Delete
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>
              Refresh
            </button>
          </>
        )
      case 'roles':
        return (
          <>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setModal('createRole')}>
              Create Role
            </button>
            <button
              className={`${styles.btn} ${styles.btnDanger}`}
              disabled={noneSelected}
              onClick={() => setModal('confirmDelete')}
            >
              Delete
            </button>
            <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>
              Refresh
            </button>
          </>
        )
      case 'policies':
        return (
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => fetchSection(section)}>
            Refresh
          </button>
        )
      default:
        return null
    }
  }

  const renderHeaders = () => {
    switch (section) {
      case 'users':    return ['Username', 'User ID', 'ARN', 'Created']
      case 'groups':   return ['Group Name', 'Group ID', 'ARN', 'Created']
      case 'roles':    return ['Role Name', 'Role ID', 'ARN', 'Description', 'Created']
      case 'policies': return ['Policy Name', 'Policy ID', 'ARN', 'Description', 'Attachments']
      default:         return []
    }
  }

  const renderRows = () => {
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

    switch (section) {
      case 'users':
        return rows.map(r => {
          const id = r.UserName
          return (
            <tr
              key={id}
              className={selected === id ? styles.trSelected : ''}
              onClick={() => toggleRow(id)}
            >
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected === id} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.UserName}</td>
              <td className={styles.tdMono}>{r.UserId || '—'}</td>
              <td className={styles.tdMono}>{r.Arn || '—'}</td>
              <td>{formatDate(r.CreateDate)}</td>
            </tr>
          )
        })

      case 'groups':
        return rows.map(r => {
          const id = r.GroupName
          return (
            <tr
              key={id}
              className={selected === id ? styles.trSelected : ''}
              onClick={() => toggleRow(id)}
            >
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected === id} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.GroupName}</td>
              <td className={styles.tdMono}>{r.GroupId || '—'}</td>
              <td className={styles.tdMono}>{r.Arn || '—'}</td>
              <td>{formatDate(r.CreateDate)}</td>
            </tr>
          )
        })

      case 'roles':
        return rows.map(r => {
          const id = r.RoleName
          return (
            <tr
              key={id}
              className={selected === id ? styles.trSelected : ''}
              onClick={() => toggleRow(id)}
            >
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected === id} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.RoleName}</td>
              <td className={styles.tdMono}>{r.RoleId || '—'}</td>
              <td className={styles.tdMono}>{r.Arn || '—'}</td>
              <td>{r.Description || '—'}</td>
              <td>{formatDate(r.CreateDate)}</td>
            </tr>
          )
        })

      case 'policies':
        return rows.map(r => {
          const id = r.PolicyName
          return (
            <tr
              key={id}
              className={selected === id ? styles.trSelected : ''}
              onClick={() => toggleRow(id)}
            >
              <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected === id} onChange={() => toggleRow(id)} />
              </td>
              <td className={styles.tdLink}>{r.PolicyName}</td>
              <td className={styles.tdMono}>{r.PolicyId || '—'}</td>
              <td className={styles.tdMono}>{r.Arn || '—'}</td>
              <td>{r.Description || '—'}</td>
              <td>{r.AttachmentCount != null ? r.AttachmentCount : '—'}</td>
            </tr>
          )
        })

      default:
        return null
    }
  }

  const currentSection = SECTIONS.find(s => s.key === section)

  return (
    <div className={styles.console}>
      <nav className={styles.sidebar}>
        <div className={styles.sidebarTitle}>IAM</div>
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
            <span className={styles.breadLink}>IAM</span>
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
              {selected && ' · 1 selected'}
            </span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={`${styles.th} ${styles.thCheck}`}>
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected !== null && rows.some(r => getRowId(r) === selected)}
                    onChange={() => setSelected(null)}
                    style={{ pointerEvents: selected ? 'auto' : 'none', opacity: selected ? 1 : 0.3 }}
                  />
                </th>
                {renderHeaders().map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderRows()}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'createUser' && (
        <CreateUserModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('users')}
          showToast={showToast}
        />
      )}

      {modal === 'createGroup' && (
        <CreateGroupModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('groups')}
          showToast={showToast}
        />
      )}

      {modal === 'addUserToGroup' && (
        <AddUserToGroupModal
          prefillGroup={section === 'groups' ? selected : ''}
          onClose={() => setModal(null)}
          onDone={() => fetchSection('groups')}
          showToast={showToast}
        />
      )}

      {modal === 'createRole' && (
        <CreateRoleModal
          onClose={() => setModal(null)}
          onDone={() => fetchSection('roles')}
          showToast={showToast}
        />
      )}

      {modal === 'confirmDelete' && selected && (
        <ConfirmDeleteModal
          resourceType={currentSection?.label.replace(/s$/, '') || 'Resource'}
          resourceName={selected}
          onClose={() => setModal(null)}
          onConfirm={doDelete}
          busy={deleteBusy}
        />
      )}

      {toast && (
        <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />
      )}
    </div>
  )
}
