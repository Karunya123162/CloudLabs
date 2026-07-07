import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/api'
import styles from './S3Console.module.css'
import BucketTriggers from './BucketTriggers'
import { useRegion, REGIONS } from '../../context/RegionContext'

/* ── Helpers ── */
function formatSize(bytes) {
  if (bytes === 0 || bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
function fileExt(key) {
  const parts = key.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : '—'
}

const DEFAULT_POLICY = (bucket) => JSON.stringify({
  Version: '2012-10-17',
  Statement: [{
    Sid: 'PublicReadGetObject',
    Effect: 'Allow',
    Principal: '*',
    Action: 's3:GetObject',
    Resource: `arn:aws:s3:::${bucket}/*`,
  }],
}, null, 2)

/* ════════════════════════════════════
   MODALS
════════════════════════════════════ */

/* ── small helper: AWS-style section card ── */
function CBSection({ title, children }) {
  return (
    <div className={styles.cbSection}>
      <div className={styles.cbSectionHead}>
        <span className={styles.cbSectionTitle}>{title}</span>
        <span className={styles.cbInfoBtn}>Info</span>
      </div>
      <div className={styles.cbSectionBody}>{children}</div>
    </div>
  )
}

function CBRadio({ name, value, checked, onChange, label, desc }) {
  return (
    <label className={`${styles.cbRadioRow} ${checked ? styles.cbRadioRowActive : ''}`} onClick={() => onChange(value)}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => {}} className={styles.cbRadioInput} />
      <div>
        <div className={styles.cbRadioLabel}>{label}</div>
        {desc && <div className={styles.cbRadioDes}>{desc}</div>}
      </div>
    </label>
  )
}

function CreateBucketModal({ onClose, onCreate, existingBuckets = [] }) {
  const { region } = useRegion()

  /* ── state ── */
  const [bucketType,   setBucketType]   = useState('general')
  const [name,         setName]         = useState('')
  const [acls,         setAcls]         = useState('disabled')
  const [blockAll,     setBlockAll]     = useState(true)
  const [blockAcls,    setBlockAcls]    = useState({ BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true })
  const [versioning,   setVersioning]   = useState('disable')
  const [encryption,   setEncryption]   = useState('AES256')
  const [bucketKey,    setBucketKey]    = useState('enable')
  const [objectLock,   setObjectLock]   = useState('disable')
  const [tags,         setTags]         = useState([])
  const [copySource,   setCopySource]   = useState('')
  const [copying,      setCopying]      = useState(false)
  const [copyMsg,      setCopyMsg]      = useState(null)
  const [busy,         setBusy]         = useState(false)
  const [err,          setErr]          = useState('')
  const [showEncryptionInfo, setShowEncryptionInfo] = useState(false)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  /* ── block all toggle ── */
  const toggleBlockAll = (v) => {
    setBlockAll(v)
    setBlockAcls({ BlockPublicAcls: v, IgnorePublicAcls: v, BlockPublicPolicy: v, RestrictPublicBuckets: v })
  }
  const toggleSubBlock = (key, v) => {
    const next = { ...blockAcls, [key]: v }
    setBlockAcls(next)
    setBlockAll(Object.values(next).every(Boolean))
  }

  /* ── copy settings ── */
  const applyCopy = async () => {
    if (!copySource) return
    setCopying(true); setCopyMsg(null)
    try {
      const [vR, eR, pR, oR, tR] = await Promise.allSettled([
        api.get(`/aws/s3/buckets/${copySource}/versioning`),
        api.get(`/aws/s3/buckets/${copySource}/encryption`),
        api.get(`/aws/s3/buckets/${copySource}/public-access`),
        api.get(`/aws/s3/buckets/${copySource}/ownership`),
        api.get(`/aws/s3/buckets/${copySource}/tags`),
      ])
      if (vR.status === 'fulfilled') setVersioning(vR.value.data.Status === 'Enabled' ? 'enable' : 'disable')
      if (eR.status === 'fulfilled') setEncryption(eR.value.data.algorithm || 'AES256')
      if (pR.status === 'fulfilled') {
        const c = pR.value.data.config || {}
        const all = c.BlockPublicAcls && c.IgnorePublicAcls && c.BlockPublicPolicy && c.RestrictPublicBuckets
        setBlockAll(!!all)
        setBlockAcls({ BlockPublicAcls: !!c.BlockPublicAcls, IgnorePublicAcls: !!c.IgnorePublicAcls, BlockPublicPolicy: !!c.BlockPublicPolicy, RestrictPublicBuckets: !!c.RestrictPublicBuckets })
      }
      if (oR.status === 'fulfilled') {
        const OWN_REVERSE = { BucketOwnerEnforced: 'disabled', BucketOwnerPreferred: 'preferred', ObjectWriter: 'writer' }
        setAcls(OWN_REVERSE[oR.value.data.rule] || 'disabled')
      }
      if (tR.status === 'fulfilled') {
        setTags((tR.value.data.TagSet || []).map(t => ({ key: t.Key, value: t.Value })))
      }
      setCopyMsg({ ok: true, text: `Settings copied from "${copySource}"` })
    } catch { setCopyMsg({ ok: false, text: 'Failed to copy settings.' }) }
    finally { setCopying(false) }
  }

  /* ── submit ── */
  const submit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setErr('Bucket name is required.')
    if (bucketType === 'general' && !/^[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]$/.test(trimmed))
      return setErr('3–63 chars · lowercase letters, numbers, hyphens only.')
    setBusy(true); setErr('')
    const OWN_MAP = { disabled: 'BucketOwnerEnforced', preferred: 'BucketOwnerPreferred', writer: 'ObjectWriter' }
    try {
      await api.post('/aws/s3/buckets', { name: trimmed, region: region.code, objectLock: objectLock === 'enable' })
      /* versioning — object lock requires it enabled */
      if (versioning === 'enable' || objectLock === 'enable')
        await api.put(`/aws/s3/buckets/${trimmed}/versioning`, { status: 'Enabled' })
      await api.put(`/aws/s3/buckets/${trimmed}/encryption`, { algorithm: encryption, bucketKeyEnabled: bucketKey === 'enable' })
      await api.put(`/aws/s3/buckets/${trimmed}/public-access`, blockAcls)
      await api.put(`/aws/s3/buckets/${trimmed}/ownership`, { rule: OWN_MAP[acls] || 'BucketOwnerEnforced' })
      const validTags = tags.filter(t => t.key.trim())
      if (validTags.length > 0)
        await api.put(`/aws/s3/buckets/${trimmed}/tags`, { tags: validTags })
      onCreate(); onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  const BLOCK_FIELDS = [
    { key: 'BlockPublicAcls',       label: 'Block public access granted through new ACLs',
      sub: 'S3 will block new public access permissions applied to newly added objects via ACLs.' },
    { key: 'IgnorePublicAcls',      label: 'Block public access granted through any ACLs',
      sub: 'S3 will ignore all public ACLs on this bucket and objects in this bucket.' },
    { key: 'BlockPublicPolicy',     label: 'Block public access granted through new public bucket policies',
      sub: 'S3 will block new bucket policies that grant public access.' },
    { key: 'RestrictPublicBuckets', label: 'Block public and cross-account access granted through any public bucket policies',
      sub: 'S3 will ignore public and cross-account access for this bucket and objects.' },
  ]

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.cbModal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.cbHead}>
          <h2 className={styles.cbTitle}>Create bucket</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display: 'contents' }}>
          <div className={styles.cbBody}>

            {/* ── General configuration ── */}
            <CBSection title="General configuration">
              {/* Bucket type */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>Bucket type</div>
                <CBRadio name="btype" value="general" checked={bucketType === 'general'} onChange={setBucketType}
                  label="General purpose"
                  desc="Recommended for most use cases and is designed to provide 99.999999999% (11 nines) of durability. Stores data across 3 or more Availability Zones." />
                <CBRadio name="btype" value="directory" checked={bucketType === 'directory'} onChange={v => { setBucketType(v); setName('') }}
                  label="Directory bucket"
                  desc="Choose for workloads or performance-critical applications that require consistent single-digit millisecond latency. Stores data within a single Availability Zone." />
              </div>

              {/* Bucket name */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bucket name <span className={styles.req}>*</span></label>
                <input ref={inputRef} className={styles.fieldInput} value={name}
                  onChange={e => { setName(e.target.value); setErr('') }}
                  placeholder={bucketType === 'general' ? 'my-bucket-name' : 'my-bucket--use1-az4--x-s3'} />
                {bucketType === 'general'
                  ? <p className={styles.fieldHint}>Bucket name must be globally unique and must not contain spaces or uppercase letters. <a href="#" className={styles.infoLink}>See rules for bucket naming</a></p>
                  : <p className={styles.fieldHint}>Must end with <code className={styles.inlineCode}>--{'<az-id>'}--x-s3</code> e.g. <code className={styles.inlineCode}>my-bucket--use1-az4--x-s3</code></p>}
                {err && <p className={styles.fieldError}>{err}</p>}
              </div>

              {/* Region */}
              <div className={styles.cbTwoCol}>
                <div className={styles.fieldGroup}>
                  <div className={styles.fieldLabel}>AWS Region</div>
                  <div className={styles.cbStaticVal}>{region.name} ({region.code})</div>
                </div>
              </div>

              {/* Copy settings */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>Copy settings from an existing bucket <span className={styles.optionalTag}>optional</span></div>
                <div className={styles.copyRow}>
                  <select className={styles.fieldInput} value={copySource}
                    onChange={e => { setCopySource(e.target.value); setCopyMsg(null) }} style={{ flex: 1 }}>
                    <option value="">— Choose a bucket —</option>
                    {existingBuckets.map(b => <option key={b.Name} value={b.Name}>{b.Name}</option>)}
                  </select>
                  <button type="button" className={styles.btnSecondary} disabled={!copySource || copying} onClick={applyCopy}>
                    {copying ? 'Copying…' : 'Copy settings'}
                  </button>
                </div>
                {copyMsg && (
                  <div className={copyMsg.ok ? styles.copySuccess : styles.fieldError}>
                    {copyMsg.ok && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill="#1d8102"/><path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    {copyMsg.text}
                  </div>
                )}
              </div>
            </CBSection>

            {/* ── Object Ownership ── */}
            <CBSection title="Object Ownership">
              <div className={styles.cbOwnershipNote}>
                Disable ACLs and take ownership of every object in this bucket, simplifying access management.
              </div>
              <div className={styles.cbOwnershipGroup}>
                <div className={styles.cbOwnershipGroupTitle}>ACLs disabled</div>
                <CBRadio name="acls" value="disabled" checked={acls === 'disabled'} onChange={setAcls}
                  label="Bucket owner enforced (Recommended)"
                  desc="Bucket and objects don't have associated ACLs. All access to this bucket and its objects is specified using policies." />
              </div>
              <div className={styles.cbOwnershipGroup}>
                <div className={styles.cbOwnershipGroupTitle}>ACLs enabled</div>
                <CBRadio name="acls" value="preferred" checked={acls === 'preferred'} onChange={setAcls}
                  label="Bucket owner preferred"
                  desc="The bucket owner owns and has full control over new objects that other accounts write to the bucket with the bucket-owner-full-control canned ACL." />
                <CBRadio name="acls" value="writer" checked={acls === 'writer'} onChange={setAcls}
                  label="Object writer"
                  desc="The AWS account that uploads an object owns the object, has full control, and can grant other users access to it via ACLs." />
              </div>
            </CBSection>

            {/* ── Block Public Access ── */}
            <CBSection title="Block Public Access settings for this bucket">
              <div className={styles.cbWarnBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#8a6116" strokeWidth="1.5" fill="#fff8e6"/>
                  <line x1="12" y1="9" x2="12" y2="13" stroke="#8a6116" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="12" cy="17" r="0.5" fill="#8a6116" stroke="#8a6116"/>
                </svg>
                <span>Turning off block all public access might result in this bucket and the objects within becoming public.</span>
              </div>
              <label className={styles.cbCheckMaster}>
                <input type="checkbox" checked={blockAll} onChange={e => toggleBlockAll(e.target.checked)} style={{ accentColor: '#0073bb' }} />
                <div>
                  <div className={styles.cbCheckLabel}>Block <em>all</em> public access</div>
                  <div className={styles.cbCheckSub}>Turning this on is the same as turning on all four settings below.</div>
                </div>
              </label>
              <div className={styles.cbSubChecks}>
                {BLOCK_FIELDS.map(f => (
                  <label key={f.key} className={styles.cbCheckSub2}>
                    <input type="checkbox" checked={!!blockAcls[f.key]} onChange={e => toggleSubBlock(f.key, e.target.checked)} style={{ accentColor: '#0073bb' }} />
                    <div>
                      <div className={styles.cbCheckLabel}>{f.label}</div>
                      <div className={styles.cbCheckSub}>{f.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </CBSection>

            {/* ── Bucket Versioning ── */}
            <CBSection title="Bucket Versioning">
              <p className={styles.cbSectionNote}>
                Versioning is a means of keeping multiple variants of an object in the same bucket.
                Use versioning to preserve, retrieve, and restore every version of every object stored in your bucket.
              </p>
              <CBRadio name="vers" value="disable" checked={versioning === 'disable'} onChange={setVersioning} label="Disable" />
              <CBRadio name="vers" value="enable"  checked={versioning === 'enable'}  onChange={setVersioning} label="Enable" />
            </CBSection>

            {/* ── Tags ── */}
            <CBSection title={`Tags (${tags.length})`}>
              <p className={styles.cbSectionNote}>
                You can use tags to track costs, manage access, and organize your S3 resources.
              </p>
              {tags.length > 0 && (
                <div className={styles.cbTagTable}>
                  <div className={styles.cbTagHead}><span>Key</span><span>Value</span><span /></div>
                  {tags.map((t, i) => (
                    <div key={i} className={styles.cbTagRow}>
                      <input className={styles.fieldInput} value={t.key} placeholder="Key"
                        onChange={e => setTags(prev => prev.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} />
                      <input className={styles.fieldInput} value={t.value} placeholder="Value"
                        onChange={e => setTags(prev => prev.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                      <button type="button" className={styles.cbTagRemove}
                        onClick={() => setTags(prev => prev.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className={styles.cbAddTagBtn}
                onClick={() => setTags(prev => [...prev, { key: '', value: '' }])}>
                + Add tag
              </button>
            </CBSection>

            {/* ── Default encryption ── */}
            <CBSection title="Default encryption">
              <div className={styles.cbWarnBox} style={{ borderLeft: '4px solid #0073bb', backgroundColor: '#e8f4f8', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px', display: 'inline' }}>
                    <circle cx="12" cy="12" r="10" stroke="#0073bb" strokeWidth="1.5"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="0.5" fill="#0073bb" stroke="#0073bb"/>
                  </svg>
                  <span><strong>Dual-layer encryption enabled by default</strong><br/>SSE-S3 with Amazon S3 managed keys + S3 Bucket Key for enhanced protection</span>
                </div>
                <button 
                  type="button" 
                  className={styles.cbInfoBtn}
                  onClick={() => setShowEncryptionInfo(true)}
                  style={{ marginLeft: '12px', whiteSpace: 'nowrap', cursor: 'pointer', background: '#0073bb', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '3px', fontSize: '12px' }}
                >
                  Learn more
                </button>
              </div>
              <div className={styles.cbSectionNote}>
                Your bucket will automatically use server-side encryption with Amazon S3 managed keys and S3 Bucket Key enabled. This provides an additional layer of encryption and reduces SSE request costs.
              </div>
            </CBSection>

            {/* Encryption Info Modal */}
            {showEncryptionInfo && (
              <div className={styles.overlay} onClick={() => setShowEncryptionInfo(false)}>
                <div className={styles.cbModal} onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
                  <div className={styles.cbHead}>
                    <h2 className={styles.cbTitle}>S3 Encryption Options</h2>
                    <button className={styles.modalClose} onClick={() => setShowEncryptionInfo(false)}>✕</button>
                  </div>
                  <div className={styles.cbBody}>
                    {/* Current Default */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#e8f4f8', borderRadius: '4px', borderLeft: '4px solid #0073bb' }}>
                      <h3 style={{ margin: '0 0 8px 0', color: '#0073bb', fontSize: '14px', fontWeight: 'bold' }}>✓ Your Choice: SSE-S3 (Recommended)</h3>
                      <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <strong>Server-Side Encryption with Amazon S3 Managed Keys</strong><br/>
                        All objects in your bucket are encrypted using AES-256 encryption. AWS manages all the keys for you, automatically. This is the simplest and most cost-effective option for most use cases.
                      </p>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <li>Encryption and decryption handled automatically by S3</li>
                        <li>No key management required</li>
                        <li>No additional charges</li>
                        <li>Perfect for most applications</li>
                      </ul>
                    </div>

                    {/* S3 Bucket Key */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f0f8f4', borderRadius: '4px', borderLeft: '4px solid #228B22' }}>
                      <h3 style={{ margin: '0 0 8px 0', color: '#228B22', fontSize: '14px', fontWeight: 'bold' }}>✓ Enabled: S3 Bucket Key</h3>
                      <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <strong>Reduces Encryption Costs & Adds Extra Protection Layer</strong><br/>
                        S3 Bucket Keys generate short-term keys from your S3 bucket-level key, reducing traffic to AWS Key Management Service and encryption processing overhead.
                      </p>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <li>Reduces SSE-S3 request costs by up to 50%</li>
                        <li>Lower AWS KMS API call volume</li>
                        <li>Faster encryption/decryption operations</li>
                        <li>Compatible with all S3 features</li>
                      </ul>
                    </div>

                    {/* SSE-KMS Alternative */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '4px', borderLeft: '4px solid #666' }}>
                      <h3 style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px', fontWeight: 'bold' }}>Alternative: SSE-KMS (AWS Key Management Service)</h3>
                      <p style={{ margin: '0', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <strong>Server-Side Encryption with Customer Master Keys</strong><br/>
                        Use AWS KMS to manage your encryption keys. This gives you more control over key access, rotation, and audit logging.
                      </p>
                      <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6', color: '#333' }}>
                        <li><strong>Pros:</strong> Full control over encryption keys, audit trail, key rotation policies</li>
                        <li><strong>Cons:</strong> Additional AWS KMS costs, potential performance impact</li>
                        <li><strong>Best for:</strong> High-security requirements, compliance standards (HIPAA, PCI)</li>
                        <li><strong>How to:</strong> Change encryption settings after bucket creation → S3 bucket properties</li>
                      </ul>
                    </div>

                    {/* Comparison Table */}
                    <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: '#fafafa', borderRadius: '4px', overflow: 'x' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>Quick Comparison</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f0f0f0' }}>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Feature</th>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>SSE-S3 (Your Choice)</th>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>SSE-KMS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '8px' }}>Cost</td>
                            <td style={{ padding: '8px' }}>None</td>
                            <td style={{ padding: '8px' }}>Per API call (~$0.03/10K)</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '8px' }}>Key Management</td>
                            <td style={{ padding: '8px' }}>AWS Managed</td>
                            <td style={{ padding: '8px' }}>Customer Managed</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '8px' }}>Audit Trail</td>
                            <td style={{ padding: '8px' }}>Basic</td>
                            <td style={{ padding: '8px' }}>Full CloudTrail</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '8px' }}>Key Rotation</td>
                            <td style={{ padding: '8px' }}>Annual</td>
                            <td style={{ padding: '8px' }}>Custom</td>
                          </tr>
                          <tr style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '8px' }}>Performance</td>
                            <td style={{ padding: '8px' }}>Optimized</td>
                            <td style={{ padding: '8px' }}>Slightly slower</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '8px' }}>Best For</td>
                            <td style={{ padding: '8px' }}>Most use cases</td>
                            <td style={{ padding: '8px' }}>Compliance & control</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Note */}
                    <div style={{ padding: '12px', backgroundColor: '#fff8e6', borderRadius: '4px', borderLeft: '4px solid #ff9800' }}>
                      <p style={{ margin: '0', fontSize: '12px', lineHeight: '1.6', color: '#666' }}>
                        <strong>Note:</strong> You can change encryption settings after bucket creation anytime. Go to bucket properties → Edit default encryption to switch between SSE-S3 and SSE-KMS.
                      </p>
                    </div>
                  </div>
                  <div className={styles.cbFoot}>
                    <button type="button" className={styles.btnOrange} onClick={() => setShowEncryptionInfo(false)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Advanced settings ── */}
            <CBSection title="Advanced settings">
              <div className={styles.fieldGroup}>
                <div className={styles.fieldLabel}>Object Lock</div>
                <p className={styles.cbSectionNote}>
                  Object Lock prevents objects from being deleted or overwritten for a fixed amount of time or indefinitely.
                  Object Lock requires versioning to be enabled on your bucket.
                </p>
                <CBRadio name="olock" value="disable" checked={objectLock === 'disable'} onChange={setObjectLock} label="Disable" />
                <CBRadio name="olock" value="enable"  checked={objectLock === 'enable'}  onChange={setObjectLock} label="Enable" />
              </div>
            </CBSection>

          </div>

          {/* Footer */}
          <div className={styles.cbFoot}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnOrange} disabled={busy}>
              {busy ? 'Creating…' : 'Create bucket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UploadModal({ bucket, onClose, onUpload }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState([])
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const addFiles = (newFiles) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      const fresh = [...newFiles].filter(f => !existing.has(f.name))
      return [...prev, ...fresh]
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!files.length) return setErr('Select at least one file.')
    setBusy(true); setErr('')
    const results = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(p => { const n = [...p]; n[i] = 'uploading'; return n })
      try {
        const content = await new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res(btoa(r.result))
          r.onerror = rej
          r.readAsBinaryString(file)
        })
        await api.post(`/aws/s3/buckets/${bucket}/objects`, {
          key: file.name, content, contentType: file.type || 'application/octet-stream',
        })
        setProgress(p => { const n = [...p]; n[i] = 'done'; return n })
        results.push({ ok: true })
      } catch (ex) {
        setProgress(p => { const n = [...p]; n[i] = 'error'; return n })
        results.push({ ok: false, msg: ex.response?.data?.message || ex.message })
      }
    }
    setBusy(false)
    if (results.every(r => r.ok)) { onUpload(); onClose() }
    else setErr(`${results.filter(r => !r.ok).length} file(s) failed to upload.`)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Upload to {bucket}</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div
              className={styles.dropZone}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round"/>
                <polyline points="17 8 12 3 7 8" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div>Drag and drop or <span className={styles.dropLink}>Add files</span></div>
              <div className={styles.dropHint}>Any file type · multiple files supported</div>
              <input ref={fileRef} type="file" multiple style={{ display: 'none' }}
                onChange={e => addFiles(e.target.files)} />
            </div>

            {files.length > 0 && (
              <div className={styles.fileList}>
                <div className={styles.fileListHead}>
                  Files and folders ({files.length})
                  <button type="button" className={styles.clearBtn}
                    onClick={() => { setFiles([]); setProgress([]) }}>Remove all</button>
                </div>
                {files.map((f, i) => (
                  <div key={f.name} className={styles.fileRow}>
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                      <path d="M2 1h7l3 3v11H2V1z" stroke="#545b64" strokeWidth="1" fill="#fafafa"/>
                      <path d="M9 1v3h3" stroke="#545b64" strokeWidth="1"/>
                    </svg>
                    <span className={styles.fileName}>{f.name}</span>
                    <span className={styles.fileSize}>{formatSize(f.size)}</span>
                    {progress[i] === 'done'      && <span className={styles.statusDone}>✓</span>}
                    {progress[i] === 'error'     && <span className={styles.statusErr}>✕</span>}
                    {progress[i] === 'uploading' && <span className={styles.spinner} />}
                    {!progress[i] && (
                      <button type="button" className={styles.removeFile}
                        onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {err && <p className={styles.fieldError}>{err}</p>}
          </div>
          <div className={styles.modalFoot}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Close</button>
            <button type="submit" className={styles.btnOrange} disabled={busy || !files.length}>
              {busy ? 'Uploading…' : `Upload${files.length > 1 ? ` (${files.length})` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteModal({ title, message, subMessage, confirmText, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const go = async () => { setBusy(true); await onConfirm(); setBusy(false) }
  return (
    <div className={styles.overlay} onClick={busy ? undefined : onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>{title}</h2>
          {!busy && <button className={styles.modalClose} onClick={onClose}>✕</button>}
        </div>
        <div className={styles.modalBody}>
          {busy ? (
            <div className={styles.deleteProgress}>
              <span className={styles.spinner} />
              <div>
                <div className={styles.deleteProgressTitle}>Deleting bucket…</div>
                <div className={styles.deleteProgressSub}>Emptying objects and versions, please wait.</div>
              </div>
            </div>
          ) : (
            <>
              <p className={styles.deleteMsg}>{message}</p>
              {subMessage && <p className={styles.deleteMsgSub}>{subMessage}</p>}
            </>
          )}
        </div>
        {!busy && (
          <div className={styles.modalFoot}>
            <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.btnRed} onClick={go}>
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════
   TABS
════════════════════════════════════ */

/* ── Object URL detail panel ── */
function ObjectUrlPanel({ bucket, obj, onClose, downloadObject }) {
  const { region } = useRegion()
  const regionCode = region?.code || 'us-east-1'
  const key = obj.Key

  /* viewUrl goes through our backend which enforces Block Public Access */
  const viewUrl   = `/api/aws/s3/buckets/${bucket}/view/${key}`
  const objectUrl = `http://localhost:4566/${bucket}/${key}`
  const s3Uri     = `s3://${bucket}/${key}`
  const arn       = `arn:aws:s3:::${bucket}/${key}`
  const vhostUrl  = `https://${bucket}.s3.${regionCode}.amazonaws.com/${key}`

  /* ── public access state ── */
  const [isPublic,   setIsPublic]   = useState(null)   // null = checking, true/false = known
  const [makingPub,  setMakingPub]  = useState(false)
  const [pubMsg,     setPubMsg]     = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/public-access`)
      .then(({ data }) => {
        const c = data.config || {}
        const blocked = c.BlockPublicAcls || c.IgnorePublicAcls || c.BlockPublicPolicy || c.RestrictPublicBuckets
        setIsPublic(!blocked)
      })
      .catch(() => setIsPublic(false))
  }, [bucket])

  const makePublic = async () => {
    setMakingPub(true); setPubMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/public-access`, {
        BlockPublicAcls: false, IgnorePublicAcls: false,
        BlockPublicPolicy: false, RestrictPublicBuckets: false,
      })
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Sid: 'PublicRead', Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${bucket}/*` }],
      })
      await api.put(`/aws/s3/buckets/${bucket}/policy`, { policy })
      setIsPublic(true)
      setPubMsg({ ok: true, text: 'Bucket is now publicly readable. You can open the object URL in a browser.' })
    } catch (ex) {
      setPubMsg({ ok: false, text: ex.response?.data?.message || 'Failed to enable public access.' })
    } finally { setMakingPub(false) }
  }

  /* ── pre-signed URL ── */
  const [expires,   setExpires]   = useState('300')
  const [presigned, setPresigned] = useState('')
  const [sigBusy,   setSigBusy]   = useState(false)
  const [sigErr,    setSigErr]    = useState('')

  const generatePresigned = async () => {
    setSigBusy(true); setSigErr(''); setPresigned('')
    try {
      const { data } = await api.get(
        `/aws/s3/buckets/${bucket}/presigned/${encodeURIComponent(key)}`,
        { params: { expires } }
      )
      setPresigned(data.url)
    } catch (ex) {
      setSigErr(ex.response?.data?.message || 'Failed to generate URL.')
    } finally { setSigBusy(false) }
  }

  const rows = [
    { label: 'Object URL',          value: `http://localhost:5000${viewUrl}`, hint: 'Proxied URL — respects Block Public Access' },
    { label: 'S3 URI',              value: s3Uri,     hint: 'Use with AWS CLI and SDKs' },
    { label: 'Object ARN',          value: arn,       hint: 'Amazon Resource Name' },
    { label: 'Virtual-hosted URL',  value: vhostUrl,  hint: 'Virtual-hosted-style URL (public access must be on)' },
    { label: 'Direct (LocalStack)', value: objectUrl, hint: 'Raw LocalStack URL — does not enforce access policies' },
  ]

  return (
    <div className={styles.urlPanel}>
      <div className={styles.urlPanelHead}>
        <div className={styles.urlPanelTitle}>
          <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
            <path d="M2 1h7l3 3v11H2V1z" stroke="#0073bb" strokeWidth="1.2" fill="#e8f4fb"/>
            <path d="M9 1v3h3" stroke="#0073bb" strokeWidth="1.2" fill="none"/>
          </svg>
          {key}
        </div>
        <div className={styles.urlPanelActions}>
          {isPublic && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer"
              className={styles.openBtn}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Open in browser
            </a>
          )}
          <button className={styles.btnSecondary} style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            onClick={() => downloadObject(key)}>
            Download
          </button>
          <button className={styles.urlPanelClose} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Public access banner ── */}
      {isPublic === false && (
        <div className={styles.publicBanner}>
          <div className={styles.publicBannerLeft}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#d08700" strokeWidth="1.5"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="#d08700" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="0.5" fill="#d08700" stroke="#d08700"/>
            </svg>
            <div>
              <div className={styles.publicBannerTitle}>Object not publicly accessible</div>
              <div className={styles.publicBannerSub}>
                Block Public Access is enabled on this bucket. The Object URL cannot be opened in a browser.
                Disable public access blocking and add a public-read policy to allow browser access.
              </div>
            </div>
          </div>
          <button className={styles.btnOrange} onClick={makePublic} disabled={makingPub}
            style={{ flexShrink: 0, fontSize: '0.82rem' }}>
            {makingPub ? 'Enabling…' : 'Make public'}
          </button>
        </div>
      )}
      {isPublic === true && !pubMsg && (
        <div className={styles.publicBannerGreen}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" fill="#1d8102"/>
            <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Publicly accessible — click "Open in browser" to view the file
        </div>
      )}
      {pubMsg && (
        <div className={pubMsg.ok ? styles.publicBannerGreen : styles.errorBanner}>
          {pubMsg.text}
        </div>
      )}

      {/* URL identifiers */}
      <div className={styles.urlPanelBody}>
        <div className={styles.urlSection}>
          <div className={styles.urlSectionTitle}>Object identifiers</div>
          {rows.map(r => (
            <div key={r.label} className={styles.urlRow}>
              <div className={styles.urlRowLeft}>
                <span className={styles.urlLabel}>{r.label}</span>
                <span className={styles.urlHint}>{r.hint}</span>
              </div>
              <code className={styles.urlValue}>{r.value}</code>
              <CopyBtn value={r.value} />
            </div>
          ))}
        </div>

        {/* Pre-signed URL generator */}
        <div className={styles.urlSection}>
          <div className={styles.urlSectionTitle}>Pre-signed URL</div>
          <p className={styles.urlSectionHint}>
            Generate a temporary URL that grants time-limited access to this object without requiring AWS credentials.
          </p>
          <div className={styles.urlSignRow}>
            <label className={styles.urlExpireLabel}>Expires in</label>
            <select className={styles.fieldInput} value={expires}
              onChange={e => setExpires(e.target.value)} style={{ width: 160 }}>
              {[
                { v: '60',    l: '1 minute' },
                { v: '300',   l: '5 minutes' },
                { v: '900',   l: '15 minutes' },
                { v: '3600',  l: '1 hour' },
                { v: '86400', l: '1 day' },
                { v: '604800', l: '7 days' },
              ].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <button className={styles.btnOrange} onClick={generatePresigned} disabled={sigBusy}
              style={{ fontSize: '0.82rem' }}>
              {sigBusy ? 'Generating…' : 'Generate pre-signed URL'}
            </button>
          </div>
          {sigErr && <p className={styles.fieldError}>{sigErr}</p>}
          {presigned && (
            <div className={styles.urlRow} style={{ marginTop: 8 }}>
              <div className={styles.urlRowLeft}>
                <span className={styles.urlLabel}>Pre-signed URL</span>
                <span className={styles.urlHint}>Valid for {Number(expires) / 60 < 60 ? `${Number(expires)/60} min` : `${Number(expires)/3600} hr`}</span>
              </div>
              <code className={styles.urlValue} style={{ fontSize: '0.7rem' }}>{presigned.slice(0, 80)}…</code>
              <CopyBtn value={presigned} />
            </div>
          )}
        </div>

        {/* Object metadata */}
        <div className={styles.urlSection}>
          <div className={styles.urlSectionTitle}>Object metadata</div>
          <div className={styles.urlMeta}>
            {[
              { k: 'Key',           v: obj.Key },
              { k: 'Size',          v: formatSize(obj.Size) },
              { k: 'Last modified', v: formatDate(obj.LastModified) },
              { k: 'Storage class', v: obj.StorageClass || 'STANDARD' },
              { k: 'ETag',          v: obj.ETag ? obj.ETag.replace(/"/g, '') : '—' },
              { k: 'Content type',  v: obj.Key.includes('.') ? `application/${obj.Key.split('.').pop()}` : 'application/octet-stream' },
            ].map(m => (
              <div key={m.k} className={styles.urlMetaRow}>
                <span className={styles.urlMetaKey}>{m.k}</span>
                <span className={styles.urlMetaVal}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ObjectsTab({ bucket, objects, loading, error, objectSearch, setObjectSearch,
  selObjects, toggleObject, toggleAllObjects, loadObjects, setShowUpload,
  setDeleteTarget, downloadObject, showVersions, setShowVersions, versions }) {

  const [selectedObj, setSelectedObj] = useState(null)

  const filtered = objectSearch
    ? objects.filter(o => o.Key.toLowerCase().includes(objectSearch.toLowerCase()))
    : objects

  const filteredVersions = objectSearch
    ? versions.filter(v => v.Key.toLowerCase().includes(objectSearch.toLowerCase()))
    : versions

  const displayList = showVersions ? filteredVersions : filtered

  return (
    <>
      <div className={styles.tabActions}>
        <div className={styles.tabActionsLeft}>
          <button className={styles.btnOrange} onClick={() => setShowUpload(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Upload
          </button>
          <button
            className={styles.btnSecondary}
            disabled={selObjects.size === 0}
            onClick={() => setDeleteTarget({ type: 'object', names: [...selObjects] })}
          >Delete</button>
          <button
            className={styles.btnSecondary}
            disabled={selObjects.size !== 1}
            onClick={() => downloadObject([...selObjects][0])}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Download
          </button>
        </div>
        <div className={styles.tabActionsRight}>
          <button
            className={`${styles.btnToggle} ${showVersions ? styles.btnToggleOn : ''}`}
            onClick={() => setShowVersions(v => !v)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
              <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="21 3 21 9 15 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {showVersions ? 'Hide versions' : 'Show versions'}
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableToolbar}>
          <span className={styles.tableCount}>
            {showVersions ? 'Versions' : 'Objects'} ({displayList.length}
            {selObjects.size > 0 && ` · ${selObjects.size} selected`})
          </span>
          <div className={styles.tableSearch}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="#545b64" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input placeholder="Find objects by prefix" value={objectSearch}
              onChange={e => setObjectSearch(e.target.value)} />
          </div>
          <button className={styles.refreshBtn} onClick={() => loadObjects(bucket)} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCheck}>
                <input type="checkbox"
                  checked={selObjects.size === filtered.length && filtered.length > 0}
                  onChange={toggleAllObjects} />
              </th>
              <th>Name</th>
              {showVersions && <th>Version ID</th>}
              {showVersions && <th>Latest</th>}
              <th>Type</th>
              <th>Last modified</th>
              <th>Size</th>
              {!showVersions && <th>Storage class</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={showVersions ? 8 : 7} className={styles.tdCenter}>
                <span className={styles.spinner} /> Loading…
              </td></tr>
            )}
            {!loading && displayList.length === 0 && (
              <tr><td colSpan={showVersions ? 8 : 7} className={styles.tdEmpty}>
                {objectSearch
                  ? 'No objects match your prefix.'
                  : showVersions
                    ? 'No versions found. Enable versioning and upload objects.'
                    : 'This bucket is empty. Upload files to get started.'}
              </td></tr>
            )}
            {displayList.map((o, idx) => {
              const key = o.Key
              const isDeleteMarker = !!o.IsDeleteMarker
              return (
                <tr key={`${key}-${o.VersionId || idx}`}
                  className={`${selObjects.has(key) ? styles.trSelected : ''} ${isDeleteMarker ? styles.trDeleteMarker : ''}`}
                  onClick={() => !isDeleteMarker && toggleObject(key)}>
                  <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                    {!isDeleteMarker && (
                      <input type="checkbox" checked={selObjects.has(key)}
                        onChange={() => toggleObject(key)} />
                    )}
                  </td>
                  <td>
                    <div className={styles.objectName}>
                      {isDeleteMarker
                        ? <span className={styles.deleteMarkerIcon}>⊘</span>
                        : <svg width="14" height="16" viewBox="0 0 14 16" fill="none">
                            <path d="M2 1h7l3 3v11H2V1z" stroke="#545b64" strokeWidth="1" fill="#fafafa"/>
                            <path d="M9 1v3h3" stroke="#545b64" strokeWidth="1"/>
                          </svg>
                      }
                      {isDeleteMarker
                        ? <span className={styles.deletedKey}>{key}</span>
                        : <button
                            className={styles.objNameLink}
                            onClick={e => { e.stopPropagation(); setSelectedObj(o) }}
                          >{key}</button>
                      }
                    </div>
                  </td>
                  {showVersions && <td className={styles.versionId}>{o.VersionId?.slice(0, 12) || '—'}</td>}
                  {showVersions && (
                    <td>
                      {o.IsLatest
                        ? <span className={styles.latestBadge}>Latest</span>
                        : <span className={styles.oldBadge}>Old</span>}
                    </td>
                  )}
                  <td>{isDeleteMarker ? <span className={styles.deleteMarkerBadge}>Delete marker</span> : fileExt(key)}</td>
                  <td>{formatDate(o.LastModified)}</td>
                  <td>{isDeleteMarker ? '—' : formatSize(o.Size)}</td>
                  {!showVersions && <td>Standard</td>}
                  <td onClick={e => e.stopPropagation()}>
                    {!isDeleteMarker && (
                      <button className={styles.inlineDownload} title="Download"
                        onClick={() => downloadObject(key)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#0073bb" strokeWidth="2" strokeLinecap="round"/>
                          <polyline points="7 10 12 15 17 10" stroke="#0073bb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="12" y1="15" x2="12" y2="3" stroke="#0073bb" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Object URL panel */}
      {selectedObj && (
        <ObjectUrlPanel
          bucket={bucket}
          obj={selectedObj}
          onClose={() => setSelectedObj(null)}
          downloadObject={downloadObject}
        />
      )}
    </>
  )
}

function PropertiesTab({ bucket, versioningStatus, setVersioningStatus, scrollTo }) {
  /* scroll to the section requested by the nav */
  useEffect(() => {
    if (!scrollTo) return
    const el = document.getElementById(`prop-${scrollTo.toLowerCase()}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])

  /* ── versioning ── */
  const [vBusy, setVBusy] = useState(false)
  const [vMsg,  setVMsg]  = useState(null)

  /* ── tags ── */
  const [tags,     setTags]     = useState([])
  const [tagEdit,  setTagEdit]  = useState(false)
  const [tagDraft, setTagDraft] = useState([])
  const [tagBusy,  setTagBusy]  = useState(false)
  const [tagMsg,   setTagMsg]   = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/tags`)
      .then(({ data }) => { const t = (data.TagSet || []).map(x => ({ key: x.Key, value: x.Value })); setTags(t); setTagDraft(t) })
      .catch(() => {})
  }, [bucket])

  const saveTags = async () => {
    setTagBusy(true); setTagMsg(null)
    try {
      const valid = tagDraft.filter(t => t.key.trim())
      await api.put(`/aws/s3/buckets/${bucket}/tags`, { tags: valid })
      setTags(valid); setTagEdit(false)
      setTagMsg({ type: 'success', text: 'Tags saved.' })
    } catch (ex) {
      setTagMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save tags.' })
    } finally { setTagBusy(false) }
  }

  /* ── ownership ── */
  const OWN_LABELS = { BucketOwnerEnforced: 'Bucket owner enforced (ACLs disabled)', BucketOwnerPreferred: 'Bucket owner preferred', ObjectWriter: 'Object writer' }
  const [own,     setOwn]     = useState('BucketOwnerEnforced')
  const [ownEdit, setOwnEdit] = useState(false)
  const [ownDraft,setOwnDraft]= useState('BucketOwnerEnforced')
  const [ownBusy, setOwnBusy] = useState(false)
  const [ownMsg,  setOwnMsg]  = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/ownership`)
      .then(({ data }) => { setOwn(data.rule); setOwnDraft(data.rule) })
      .catch(() => {})
  }, [bucket])

  const saveOwn = async () => {
    setOwnBusy(true); setOwnMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/ownership`, { rule: ownDraft })
      setOwn(ownDraft); setOwnEdit(false)
      setOwnMsg({ type: 'success', text: 'Ownership updated.' })
    } catch (ex) {
      setOwnMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save.' })
    } finally { setOwnBusy(false) }
  }

  /* ── object lock ── */
  const [lock,     setLock]     = useState({ ObjectLockEnabled: 'Disabled' })
  const [lockEdit, setLockEdit] = useState(false)
  const [lockMode, setLockMode] = useState('GOVERNANCE')
  const [lockDays, setLockDays] = useState('')
  const [lockBusy, setLockBusy] = useState(false)
  const [lockMsg,  setLockMsg]  = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/object-lock`)
      .then(({ data }) => { setLock(data.config || { ObjectLockEnabled: 'Disabled' }) })
      .catch(() => {})
  }, [bucket])

  const saveLock = async () => {
    setLockBusy(true); setLockMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/object-lock`, { mode: lockMode, days: lockDays || undefined })
      const updated = { ObjectLockEnabled: 'Enabled', Rule: { DefaultRetention: { Mode: lockMode, Days: Number(lockDays) } } }
      setLock(updated); setLockEdit(false)
      setLockMsg({ type: 'success', text: 'Object Lock configured.' })
    } catch (ex) {
      setLockMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to configure Object Lock.' })
    } finally { setLockBusy(false) }
  }

  const toggleVersioning = async () => {
    const next = versioningStatus === 'Enabled' ? 'Suspended' : 'Enabled'
    setVBusy(true); setVMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/versioning`, { status: next })
      setVersioningStatus(next)
      setVMsg({ type: 'success', text: `Versioning ${next === 'Enabled' ? 'enabled' : 'suspended'}.` })
    } catch (ex) {
      setVMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to update versioning.' })
    } finally { setVBusy(false) }
  }

  const vColor = {
    Enabled:   { background: '#f0fae6', color: '#1d6b0b', border: '1px solid #b3d99e' },
    Suspended: { background: '#fff8e6', color: '#8a6116', border: '1px solid #f0c060' },
    Disabled:  { background: '#f2f3f3', color: '#545b64', border: '1px solid #d5dbdb' },
  }[versioningStatus] || {}

  /* ── encryption ── */
  const [enc,     setEnc]     = useState({ algorithm: 'AES256', bucketKeyEnabled: true })
  const [encEdit, setEncEdit] = useState(false)
  const [encDraft,setEncDraft]= useState(enc)
  const [encBusy, setEncBusy] = useState(false)
  const [encMsg,  setEncMsg]  = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/encryption`)
      .then(({ data }) => { setEnc(data); setEncDraft(data) })
      .catch(() => {})
  }, [bucket])

  const saveEnc = async () => {
    setEncBusy(true); setEncMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/encryption`, encDraft)
      setEnc(encDraft); setEncEdit(false)
      setEncMsg({ type: 'success', text: 'Encryption settings saved.' })
    } catch (ex) {
      setEncMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save.' })
    } finally { setEncBusy(false) }
  }

  /* ── website hosting ── */
  const [site,     setSite]     = useState({ enabled: false, indexDocument: 'index.html', errorDocument: 'error.html' })
  const [siteEdit, setSiteEdit] = useState(false)
  const [siteDraft,setSiteDraft]= useState(site)
  const [siteBusy, setSiteBusy] = useState(false)
  const [siteMsg,  setSiteMsg]  = useState(null)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/website`)
      .then(({ data }) => { setSite(data); setSiteDraft(data) })
      .catch(() => {})
  }, [bucket])

  const saveSite = async () => {
    setSiteBusy(true); setSiteMsg(null)
    try {
      if (siteDraft.enabled) {
        await api.put(`/aws/s3/buckets/${bucket}/website`, siteDraft)
        setSite({ ...siteDraft, enabled: true })
      } else {
        await api.delete(`/aws/s3/buckets/${bucket}/website`)
        setSite({ ...siteDraft, enabled: false })
      }
      setSiteEdit(false)
      setSiteMsg({ type: 'success', text: `Static website hosting ${siteDraft.enabled ? 'enabled' : 'disabled'}.` })
    } catch (ex) {
      setSiteMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save.' })
    } finally { setSiteBusy(false) }
  }

  return (
    <div className={styles.tabContent}>

      {/* ── Versioning ── */}
      <div id="prop-versioning" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Bucket Versioning</h3>
          <button className={styles.editBtn} onClick={toggleVersioning} disabled={vBusy}>
            {vBusy ? 'Saving…' : versioningStatus === 'Enabled' ? 'Suspend' : 'Enable'}
          </button>
        </div>
        <div className={styles.propBody}>
          <div className={styles.propRow}>
            <span className={styles.propKey}>Status</span>
            <span className={styles.statusBadge} style={vColor}>{versioningStatus}</span>
          </div>
          <p className={styles.propHint}>
            Keep multiple variants of every object. Use it to preserve, retrieve, and restore
            every version of every object stored in this bucket.
          </p>
          {vMsg && <div className={vMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{vMsg.text}</div>}
        </div>
      </div>

      {/* ── Default Encryption ── */}
      <div id="prop-encryption" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Default encryption</h3>
          {!encEdit
            ? <button className={styles.editBtn} onClick={() => { setEncDraft(enc); setEncEdit(true); setEncMsg(null) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setEncEdit(false); setEncMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveEnc} disabled={encBusy}>{encBusy ? 'Saving…' : 'Save changes'}</button>
              </div>
          }
        </div>
        <div className={styles.propBody}>
          {!encEdit ? (
            <>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Encryption type</span>
                <span>{enc.algorithm === 'AES256' ? 'SSE-S3 — Amazon S3 managed keys' : 'SSE-KMS — AWS KMS keys'}</span>
              </div>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Bucket key</span>
                <span>{enc.bucketKeyEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Encryption type</label>
                {[
                  { value: 'AES256', label: 'SSE-S3', sub: 'Server-side encryption with Amazon S3 managed keys' },
                  { value: 'aws:kms', label: 'SSE-KMS', sub: 'Server-side encryption with AWS Key Management Service keys' },
                ].map(opt => (
                  <label key={opt.value} className={styles.radioRow}>
                    <input type="radio" name="encAlgo" value={opt.value}
                      checked={encDraft.algorithm === opt.value}
                      onChange={() => setEncDraft(d => ({ ...d, algorithm: opt.value }))}
                      style={{ accentColor: '#0073bb' }} />
                    <div>
                      <div className={styles.radioLabel}>{opt.label}</div>
                      <div className={styles.radioSub}>{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bucket key</label>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={encDraft.bucketKeyEnabled}
                    onChange={e => setEncDraft(d => ({ ...d, bucketKeyEnabled: e.target.checked }))}
                    style={{ accentColor: '#0073bb' }} />
                  <span>Enable bucket key — reduces cost of SSE-KMS encryption</span>
                </label>
              </div>
            </>
          )}
          {encMsg && <div className={encMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{encMsg.text}</div>}
        </div>
      </div>

      {/* ── Static Website Hosting ── */}
      <div id="prop-website" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Static website hosting</h3>
          {!siteEdit
            ? <button className={styles.editBtn} onClick={() => { setSiteDraft(site); setSiteEdit(true); setSiteMsg(null) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setSiteEdit(false); setSiteMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveSite} disabled={siteBusy}>{siteBusy ? 'Saving…' : 'Save changes'}</button>
              </div>
          }
        </div>
        <div className={styles.propBody}>
          {!siteEdit ? (
            <>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Status</span>
                <span className={styles.statusBadge}
                  style={site.enabled
                    ? { background: '#f0fae6', color: '#1d6b0b', border: '1px solid #b3d99e' }
                    : { background: '#f2f3f3', color: '#545b64', border: '1px solid #d5dbdb' }}>
                  {site.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {site.enabled && (
                <>
                  <div className={styles.propRow}>
                    <span className={styles.propKey}>Index document</span>
                    <code className={styles.prefixCode}>{site.indexDocument}</code>
                  </div>
                  <div className={styles.propRow}>
                    <span className={styles.propKey}>Error document</span>
                    <code className={styles.prefixCode}>{site.errorDocument}</code>
                  </div>
                  <div className={styles.propRow}>
                    <span className={styles.propKey}>Endpoint</span>
                    <span className={styles.websiteUrl}>
                      http://{bucket}.s3-website-us-east-1.amazonaws.com
                    </span>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Static website hosting</label>
                <div className={styles.toggleRow}>
                  {[['Enable', true], ['Disable', false]].map(([label, val]) => (
                    <button key={label} type="button"
                      className={`${styles.toggleBtn} ${siteDraft.enabled === val ? styles.toggleOn : ''}`}
                      onClick={() => setSiteDraft(d => ({ ...d, enabled: val }))}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {siteDraft.enabled && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Index document</label>
                    <input className={styles.fieldInput} value={siteDraft.indexDocument}
                      onChange={e => setSiteDraft(d => ({ ...d, indexDocument: e.target.value }))}
                      placeholder="index.html" style={{ maxWidth: 280 }} />
                    <p className={styles.fieldHint}>The home page or default page for the website</p>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Error document <span className={styles.optLabel}>(optional)</span></label>
                    <input className={styles.fieldInput} value={siteDraft.errorDocument}
                      onChange={e => setSiteDraft(d => ({ ...d, errorDocument: e.target.value }))}
                      placeholder="error.html" style={{ maxWidth: 280 }} />
                  </div>
                </>
              )}
            </>
          )}
          {siteMsg && <div className={siteMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{siteMsg.text}</div>}
        </div>
      </div>

      {/* ── Tags ── */}
      <div id="prop-tags" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Tags ({tags.length})</h3>
          {!tagEdit
            ? <button className={styles.editBtn} onClick={() => { setTagDraft([...tags]); setTagEdit(true); setTagMsg(null) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setTagEdit(false); setTagMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveTags} disabled={tagBusy}>{tagBusy ? 'Saving…' : 'Save changes'}</button>
              </div>}
        </div>
        <div className={styles.propBody}>
          {!tagEdit ? (
            tags.length === 0
              ? <p className={styles.propHint}>No tags. Tags help you identify, organize, and manage this bucket.</p>
              : <table className={styles.table} style={{ fontSize: '0.82rem' }}>
                  <thead><tr><th>Key</th><th>Value</th></tr></thead>
                  <tbody>{tags.map((t, i) => <tr key={i}><td>{t.key}</td><td>{t.value}</td></tr>)}</tbody>
                </table>
          ) : (
            <div className={styles.propTagEditor}>
              {tagDraft.length > 0 && (
                <div className={styles.cbTagTable}>
                  <div className={styles.cbTagHead}><span>Key</span><span>Value</span><span /></div>
                  {tagDraft.map((t, i) => (
                    <div key={i} className={styles.cbTagRow}>
                      <input className={styles.fieldInput} value={t.key} placeholder="Key"
                        onChange={e => setTagDraft(p => p.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} />
                      <input className={styles.fieldInput} value={t.value} placeholder="Value"
                        onChange={e => setTagDraft(p => p.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} />
                      <button type="button" className={styles.cbTagRemove}
                        onClick={() => setTagDraft(p => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className={styles.cbAddTagBtn}
                onClick={() => setTagDraft(p => [...p, { key: '', value: '' }])}>+ Add tag</button>
            </div>
          )}
          {tagMsg && <div className={tagMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{tagMsg.text}</div>}
        </div>
      </div>

      {/* ── Object Ownership ── */}
      <div id="prop-ownership" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Object Ownership</h3>
          {!ownEdit
            ? <button className={styles.editBtn} onClick={() => { setOwnDraft(own); setOwnEdit(true); setOwnMsg(null) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setOwnEdit(false); setOwnMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveOwn} disabled={ownBusy}>{ownBusy ? 'Saving…' : 'Save changes'}</button>
              </div>}
        </div>
        <div className={styles.propBody}>
          {!ownEdit ? (
            <div className={styles.propRow}>
              <span className={styles.propKey}>Ownership</span>
              <span>{OWN_LABELS[own] || own}</span>
            </div>
          ) : (
            <div className={styles.fieldGroup}>
              {Object.entries(OWN_LABELS).map(([val, label]) => (
                <label key={val} className={styles.radioRow}>
                  <input type="radio" name="ownership" value={val} checked={ownDraft === val}
                    onChange={() => setOwnDraft(val)} style={{ accentColor: '#0073bb' }} />
                  <div>
                    <div className={styles.radioLabel}>{label}</div>
                    <div className={styles.radioSub}>{
                      val === 'BucketOwnerEnforced' ? 'All access controlled by policies. ACLs are disabled.' :
                      val === 'BucketOwnerPreferred' ? 'Objects uploaded with bucket-owner-full-control ACL are owned by the bucket owner.' :
                      'The uploading account owns each object. ACLs are used to grant access.'
                    }</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {ownMsg && <div className={ownMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{ownMsg.text}</div>}
        </div>
      </div>

      {/* ── Object Lock ── */}
      <div id="prop-objectlock" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Object Lock</h3>
          {lock.ObjectLockEnabled === 'Enabled' && !lockEdit &&
            <button className={styles.editBtn} onClick={() => { setLockEdit(true); setLockMsg(null) }}>Configure retention</button>}
          {lockEdit &&
            <div className={styles.editBtnGroup}>
              <button className={styles.btnSecondary} onClick={() => { setLockEdit(false); setLockMsg(null) }}>Cancel</button>
              <button className={styles.btnOrange} onClick={saveLock} disabled={lockBusy}>{lockBusy ? 'Saving…' : 'Save changes'}</button>
            </div>}
        </div>
        <div className={styles.propBody}>
          <div className={styles.propRow}>
            <span className={styles.propKey}>Status</span>
            <span className={styles.statusBadge}
              style={lock.ObjectLockEnabled === 'Enabled'
                ? { background: '#f0fae6', color: '#1d6b0b', border: '1px solid #b3d99e' }
                : { background: '#f2f3f3', color: '#545b64', border: '1px solid #d5dbdb' }}>
              {lock.ObjectLockEnabled === 'Enabled' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {lock.ObjectLockEnabled === 'Enabled' && lock.Rule && !lockEdit && (
            <>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Retention mode</span>
                <span>{lock.Rule.DefaultRetention?.Mode || '—'}</span>
              </div>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Retention period</span>
                <span>{lock.Rule.DefaultRetention?.Days ? `${lock.Rule.DefaultRetention.Days} days` : lock.Rule.DefaultRetention?.Years ? `${lock.Rule.DefaultRetention.Years} years` : '—'}</span>
              </div>
            </>
          )}
          {lockEdit && (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Retention mode</label>
              {[{ v: 'GOVERNANCE', l: 'Governance', s: 'Users with special permissions can overwrite or delete protected objects.' },
                { v: 'COMPLIANCE', l: 'Compliance', s: 'No user, including the root account, can overwrite or delete a protected object.' }].map(opt => (
                <label key={opt.v} className={styles.radioRow}>
                  <input type="radio" name="lockMode" value={opt.v} checked={lockMode === opt.v}
                    onChange={() => setLockMode(opt.v)} style={{ accentColor: '#0073bb' }} />
                  <div>
                    <div className={styles.radioLabel}>{opt.l}</div>
                    <div className={styles.radioSub}>{opt.s}</div>
                  </div>
                </label>
              ))}
              <label className={styles.fieldLabel} style={{ marginTop: 8 }}>Retention period (days)</label>
              <input className={styles.fieldInput} type="number" min="1" value={lockDays}
                onChange={e => setLockDays(e.target.value)} placeholder="e.g. 365" style={{ maxWidth: 160 }} />
            </div>
          )}
          {lock.ObjectLockEnabled !== 'Enabled' && (
            <p className={styles.propHint}>Object Lock must be enabled at bucket creation time. Create a new bucket with Object Lock enabled to use this feature.</p>
          )}
          {lockMsg && <div className={lockMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{lockMsg.text}</div>}
        </div>
      </div>

    </div>
  )
}

const BLOCK_FIELDS = [
  { key: 'BlockPublicAcls',       label: 'Block public access granted through new ACLs',
    sub: 'S3 will block new public ACLs and uploading objects with public ACLs.' },
  { key: 'IgnorePublicAcls',      label: 'Block public access granted through any ACLs',
    sub: 'S3 will ignore all public ACLs on this bucket and objects in this bucket.' },
  { key: 'BlockPublicPolicy',     label: 'Block public access granted through new public bucket policies',
    sub: 'S3 will block new public bucket policies.' },
  { key: 'RestrictPublicBuckets', label: 'Block public and cross-account access granted through any public policies',
    sub: 'S3 will ignore public and cross-account access for this bucket and objects.' },
]

function PermissionsTab({ bucket, policy, setPolicy, scrollTo }) {
  useEffect(() => {
    if (!scrollTo) return
    document.getElementById(`perm-${scrollTo.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])
  /* ── Block Public Access ── */
  const DEFAULT_BLOCK = { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true }
  const [block,     setBlock]     = useState(DEFAULT_BLOCK)
  const [blockEdit, setBlockEdit] = useState(false)
  const [blockDraft,setBlockDraft]= useState(DEFAULT_BLOCK)
  const [blockBusy, setBlockBusy] = useState(false)
  const [blockMsg,  setBlockMsg]  = useState(null)
  const [showWarn,  setShowWarn]  = useState(false)

  useEffect(() => {
    api.get(`/aws/s3/buckets/${bucket}/public-access`)
      .then(({ data }) => {
        const cfg = { ...DEFAULT_BLOCK, ...data.config }
        setBlock(cfg); setBlockDraft(cfg)
      }).catch(() => {})
  }, [bucket])

  const allBlocked = Object.values(blockDraft).every(Boolean)
  const toggleAll  = (v) => setBlockDraft({ BlockPublicAcls: v, IgnorePublicAcls: v, BlockPublicPolicy: v, RestrictPublicBuckets: v })

  const saveBlock = async () => {
    const turningPublic = Object.values(blockDraft).some(v => !v)
    if (turningPublic && !showWarn) { setShowWarn(true); return }
    setBlockBusy(true); setBlockMsg(null); setShowWarn(false)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/public-access`, blockDraft)
      setBlock(blockDraft); setBlockEdit(false)
      setBlockMsg({ type: 'success', text: 'Public access settings saved.' })
    } catch (ex) {
      setBlockMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save.' })
    } finally { setBlockBusy(false) }
  }

  /* ── Bucket Policy ── */
  const [draft, setDraft] = useState(policy)
  const [busy, setBusy]   = useState(false)
  const [msg,  setMsg]    = useState(null)
  useEffect(() => { setDraft(policy) }, [policy])

  const save = async () => {
    setMsg(null)
    try { JSON.parse(draft) } catch { return setMsg({ type: 'error', text: 'Invalid JSON — fix syntax errors before saving.' }) }
    setBusy(true)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/policy`, { policy: draft })
      setPolicy(draft)
      setMsg({ type: 'success', text: 'Policy saved successfully.' })
    } catch (ex) {
      setMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save policy.' })
    } finally { setBusy(false) }
  }

  const remove = async () => {
    setBusy(true); setMsg(null)
    try {
      await api.delete(`/aws/s3/buckets/${bucket}/policy`)
      setPolicy(''); setDraft('')
      setMsg({ type: 'success', text: 'Policy deleted.' })
    } catch (ex) {
      setMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to delete policy.' })
    } finally { setBusy(false) }
  }

  const allBlockedSaved = Object.values(block).every(Boolean)

  return (
    <div className={styles.tabContent}>

      {/* ── Block Public Access ── */}
      <div id="perm-blockaccess" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Block Public Access (bucket settings)</h3>
          {!blockEdit
            ? <button className={styles.editBtn} onClick={() => { setBlockDraft(block); setBlockEdit(true); setBlockMsg(null); setShowWarn(false) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setBlockEdit(false); setShowWarn(false); setBlockMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveBlock} disabled={blockBusy}>{blockBusy ? 'Saving…' : 'Save changes'}</button>
              </div>
          }
        </div>
        <div className={styles.propBody}>
          {!blockEdit ? (
            <>
              {/* Read-only view */}
              <label className={`${styles.checkRow} ${styles.masterCheck}`}>
                <input type="checkbox" checked={allBlockedSaved} readOnly style={{ accentColor: '#0073bb' }} />
                <span className={styles.masterLabel}>Block all public access</span>
                {allBlockedSaved
                  ? <span className={styles.publicBadgeOn}>On</span>
                  : <span className={styles.publicBadgeOff}>Off</span>}
              </label>
              <div className={styles.subChecks}>
                {BLOCK_FIELDS.map(f => (
                  <label key={f.key} className={styles.checkRow}>
                    <input type="checkbox" checked={!!block[f.key]} readOnly style={{ accentColor: '#0073bb' }} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Editable form */}
              <label className={`${styles.checkRow} ${styles.masterCheck}`}>
                <input type="checkbox" checked={allBlocked}
                  onChange={e => toggleAll(e.target.checked)}
                  style={{ accentColor: '#0073bb' }} />
                <span className={styles.masterLabel}>Block <em>all</em> public access</span>
              </label>
              <p className={styles.propHint} style={{ marginLeft: 24 }}>
                Turning this on enables all four settings below.
              </p>
              <div className={styles.subChecks}>
                {BLOCK_FIELDS.map(f => (
                  <label key={f.key} className={styles.checkRowEdit}>
                    <input type="checkbox" checked={!!blockDraft[f.key]}
                      onChange={e => setBlockDraft(d => ({ ...d, [f.key]: e.target.checked }))}
                      style={{ accentColor: '#0073bb' }} />
                    <div>
                      <div className={styles.checkLabel}>{f.label}</div>
                      <div className={styles.checkSub}>{f.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              {showWarn && (
                <div className={styles.warnBox}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#d08700" strokeWidth="1.5" fill="#fff8e6"/>
                    <line x1="12" y1="9" x2="12" y2="13" stroke="#d08700" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="12" y1="17" x2="12.01" y2="17" stroke="#d08700" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <div>
                    <strong>Turning off Block Public Access may allow public access to your data.</strong>
                    <p>Click "Save changes" again to confirm.</p>
                  </div>
                </div>
              )}
            </>
          )}
          {blockMsg && <div className={blockMsg.type === 'success' ? styles.successMsg : styles.errorMsg}>{blockMsg.text}</div>}
        </div>
      </div>

      {/* ── Bucket Policy ── */}
      <div id="perm-policy" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Bucket policy</h3>
          <div className={styles.propHeadActions}>
            <button className={styles.linkBtn}
              onClick={() => setDraft(DEFAULT_POLICY(bucket))}>
              Load template
            </button>
            <button className={styles.linkBtn}
              onClick={() => setDraft('')}>
              Clear
            </button>
          </div>
        </div>
        <div className={styles.propBody}>
          <p className={styles.propHint}>
            A bucket policy is a resource-based policy that you use to grant access permissions
            to the bucket and the objects in it.
          </p>
          <textarea
            className={styles.policyEditor}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            spellCheck={false}
            placeholder={`{\n  "Version": "2012-10-17",\n  "Statement": []\n}`}
          />
          {msg && (
            <div className={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>
              {msg.text}
            </div>
          )}
          <div className={styles.propActions}>
            <button className={styles.btnRed} onClick={remove} disabled={busy || !policy}>
              Delete policy
            </button>
            <button className={styles.btnOrange} onClick={save}
              disabled={busy || draft === policy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════
   MAIN S3 CONSOLE
════════════════════════════════════ */
/* ════════════════════════════════════
   METRICS TAB
════════════════════════════════════ */
function MetricsTab({ objects, bucket }) {
  const totalObjects = objects.length
  const totalBytes   = objects.reduce((s, o) => s + (o.Size || 0), 0)
  const avgBytes     = totalObjects ? Math.round(totalBytes / totalObjects) : 0

  // group by extension
  const byExt = {}
  objects.forEach(o => {
    const ext = o.Key.includes('.') ? o.Key.split('.').pop().toUpperCase() : 'OTHER'
    if (!byExt[ext]) byExt[ext] = { count: 0, size: 0 }
    byExt[ext].count++
    byExt[ext].size += o.Size || 0
  })
  const extRows = Object.entries(byExt)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 8)
  const maxExtSize = extRows[0]?.[1].size || 1

  // top 5 by size
  const topObjects = [...objects].sort((a, b) => (b.Size || 0) - (a.Size || 0)).slice(0, 5)

  // recent uploads
  const recent = [...objects]
    .filter(o => o.LastModified)
    .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
    .slice(0, 5)

  const barColors = ['#0073bb', '#1a9c3e', '#d08700', '#c7131f', '#8a2be2', '#00838f', '#e91e8c', '#546e7a']

  return (
    <div className={styles.tabContent}>

      {/* Stat cards */}
      <div className={styles.metricCards}>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#e8f4fb' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="#0073bb" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.metricValue}>{totalObjects.toLocaleString()}</div>
          <div className={styles.metricLabel}>Total objects</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#f0fae6' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <ellipse cx="12" cy="5" rx="9" ry="3" stroke="#1a9c3e" strokeWidth="1.8"/>
              <path d="M3 5v6c0 1.657 4.03 3 9 3s9-1.343 9-3V5" stroke="#1a9c3e" strokeWidth="1.8"/>
              <path d="M3 11v6c0 1.657 4.03 3 9 3s9-1.343 9-3v-6" stroke="#1a9c3e" strokeWidth="1.8"/>
            </svg>
          </div>
          <div className={styles.metricValue}>{formatSize(totalBytes)}</div>
          <div className={styles.metricLabel}>Total storage used</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#fff8e6' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="#d08700" strokeWidth="1.8"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="#d08700" strokeWidth="1.8"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="#d08700" strokeWidth="1.8"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="#d08700" strokeWidth="1.8"/>
            </svg>
          </div>
          <div className={styles.metricValue}>{Object.keys(byExt).length}</div>
          <div className={styles.metricLabel}>File types</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricIcon} style={{ background: '#f3eefb' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 20V10M6 20V4M18 20v-6" stroke="#8a2be2" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <div className={styles.metricValue}>{formatSize(avgBytes)}</div>
          <div className={styles.metricLabel}>Average object size</div>
        </div>
      </div>

      {totalObjects === 0 ? (
        <div className={styles.metricsEmpty}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M12 20V10M6 20V4M18 20v-6" stroke="#aab7c4" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>No data yet — upload objects to see metrics.</p>
        </div>
      ) : (
        <div className={styles.metricsRow}>

          {/* Storage by file type */}
          <div className={styles.metricsPanel}>
            <div className={styles.metricsPanelHead}>
              <span>Storage by file type</span>
            </div>
            <div className={styles.metricsPanelBody}>
              {extRows.map(([ext, info], i) => (
                <div key={ext} className={styles.barRow}>
                  <span className={styles.barLabel}>{ext}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.max(2, (info.size / maxExtSize) * 100)}%`,
                        background: barColors[i % barColors.length],
                      }}
                    />
                  </div>
                  <span className={styles.barCount}>{info.count} obj</span>
                  <span className={styles.barSize}>{formatSize(info.size)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Largest objects */}
          <div className={styles.metricsPanel}>
            <div className={styles.metricsPanelHead}>
              <span>Largest objects</span>
            </div>
            <div className={styles.metricsPanelBody}>
              {topObjects.length === 0
                ? <p className={styles.metricsNone}>No objects</p>
                : topObjects.map((o, i) => (
                  <div key={o.Key} className={styles.topRow}>
                    <span className={styles.topRank}>{i + 1}</span>
                    <span className={styles.topKey}>{o.Key}</span>
                    <span className={styles.topSize}>{formatSize(o.Size)}</span>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      )}

      {/* Recent uploads */}
      {recent.length > 0 && (
        <div className={styles.metricsPanel} style={{ marginTop: 0 }}>
          <div className={styles.metricsPanelHead}><span>Recent uploads</span></div>
          <table className={styles.table} style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Last modified</th>
                <th>Storage class</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(o => (
                <tr key={o.Key}>
                  <td>{o.Key}</td>
                  <td>{formatSize(o.Size)}</td>
                  <td>{formatDate(o.LastModified)}</td>
                  <td>Standard</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════
   MANAGEMENT TAB
════════════════════════════════════ */
const STORAGE_CLASSES = ['STANDARD_IA', 'ONEZONE_IA', 'INTELLIGENT_TIERING', 'GLACIER', 'DEEP_ARCHIVE']

function CreateRuleModal({ onClose, onSave }) {
  const [id,         setId]         = useState(`rule-${Date.now()}`)
  const [prefix,     setPrefix]     = useState('')
  const [expDays,    setExpDays]    = useState('')
  const [transition, setTransition] = useState(false)
  const [transDays,  setTransDays]  = useState('30')
  const [transClass, setTransClass] = useState('STANDARD_IA')
  const [status,     setStatus]     = useState('Enabled')
  const [err,        setErr]        = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!id.trim()) return setErr('Rule ID is required.')
    if (!expDays && !transition) return setErr('Set at least one action (expiration or transition).')
    if (expDays && (isNaN(expDays) || +expDays < 1)) return setErr('Expiration must be a positive number.')
    if (transition && (isNaN(transDays) || +transDays < 1)) return setErr('Transition days must be a positive number.')

    const rule = {
      ID: id.trim(),
      Status: status,
      Filter: { Prefix: prefix.trim() },
      ...(expDays ? { Expiration: { Days: +expDays } } : {}),
      ...(transition ? { Transitions: [{ Days: +transDays, StorageClass: transClass }] } : {}),
    }
    onSave(rule)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <h2 className={styles.modalTitle}>Create lifecycle rule</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit}>
          <div className={styles.modalBody}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Rule name <span className={styles.req}>*</span></label>
              <input className={styles.fieldInput} value={id}
                onChange={e => setId(e.target.value)} placeholder="my-lifecycle-rule" />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Status</label>
              <div className={styles.toggleRow}>
                {['Enabled', 'Disabled'].map(s => (
                  <button key={s} type="button"
                    className={`${styles.toggleBtn} ${status === s ? styles.toggleOn : ''}`}
                    onClick={() => setStatus(s)}>{s}</button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Filter prefix</label>
              <input className={styles.fieldInput} value={prefix}
                onChange={e => setPrefix(e.target.value)} placeholder="logs/ (leave empty to apply to all objects)" />
              <p className={styles.fieldHint}>Apply rule only to objects matching this prefix</p>
            </div>

            <div className={styles.ruleSection}>
              <div className={styles.ruleSectionHead}>Expiration</div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Expire objects after (days)</label>
                <input className={styles.fieldInput} type="number" min="1" value={expDays}
                  onChange={e => setExpDays(e.target.value)} placeholder="e.g. 365" style={{ width: 140 }} />
                <p className={styles.fieldHint}>Objects will be permanently deleted after this many days</p>
              </div>
            </div>

            <div className={styles.ruleSection}>
              <div className={styles.ruleSectionHead}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={transition}
                    onChange={e => setTransition(e.target.checked)}
                    style={{ accentColor: '#0073bb' }} />
                  Transition to another storage class
                </label>
              </div>
              {transition && (
                <div className={styles.fieldGroup}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                    <div className={styles.fieldGroup} style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>After (days)</label>
                      <input className={styles.fieldInput} type="number" min="1" value={transDays}
                        onChange={e => setTransDays(e.target.value)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ flex: 2 }}>
                      <label className={styles.fieldLabel}>Storage class</label>
                      <select className={styles.fieldInput} value={transClass}
                        onChange={e => setTransClass(e.target.value)}>
                        {STORAGE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {err && <p className={styles.fieldError}>{err}</p>}
          </div>
          <div className={styles.modalFoot}>
            <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.btnOrange}>Create rule</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ManagementTab({ bucket, scrollTo }) {
  useEffect(() => {
    if (!scrollTo) return
    document.getElementById(`mgmt-${scrollTo.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [scrollTo])
  const [rules,      setRules]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [msg,        setMsg]        = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [delTarget,  setDelTarget]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/aws/s3/buckets/${bucket}/lifecycle`)
      setRules(data.Rules || [])
    } catch { setRules([]) }
    finally { setLoading(false) }
  }, [bucket])

  useEffect(() => { load() }, [load])

  const saveRules = async (newRules) => {
    setMsg(null)
    try {
      if (newRules.length === 0) {
        await api.delete(`/aws/s3/buckets/${bucket}/lifecycle`)
      } else {
        await api.put(`/aws/s3/buckets/${bucket}/lifecycle`, { rules: newRules })
      }
      setRules(newRules)
      setMsg({ type: 'success', text: 'Lifecycle rules saved.' })
    } catch (ex) {
      setMsg({ type: 'error', text: ex.response?.data?.message || 'Failed to save rules.' })
    }
  }

  const addRule = (rule) => {
    if (rules.find(r => r.ID === rule.ID)) {
      setMsg({ type: 'error', text: `Rule ID "${rule.ID}" already exists.` })
      return
    }
    saveRules([...rules, rule])
  }

  const deleteRule = async (id) => {
    await saveRules(rules.filter(r => r.ID !== id))
    setDelTarget(null)
  }

  const toggleRule = async (id) => {
    const updated = rules.map(r =>
      r.ID === id ? { ...r, Status: r.Status === 'Enabled' ? 'Disabled' : 'Enabled' } : r
    )
    await saveRules(updated)
  }

  return (
    <div className={styles.tabContent}>
      {/* Lifecycle rules section */}
      <div id="mgmt-lifecycle" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Lifecycle rules</h3>
          <button className={styles.btnOrange} onClick={() => setShowCreate(true)}>
            Create lifecycle rule
          </button>
        </div>
        <div className={styles.propBody} style={{ padding: 0 }}>
          {msg && (
            <div style={{ padding: '0 16px 12px' }}>
              <div className={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>
                {msg.text}
              </div>
            </div>
          )}

          {loading ? (
            <div className={styles.tdCenter} style={{ padding: 28 }}>
              <span className={styles.spinner} /> Loading…
            </div>
          ) : rules.length === 0 ? (
            <div className={styles.lcEmpty}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#aab7c4" strokeWidth="1.5"/>
                <path d="M9 12l2 2 4-4" stroke="#aab7c4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p>No lifecycle rules configured.</p>
              <p className={styles.lcEmptySub}>
                Lifecycle rules automate transitioning or expiring your objects.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Rule name</th>
                  <th>Status</th>
                  <th>Filter prefix</th>
                  <th>Expiration</th>
                  <th>Transition</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.ID}>
                    <td style={{ fontWeight: 600 }}>{r.ID}</td>
                    <td>
                      <button
                        className={`${styles.statusToggleBtn} ${r.Status === 'Enabled' ? styles.statusEnabled : styles.statusDisabled}`}
                        onClick={() => toggleRule(r.ID)}
                        title="Click to toggle"
                      >
                        {r.Status}
                      </button>
                    </td>
                    <td>
                      <code className={styles.prefixCode}>
                        {r.Filter?.Prefix || <span className={styles.allObjects}>All objects</span>}
                      </code>
                    </td>
                    <td>
                      {r.Expiration?.Days
                        ? <span className={styles.ruleAction}>Expire after {r.Expiration.Days}d</span>
                        : <span className={styles.noAction}>—</span>}
                    </td>
                    <td>
                      {r.Transitions?.[0]
                        ? <span className={styles.ruleAction}>
                            → {r.Transitions[0].StorageClass} after {r.Transitions[0].Days}d
                          </span>
                        : <span className={styles.noAction}>—</span>}
                    </td>
                    <td>
                      <button className={styles.deletRuleBtn}
                        onClick={() => setDelTarget(r.ID)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Replication placeholder */}
      <div id="mgmt-replication" className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Replication rules</h3>
        </div>
        <div className={styles.propBody}>
          <p className={styles.propHint}>
            Replication enables automatic, asynchronous copying of objects across buckets.
          </p>
          <div className={styles.lcEmpty} style={{ padding: '16px 0 8px' }}>
            <p style={{ color: '#545b64', fontSize: '0.82rem' }}>No replication rules.</p>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateRuleModal onClose={() => setShowCreate(false)} onSave={addRule} />
      )}
      {delTarget && (
        <DeleteModal
          title="Delete lifecycle rule"
          message={`Delete rule "${delTarget}"? This cannot be undone.`}
          confirmText="Delete rule"
          onClose={() => setDelTarget(null)}
          onConfirm={() => deleteRule(delTarget)}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────── */
function EC2IntegrationTab({ bucket, setError: reportError }) {
  const [instances, setInstances] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)  // selected instanceId
  const [applying, setApplying] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get('/aws/ec2/instances')
      .then(r => {
        const list = (r.data.Reservations || []).flatMap(res => res.Instances || [])
        setInstances(list)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const endpoint = 'http://localhost:4566'

  const generatePolicy = (instanceId) => JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'EC2InstanceAccess',
        Effect: 'Allow',
        Principal: { AWS: `arn:aws:iam::000000000000:root` },
        Action: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
        Resource: [
          `arn:aws:s3:::${bucket}`,
          `arn:aws:s3:::${bucket}/*`,
        ],
        Condition: {
          StringEquals: { 'aws:sourceIp': '0.0.0.0/0' }
        }
      }
    ]
  }, null, 2)

  const applyPolicy = async () => {
    if (!selected) return
    setApplying(true)
    try {
      const policy = generatePolicy(selected)
      await api.put(`/aws/s3/buckets/${bucket}/policy`, { policy })
      setSuccess(`Bucket policy applied — EC2 instance "${selected}" can now access "${bucket}".`)
    } catch (ex) {
      reportError(ex.response?.data?.message || ex.message)
    } finally {
      setApplying(false) }
  }

  const bootstrapScript = selected
    ? `#!/bin/bash\nyum install -y aws-cli\nexport AWS_ACCESS_KEY_ID=test\nexport AWS_SECRET_ACCESS_KEY=test\nexport AWS_DEFAULT_REGION=us-east-1\naws s3 sync s3://${bucket}/ /home/ec2-user/s3-data/ --endpoint-url=${endpoint}\necho "Done" >> /var/log/s3-bootstrap.log`
    : ''

  return (
    <div style={{ padding: '24px', maxWidth: 900 }}>
      <h3 style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 4, fontSize: '1rem' }}>EC2 Integration</h3>
      <p style={{ color: '#8b949e', fontSize: '0.875rem', marginBottom: 20 }}>
        Select a running EC2 instance to generate a bucket policy granting it access to <strong style={{ color: '#e6edf3' }}>{bucket}</strong>, and get a ready-to-use bootstrap script.
      </p>

      {success && (
        <div style={{ background: '#0d1117', border: '1px solid #3fb950', borderRadius: 6, padding: '10px 16px', marginBottom: 16, color: '#3fb950', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
          Running EC2 Instances
        </div>
        {loading ? (
          <div style={{ color: '#8b949e', padding: 12 }}>Loading instances…</div>
        ) : instances.length === 0 ? (
          <div style={{ color: '#8b949e', padding: '16px', border: '1px solid #30363d', borderRadius: 6, textAlign: 'center', fontSize: '0.875rem' }}>
            No EC2 instances found. Launch an instance from the EC2 Console first.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#0d1117' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid #21262d' }}></th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid #21262d' }}>Instance ID</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid #21262d' }}>State</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid #21262d' }}>Type</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', border: '1px solid #21262d' }}>Private IP</th>
              </tr>
            </thead>
            <tbody>
              {instances.map(inst => (
                <tr
                  key={inst.InstanceId}
                  style={{ background: selected === inst.InstanceId ? '#1c2333' : 'transparent', cursor: 'pointer' }}
                  onClick={() => setSelected(inst.InstanceId)}
                >
                  <td style={{ padding: '8px 12px', border: '1px solid #21262d' }}>
                    <input type="radio" checked={selected === inst.InstanceId} onChange={() => setSelected(inst.InstanceId)} />
                  </td>
                  <td style={{ padding: '8px 12px', border: '1px solid #21262d', color: '#58a6ff', fontFamily: 'monospace', fontSize: '0.8rem' }}>{inst.InstanceId}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #21262d' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                      background: inst.State?.Name === 'running' ? '#0d2b0d' : '#1c1917',
                      color: inst.State?.Name === 'running' ? '#4ade80' : '#a8a29e',
                      border: `1px solid ${inst.State?.Name === 'running' ? '#166534' : '#57534e'}`,
                    }}>
                      {inst.State?.Name || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', border: '1px solid #21262d', color: '#e6edf3' }}>{inst.InstanceType || '—'}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #21262d', color: '#e6edf3', fontFamily: 'monospace', fontSize: '0.8rem' }}>{inst.PrivateIpAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bucket Policy (grants {selected} access)
              </div>
              <button
                onClick={applyPolicy}
                disabled={applying}
                style={{
                  background: '#f59e0b', color: '#0d0d0d', border: 'none', borderRadius: 6,
                  padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  opacity: applying ? 0.6 : 1,
                }}
              >
                {applying ? 'Applying…' : 'Apply Policy to Bucket'}
              </button>
            </div>
            <pre style={{
              background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
              padding: 14, color: '#79c0ff', fontSize: '0.78rem', fontFamily: 'monospace',
              overflow: 'auto', maxHeight: 220, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {generatePolicy(selected)}
            </pre>
          </div>

          <div>
            <div style={{ color: '#8b949e', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Bootstrap Script (paste as EC2 User Data)
            </div>
            <pre style={{
              background: '#0d1117', border: '1px solid #30363d', borderRadius: 6,
              padding: 14, color: '#4ade80', fontSize: '0.78rem', fontFamily: 'monospace',
              overflow: 'auto', maxHeight: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {bootstrapScript}
            </pre>
            <p style={{ color: '#8b949e', fontSize: '0.75rem', marginTop: 6 }}>
              Copy this script into the EC2 Launch Instance → User Data field to automatically sync this bucket to the instance on startup.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

/* ════════════════════════════════════
   WEBSITE TAB
════════════════════════════════════ */
function WebsiteTab({ bucket, objects, setActiveSection }) {
  const BACKEND = 'http://localhost:5000'
  const websiteUrl = `${BACKEND}/api/aws/s3/website/${bucket}/`

  /* ── website config ── */
  const [site,     setSite]     = useState({ enabled: false, indexDocument: 'index.html', errorDocument: 'error.html' })
  const [siteDraft,setSiteDraft]= useState(site)
  const [siteEdit, setSiteEdit] = useState(false)
  const [siteBusy, setSiteBusy] = useState(false)
  const [siteMsg,  setSiteMsg]  = useState(null)

  /* ── public access ── */
  const [blockCfg,    setBlockCfg]    = useState(null)   // null = loading
  const [makingPub,   setMakingPub]   = useState(false)
  const [pubMsg,      setPubMsg]      = useState(null)

  /* ── index.html check ── */
  const indexExists = objects.some(o => o.Key === site.indexDocument)

  const load = useCallback(async () => {
    const [siteR, pubR] = await Promise.allSettled([
      api.get(`/aws/s3/buckets/${bucket}/website`),
      api.get(`/aws/s3/buckets/${bucket}/public-access`),
    ])
    if (siteR.status === 'fulfilled') {
      setSite(siteR.value.data)
      setSiteDraft(siteR.value.data)
    }
    if (pubR.status === 'fulfilled') {
      setBlockCfg(pubR.value.data.config || {})
    } else {
      setBlockCfg({})
    }
  }, [bucket])

  useEffect(() => { load() }, [load])

  const isPublic = blockCfg !== null && !Object.values(blockCfg).some(Boolean)

  const saveSite = async () => {
    setSiteBusy(true); setSiteMsg(null)
    try {
      if (siteDraft.enabled) {
        await api.put(`/aws/s3/buckets/${bucket}/website`, siteDraft)
        setSite({ ...siteDraft, enabled: true })
      } else {
        await api.delete(`/aws/s3/buckets/${bucket}/website`)
        setSite({ ...siteDraft, enabled: false })
      }
      setSiteEdit(false)
      setSiteMsg({ ok: true, text: `Website hosting ${siteDraft.enabled ? 'enabled' : 'disabled'}.` })
    } catch (ex) {
      setSiteMsg({ ok: false, text: ex.response?.data?.message || 'Failed to save.' })
    } finally { setSiteBusy(false) }
  }

  const makePublic = async () => {
    setMakingPub(true); setPubMsg(null)
    try {
      await api.put(`/aws/s3/buckets/${bucket}/public-access`, {
        BlockPublicAcls: false, IgnorePublicAcls: false,
        BlockPublicPolicy: false, RestrictPublicBuckets: false,
      })
      const policy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Sid: 'PublicRead', Effect: 'Allow', Principal: '*',
          Action: 's3:GetObject', Resource: `arn:aws:s3:::${bucket}/*` }],
      })
      await api.put(`/aws/s3/buckets/${bucket}/policy`, { policy })
      setBlockCfg({})
      setPubMsg({ ok: true, text: 'Bucket is now publicly accessible.' })
    } catch (ex) {
      setPubMsg({ ok: false, text: ex.response?.data?.message || 'Failed to enable public access.' })
    } finally { setMakingPub(false) }
  }

  const steps = [
    {
      key: 'hosting',
      label: 'Static website hosting enabled',
      done: site.enabled,
      action: !site.enabled ? () => { setSiteDraft(d => ({ ...d, enabled: true })); setSiteEdit(true) } : null,
      actionLabel: 'Enable',
    },
    {
      key: 'public',
      label: 'Public access allowed',
      done: isPublic,
      action: !isPublic ? makePublic : null,
      actionLabel: makingPub ? 'Enabling…' : 'Make public',
      busy: makingPub,
    },
    {
      key: 'index',
      label: `Index document uploaded (${site.indexDocument})`,
      done: indexExists,
      action: !indexExists ? () => document.querySelector('[data-upload-trigger]')?.click() : null,
      actionLabel: 'Upload files',
    },
  ]

  const allReady = steps.every(s => s.done)

  return (
    <div className={styles.tabContent}>

      {/* ── URL Banner ── */}
      <div className={styles.websiteBanner}>
        <div className={styles.websiteBannerLeft}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#0073bb" strokeWidth="1.5"/>
            <path d="M12 3c-2.5 2.5-4 6-4 9s1.5 6.5 4 9" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
            <path d="M12 3c2.5 2.5 4 6 4 9s-1.5 6.5-4 9" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
            <path d="M3 12h18" stroke="#0073bb" strokeWidth="1.5"/>
          </svg>
          <div>
            <div className={styles.websiteBannerTitle}>Website endpoint</div>
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
              className={styles.websiteBannerUrl}>{websiteUrl}</a>
          </div>
        </div>
        <div className={styles.websiteBannerActions}>
          <CopyBtn value={websiteUrl} />
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.btnOrange} ${!allReady ? styles.btnDisabled : ''}`}
            onClick={e => { if (!allReady) { e.preventDefault(); setSiteMsg({ ok: false, text: 'Complete all setup steps before launching.' }) } }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Launch website
          </a>
        </div>
      </div>

      {/* ── Setup checklist ── */}
      <div className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Setup checklist</h3>
          {allReady && <span className={styles.allReadyBadge}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" fill="#1d8102"/>
              <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ready to launch
          </span>}
        </div>
        <div className={styles.propBody}>
          {steps.map(step => (
            <div key={step.key} className={styles.setupStep}>
              <div className={`${styles.setupStepIcon} ${step.done ? styles.setupStepDone : styles.setupStepPending}`}>
                {step.done
                  ? <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" fill="#1d8102"/>
                      <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="#d08700" strokeWidth="1.5"/>
                      <line x1="12" y1="8" x2="12" y2="12" stroke="#d08700" strokeWidth="1.5" strokeLinecap="round"/>
                      <circle cx="12" cy="16" r="0.5" fill="#d08700" stroke="#d08700"/>
                    </svg>
                }
              </div>
              <span className={`${styles.setupStepLabel} ${step.done ? styles.setupStepLabelDone : ''}`}>
                {step.label}
              </span>
              {!step.done && step.action && (
                <button className={styles.setupStepBtn} onClick={step.action} disabled={step.busy}>
                  {step.actionLabel}
                </button>
              )}
            </div>
          ))}
          {pubMsg && <div className={pubMsg.ok ? styles.successMsg : styles.errorMsg} style={{ marginTop: 12 }}>{pubMsg.text}</div>}
        </div>
      </div>

      {/* ── Website configuration ── */}
      <div className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Website configuration</h3>
          {!siteEdit
            ? <button className={styles.editBtn} onClick={() => { setSiteDraft(site); setSiteEdit(true); setSiteMsg(null) }}>Edit</button>
            : <div className={styles.editBtnGroup}>
                <button className={styles.btnSecondary} onClick={() => { setSiteEdit(false); setSiteMsg(null) }}>Cancel</button>
                <button className={styles.btnOrange} onClick={saveSite} disabled={siteBusy}>{siteBusy ? 'Saving…' : 'Save changes'}</button>
              </div>
          }
        </div>
        <div className={styles.propBody}>
          {!siteEdit ? (
            <>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Status</span>
                <span className={styles.statusBadge}
                  style={site.enabled
                    ? { background: '#f0fae6', color: '#1d6b0b', border: '1px solid #b3d99e' }
                    : { background: '#f2f3f3', color: '#545b64', border: '1px solid #d5dbdb' }}>
                  {site.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Index document</span>
                <code className={styles.prefixCode}>{site.indexDocument}</code>
              </div>
              <div className={styles.propRow}>
                <span className={styles.propKey}>Error document</span>
                <code className={styles.prefixCode}>{site.errorDocument}</code>
              </div>
            </>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Static website hosting</label>
                <div className={styles.toggleRow}>
                  {[['Enable', true], ['Disable', false]].map(([lbl, val]) => (
                    <button key={lbl} type="button"
                      className={`${styles.toggleBtn} ${siteDraft.enabled === val ? styles.toggleOn : ''}`}
                      onClick={() => setSiteDraft(d => ({ ...d, enabled: val }))}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {siteDraft.enabled && (
                <>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Index document</label>
                    <input className={styles.fieldInput} value={siteDraft.indexDocument}
                      onChange={e => setSiteDraft(d => ({ ...d, indexDocument: e.target.value }))}
                      placeholder="index.html" style={{ maxWidth: 280 }} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Error document <span className={styles.optLabel}>(optional)</span></label>
                    <input className={styles.fieldInput} value={siteDraft.errorDocument}
                      onChange={e => setSiteDraft(d => ({ ...d, errorDocument: e.target.value }))}
                      placeholder="error.html" style={{ maxWidth: 280 }} />
                  </div>
                </>
              )}
            </>
          )}
          {siteMsg && <div className={siteMsg.ok ? styles.successMsg : styles.errorMsg}>{siteMsg.text}</div>}
        </div>
      </div>

      {/* ── Quick start guide ── */}
      <div className={styles.propSection}>
        <div className={styles.propSectionHead}>
          <h3 className={styles.propTitle}>Quick start guide</h3>
        </div>
        <div className={styles.propBody}>
          <ol className={styles.guideList}>
            <li>
              <strong>Enable website hosting</strong> — click Edit above and set to Enabled.
              Set your index document (e.g. <code className={styles.prefixCode}>index.html</code>).
            </li>
            <li>
              <strong>Make the bucket public</strong> — website files must be publicly readable.
              Click "Make public" in the checklist above to disable Block Public Access and apply a public-read bucket policy.
            </li>
            <li>
              <strong>Upload your website files</strong> — go to the{' '}
              <button className={styles.linkBtn} onClick={() => setActiveSection('Objects')}>Objects tab</button>{' '}
              and upload <code className={styles.prefixCode}>index.html</code> and any CSS/JS/image assets.
            </li>
            <li>
              <strong>Launch</strong> — click the orange "Launch website" button at the top of this page.
              Your site is served at <code className={styles.prefixCode}>/api/aws/s3/website/{bucket}/</code>.
            </li>
          </ol>
          <div className={styles.guideNote}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#0073bb" strokeWidth="1.5"/>
              <line x1="12" y1="8" x2="12" y2="12" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="16" r="0.5" fill="#0073bb" stroke="#0073bb"/>
            </svg>
            The website URL is served through the CloudLabs backend proxy, which means relative CSS, JS, and image paths
            resolve correctly — just like a real S3 website endpoint.
          </div>
        </div>
      </div>

    </div>
  )
}

/* ────────────────────────────────── */
const BUCKET_NAV = [
  { id: 'Objects',     label: 'Objects',     icon: '⊞' },
  {
    id: 'Properties', label: 'Properties', icon: '⚙',
    children: [
      { id: 'Properties.Versioning',  label: 'Versioning' },
      { id: 'Properties.Encryption',  label: 'Default encryption' },
      { id: 'Properties.Tags',        label: 'Tags' },
      { id: 'Properties.Ownership',   label: 'Object Ownership' },
      { id: 'Properties.Website',     label: 'Static website hosting' },
      { id: 'Properties.ObjectLock',  label: 'Object Lock' },
    ],
  },
  {
    id: 'Permissions', label: 'Permissions', icon: '🔒',
    children: [
      { id: 'Permissions.BlockAccess', label: 'Block Public Access' },
      { id: 'Permissions.Policy',      label: 'Bucket policy' },
    ],
  },
  { id: 'Metrics',    label: 'Metrics',    icon: '📊' },
  {
    id: 'Management', label: 'Management', icon: '⚒',
    children: [
      { id: 'Management.Lifecycle',    label: 'Lifecycle rules' },
      { id: 'Management.Replication',  label: 'Replication rules' },
    ],
  },
  { id: 'Website',    label: 'Static Website',  icon: '🌐' },
  { id: 'Triggers',   label: 'Triggers',   icon: '⚡' },
  { id: 'EC2',        label: 'EC2 Integration', icon: '⬛' },
]

/* sidebar nav component */
function BucketNav({ active, setActive }) {
  const [expanded, setExpanded] = useState(() => {
    const top = active.split('.')[0]
    return new Set(BUCKET_NAV.filter(n => n.children).map(n => n.id).filter(id => id === top))
  })

  const toggle = (id) => setExpanded(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  return (
    <nav className={styles.bucketNav}>
      {BUCKET_NAV.map(item => {
        const isGroup = !!item.children
        const topActive = active === item.id || active.startsWith(item.id + '.')
        const open = expanded.has(item.id)
        return (
          <div key={item.id}>
            <button
              className={`${styles.bucketNavItem} ${topActive && !isGroup ? styles.bucketNavItemActive : topActive ? styles.bucketNavGroupActive : ''}`}
              onClick={() => {
                if (isGroup) {
                  toggle(item.id)
                  if (!open) setActive(item.children[0].id)
                } else {
                  setActive(item.id)
                }
              }}
            >
              <span className={styles.bucketNavIcon}>{item.icon}</span>
              <span className={styles.bucketNavLabel}>{item.label}</span>
              {isGroup && <span className={styles.bucketNavCaret}>{open ? '▾' : '▸'}</span>}
            </button>
            {isGroup && open && (
              <div className={styles.bucketNavChildren}>
                {item.children.map(child => (
                  <button
                    key={child.id}
                    className={`${styles.bucketNavChild} ${active === child.id ? styles.bucketNavChildActive : ''}`}
                    onClick={() => setActive(child.id)}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/* ── Copy-to-clipboard button ── */
function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button className={styles.copyBtn} onClick={copy} title="Copy">
      {copied
        ? <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" fill="#1d8102"/><path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="#545b64" strokeWidth="1.5"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="#545b64" strokeWidth="1.5"/></svg>
      }
    </button>
  )
}

/* ── Bucket namespace info panel ── */
function BucketNamespace({ bucket, bucketData }) {
  const { region } = useRegion()
  const arn         = `arn:aws:s3:::${bucket}`
  const s3Uri       = `s3://${bucket}`
  const pathUrl     = `http://localhost:4566/${bucket}`
  const vhostUrl    = `https://${bucket}.s3.${region?.code || 'us-east-1'}.amazonaws.com`
  const endpoint    = `s3.${region?.code || 'us-east-1'}.amazonaws.com`

  const rows = [
    { label: 'Bucket ARN',                value: arn },
    { label: 'S3 URI',                    value: s3Uri },
    { label: 'Path-style URL',            value: pathUrl },
    { label: 'Virtual-hosted-style URL',  value: vhostUrl },
    { label: 'Region endpoint',           value: endpoint },
    { label: 'AWS Region',                value: `${region?.name || 'US East (N. Virginia)'} (${region?.code || 'us-east-1'})` },
  ]

  return (
    <div className={styles.nsPanel}>
      <div className={styles.nsPanelHead}>
        <div className={styles.nsPanelTitle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#0073bb" strokeWidth="1.5"/>
            <path d="M12 3c-2.8 2.8-4 6-4 10s1.2 7.2 4 10" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
            <path d="M12 3c2.8 2.8 4 6 4 10s-1.2 7.2-4 10" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
            <path d="M3 12h18" stroke="#0073bb" strokeWidth="1.5"/>
          </svg>
          Bucket namespace &amp; identifiers
        </div>
        <span className={styles.nsGlobal}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" fill="#1d8102"/>
            <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Globally unique name
        </span>
      </div>
      <div className={styles.nsPanelBody}>
        {rows.map(r => (
          <div key={r.label} className={styles.nsRow}>
            <span className={styles.nsLabel}>{r.label}</span>
            <code className={styles.nsValue}>{r.value}</code>
            <CopyBtn value={r.value} />
          </div>
        ))}
      </div>
      <div className={styles.nsFooter}>
        S3 bucket names are globally unique across all AWS accounts and regions.
        No two buckets can share the same name in the S3 namespace.
      </div>
    </div>
  )
}

export default function S3Console({ onBack, onNavigateTo }) {
  const { region } = useRegion()
  const [buckets, setBuckets]               = useState([])
  const [openBucket, setOpenBucket]         = useState(null)
  const [objects, setObjects]               = useState([])
  const [versions, setVersions]             = useState([])
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [selBuckets, setSelBuckets]         = useState(new Set())
  const [selObjects, setSelObjects]         = useState(new Set())
  const [bucketSearch, setBucketSearch]     = useState('')
  const [nsFilter, setNsFilter]             = useState('')   // active namespace prefix filter
  const [objectSearch, setObjectSearch]     = useState('')
  const [activeSection, setActiveSection]   = useState('Objects')
  const [showVersions, setShowVersions]     = useState(false)
  const [versioningStatus, setVersioningStatus] = useState('Disabled')
  const [policy, setPolicy]                 = useState('')
  const [showCreate, setShowCreate]         = useState(false)
  const [showUpload, setShowUpload]         = useState(false)
  const [deleteTarget, setDeleteTarget]     = useState(null)

  const loadBuckets = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/aws/s3/buckets', { params: { region: region?.code || 'us-east-1' } })
      setBuckets(data.Buckets || [])
    } catch { setError('Failed to load buckets.') }
    finally { setLoading(false) }
  }, [region])

  const loadObjects = useCallback(async (bucket) => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get(`/aws/s3/buckets/${bucket}/objects`)
      setObjects(data.Contents || [])
    } catch { setError('Failed to load objects.') }
    finally { setLoading(false) }
  }, [])

  const loadVersioning = useCallback(async (bucket) => {
    try {
      const { data } = await api.get(`/aws/s3/buckets/${bucket}/versioning`)
      setVersioningStatus(data.Status || 'Disabled')
    } catch {}
  }, [])

  const loadVersions = useCallback(async (bucket) => {
    try {
      const { data } = await api.get(`/aws/s3/buckets/${bucket}/versions`)
      const all = [
        ...(data.Versions || []),
        ...(data.DeleteMarkers || []).map(d => ({ ...d, IsDeleteMarker: true })),
      ].sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      setVersions(all)
    } catch {}
  }, [])

  const loadPolicy = useCallback(async (bucket) => {
    try {
      const { data } = await api.get(`/aws/s3/buckets/${bucket}/policy`)
      const p = data.Policy ? JSON.stringify(JSON.parse(data.Policy), null, 2) : ''
      setPolicy(p)
    } catch {}
  }, [])

  useEffect(() => { loadBuckets() }, [loadBuckets])

  useEffect(() => {
    if (!openBucket) return
    setActiveSection('Objects'); setShowVersions(false)
    setSelObjects(new Set()); setObjects([]); setVersions([])
    loadObjects(openBucket)
    loadVersioning(openBucket)
    loadPolicy(openBucket)
  }, [openBucket, loadObjects, loadVersioning, loadPolicy])

  useEffect(() => {
    if (showVersions && openBucket) loadVersions(openBucket)
  }, [showVersions, openBucket, loadVersions])

  const downloadObject = async (key) => {
    try {
      const { data } = await api.get(
        `/aws/s3/buckets/${openBucket}/download/${key}`,
        { responseType: 'blob' }
      )
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = key.split('/').pop()
      document.body.appendChild(a); a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch { setError('Download failed.') }
  }

  const confirmDeleteBucket = async () => {
    const names = deleteTarget.names || [deleteTarget.name]
    const failed = []
    for (const name of names) {
      try {
        await api.delete(`/aws/s3/buckets/${name}`)
        setBuckets(p => p.filter(b => b.Name !== name))
        setSelBuckets(p => { const n = new Set(p); n.delete(name); return n })
        if (openBucket === name) setOpenBucket(null)
      } catch (ex) {
        failed.push(name)
      }
    }
    setDeleteTarget(null)
    if (failed.length) setError(`Failed to delete: ${failed.join(', ')}`)
  }

  const confirmDeleteObject = async () => {
    const keys = deleteTarget.names || [deleteTarget.name]
    const failed = []
    for (const key of keys) {
      try {
        await api.delete(`/aws/s3/buckets/${openBucket}/objects/${encodeURIComponent(key)}`)
        setObjects(p => p.filter(o => o.Key !== key))
        setSelObjects(p => { const n = new Set(p); n.delete(key); return n })
      } catch {
        failed.push(key)
      }
    }
    setDeleteTarget(null)
    if (failed.length) setError(`Failed to delete: ${failed.join(', ')}`)
  }

  const toggleBucket = (name) => setSelBuckets(p => {
    const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n
  })
  const toggleObject = (key) => setSelObjects(p => {
    const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n
  })
  const toggleAllBuckets = () => {
    const vis = buckets.filter(b => !bucketSearch || b.Name.includes(bucketSearch))
    setSelBuckets(p => p.size === vis.length ? new Set() : new Set(vis.map(b => b.Name)))
  }
  const toggleAllObjects = () => {
    const vis = objects.filter(o => !objectSearch || o.Key.includes(objectSearch))
    setSelObjects(p => p.size === vis.length ? new Set() : new Set(vis.map(o => o.Key)))
  }

  /* detect namespace prefixes (common dash-separated prefix shared by 2+ buckets) */
  const detectedNamespaces = (() => {
    const counts = {}
    buckets.forEach(b => {
      const parts = b.Name.split('-')
      if (parts.length >= 2) {
        const prefix = parts[0]
        counts[prefix] = (counts[prefix] || 0) + 1
      }
    })
    return Object.entries(counts).filter(([, c]) => c >= 2).map(([p]) => p).sort()
  })()

  const visBuckets = buckets.filter(b => {
    const matchSearch = !bucketSearch || b.Name.toLowerCase().includes(bucketSearch.toLowerCase())
    const matchNs     = !nsFilter || b.Name.startsWith(nsFilter + '-') || b.Name === nsFilter
    return matchSearch && matchNs
  })

  /* ── RENDER ── */
  return (
    <div className={styles.console}>

      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button className={styles.breadLink} onClick={onBack}>Amazon S3</button>
        <span className={styles.breadSep}>›</span>
        {openBucket ? (
          <>
            <button className={styles.breadLink}
              onClick={() => { setOpenBucket(null); setSelBuckets(new Set()) }}>
              Buckets
            </button>
            <span className={styles.breadSep}>›</span>
            <span className={styles.breadCurrent}>{openBucket}</span>
          </>
        ) : (
          <span className={styles.breadCurrent}>Buckets</span>
        )}
      </div>

      {/* ══ BUCKET LIST ══ */}
      {!openBucket && (
        <>
          <div className={styles.viewHead}>
            <h1 className={styles.viewTitle}>Buckets</h1>
            <div className={styles.viewActions}>
              <button className={styles.btnSecondary} disabled={selBuckets.size === 0}
                onClick={() => setDeleteTarget({ type: 'bucket', names: [...selBuckets] })}>
                Delete
              </button>
              <button className={styles.btnSecondary} disabled={selBuckets.size !== 1}
                onClick={() => setOpenBucket([...selBuckets][0])}>
                Open
              </button>
              <button className={styles.btnOrange} onClick={() => setShowCreate(true)}>
                Create bucket
              </button>
            </div>
          </div>

          {/* Namespace filter pills */}
          {detectedNamespaces.length > 0 && (
            <div className={styles.nsFilterBar}>
              <span className={styles.nsFilterLabel}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M7 12h10M10 18h4" stroke="#0073bb" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Namespaces
              </span>
              <button
                className={`${styles.nsFilterPill} ${!nsFilter ? styles.nsFilterPillActive : ''}`}
                onClick={() => setNsFilter('')}
              >
                All buckets
                <span className={styles.nsFilterCount}>{buckets.length}</span>
              </button>
              {detectedNamespaces.map(ns => (
                <button
                  key={ns}
                  className={`${styles.nsFilterPill} ${nsFilter === ns ? styles.nsFilterPillActive : ''}`}
                  onClick={() => setNsFilter(nsFilter === ns ? '' : ns)}
                >
                  {ns}-*
                  <span className={styles.nsFilterCount}>
                    {buckets.filter(b => b.Name.startsWith(ns + '-')).length}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && <div className={styles.errorBanner}>{error}</div>}
          <div className={styles.tableWrap}>
            <div className={styles.tableToolbar}>
              <span className={styles.tableCount}>
                Buckets ({visBuckets.length}{selBuckets.size > 0 && ` · ${selBuckets.size} selected`})
              </span>
              <div className={styles.tableSearch}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                  <circle cx="8.5" cy="8.5" r="5.75" stroke="#545b64" strokeWidth="1.5"/>
                  <path d="M13 13l3.5 3.5" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input placeholder="Find bucket by name" value={bucketSearch}
                  onChange={e => setBucketSearch(e.target.value)} />
              </div>
              <button className={styles.refreshBtn} onClick={loadBuckets} title="Refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M23 4v6h-6" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" stroke="#545b64" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCheck}>
                    <input type="checkbox"
                      checked={selBuckets.size === visBuckets.length && visBuckets.length > 0}
                      onChange={toggleAllBuckets} />
                  </th>
                  <th>Name</th>
                  <th>AWS Region</th>
                  <th>Versioning</th>
                  <th>Access</th>
                  <th>Creation date</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className={styles.tdCenter}><span className={styles.spinner} /> Loading…</td></tr>
                )}
                {!loading && visBuckets.length === 0 && (
                  <tr><td colSpan={6} className={styles.tdEmpty}>
                    {bucketSearch ? 'No buckets match your search.' : 'No buckets yet. Create your first bucket to get started.'}
                  </td></tr>
                )}
                {visBuckets.map(b => (
                  <tr key={b.Name} className={selBuckets.has(b.Name) ? styles.trSelected : ''}
                    onClick={() => toggleBucket(b.Name)}>
                    <td className={styles.tdCheck} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selBuckets.has(b.Name)}
                        onChange={() => toggleBucket(b.Name)} />
                    </td>
                    <td>
                      <button className={styles.bucketLink}
                        onClick={e => { e.stopPropagation(); setOpenBucket(b.Name) }}>
                        {b.Name}
                      </button>
                    </td>
                    <td>us-east-1</td>
                    <td><span className={styles.versioningBadge}>—</span></td>
                    <td><span className={styles.accessBadge}>Bucket and objects not public</span></td>
                    <td>{formatDate(b.CreationDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ══ BUCKET DETAIL ══ */}
      {openBucket && (
        <>
          {/* Bucket header + namespace panel */}
          <div className={styles.bucketDetailHead}>
            <div>
              <h1 className={styles.viewTitle}>{openBucket}</h1>
              <span className={styles.bucketDetailMeta}>
                Amazon S3 &rsaquo; Buckets &rsaquo; {openBucket}
              </span>
            </div>
          </div>

          <BucketNamespace bucket={openBucket} />

          {error && <div className={styles.errorBanner}>{error}</div>}

          {/* Two-column layout: sidebar nav + content */}
          <div className={styles.bucketDetailLayout}>
            <BucketNav active={activeSection} setActive={setActiveSection} />

            <div className={styles.bucketDetailContent}>
              {activeSection === 'Objects' && (
                <ObjectsTab
                  bucket={openBucket} objects={objects} loading={loading} error={error}
                  objectSearch={objectSearch} setObjectSearch={setObjectSearch}
                  selObjects={selObjects} toggleObject={toggleObject} toggleAllObjects={toggleAllObjects}
                  loadObjects={loadObjects} setShowUpload={setShowUpload}
                  setDeleteTarget={setDeleteTarget} downloadObject={downloadObject}
                  showVersions={showVersions} setShowVersions={setShowVersions} versions={versions}
                />
              )}
              {activeSection.startsWith('Properties') && (
                <PropertiesTab
                  bucket={openBucket} versioningStatus={versioningStatus}
                  setVersioningStatus={setVersioningStatus} setError={setError}
                  scrollTo={activeSection.split('.')[1]}
                />
              )}
              {activeSection.startsWith('Permissions') && (
                <PermissionsTab bucket={openBucket} policy={policy} setPolicy={setPolicy}
                  scrollTo={activeSection.split('.')[1]}
                />
              )}
              {activeSection === 'Metrics' && (
                <MetricsTab objects={objects} bucket={openBucket} />
              )}
              {activeSection.startsWith('Management') && (
                <ManagementTab bucket={openBucket}
                  scrollTo={activeSection.split('.')[1]}
                />
              )}
              {activeSection === 'Website' && (
                <WebsiteTab
                  bucket={openBucket}
                  objects={objects}
                  setActiveSection={setActiveSection}
                />
              )}
              {activeSection === 'Triggers' && (
                <BucketTriggers bucket={openBucket} />
              )}
              {activeSection === 'EC2' && (
                <EC2IntegrationTab bucket={openBucket} setError={setError} />
              )}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && <CreateBucketModal onClose={() => setShowCreate(false)} onCreate={loadBuckets} existingBuckets={buckets} />}
      {showUpload && (
        <UploadModal bucket={openBucket} onClose={() => setShowUpload(false)}
          onUpload={() => loadObjects(openBucket)} />
      )}
      {deleteTarget?.type === 'bucket' && (() => {
        const names = deleteTarget.names || [deleteTarget.name]
        const count = names.length
        return (
          <DeleteModal
            title={count > 1 ? `Delete ${count} buckets` : 'Delete bucket'}
            message={count > 1
              ? `Permanently delete these ${count} buckets?\n${names.join(', ')}`
              : `Permanently delete "${names[0]}"?`}
            subMessage="All objects, versions, and delete markers will be removed automatically. This cannot be undone."
            confirmText={count > 1 ? `Delete ${count} buckets` : 'Delete bucket'}
            onClose={() => setDeleteTarget(null)} onConfirm={confirmDeleteBucket} />
        )
      })()}
      {deleteTarget?.type === 'object' && (() => {
        const names = deleteTarget.names || [deleteTarget.name]
        const count = names.length
        return (
          <DeleteModal
            title={count > 1 ? `Delete ${count} objects` : 'Delete object'}
            message={count > 1
              ? `Permanently delete ${count} selected objects?`
              : `Permanently delete "${names[0]}"?`}
            confirmText={count > 1 ? `Delete ${count} objects` : 'Delete object'}
            onClose={() => setDeleteTarget(null)} onConfirm={confirmDeleteObject} />
        )
      })()}
    </div>
  )
}
