import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import styles from './EC2Console.module.css'

/* ─────────────────────────────────────────
   Instance Types
───────────────────────────────────────── */
const INSTANCE_TYPES = [
  /* ── x86_64 ── */
  { id: 't2.micro',    arch: 'x86_64', family: 't2',  vcpu: 1,  memory: '1 GiB',   currentGen: true,  freeTier: true,  pricing: { linux: 0.0116, windows: 0.0162, rhel: 0.0268, ubuntuPro: 0.0142, suse: 0.0116 } },
  { id: 't2.small',    arch: 'x86_64', family: 't2',  vcpu: 1,  memory: '2 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0230, windows: 0.0332, rhel: 0.0380, ubuntuPro: 0.0270, suse: 0.0230 } },
  { id: 't2.medium',   arch: 'x86_64', family: 't2',  vcpu: 2,  memory: '4 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0464, windows: 0.0664, rhel: 0.0764, ubuntuPro: 0.0540, suse: 0.0464 } },
  { id: 't2.large',    arch: 'x86_64', family: 't2',  vcpu: 2,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0928, windows: 0.1128, rhel: 0.1228, ubuntuPro: 0.1004, suse: 0.0928 } },
  { id: 't3.micro',    arch: 'x86_64', family: 't3',  vcpu: 2,  memory: '1 GiB',   currentGen: true,  freeTier: true,  pricing: { linux: 0.0104, windows: 0.0160, rhel: 0.0264, ubuntuPro: 0.0140, suse: 0.0104 } },
  { id: 't3.small',    arch: 'x86_64', family: 't3',  vcpu: 2,  memory: '2 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0208, windows: 0.0320, rhel: 0.0368, ubuntuPro: 0.0264, suse: 0.0208 } },
  { id: 't3.medium',   arch: 'x86_64', family: 't3',  vcpu: 2,  memory: '4 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0416, windows: 0.0640, rhel: 0.0736, ubuntuPro: 0.0512, suse: 0.0416 } },
  { id: 't3.large',    arch: 'x86_64', family: 't3',  vcpu: 2,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0832, windows: 0.1280, rhel: 0.1472, ubuntuPro: 0.1024, suse: 0.0832 } },
  { id: 'm5.large',    arch: 'x86_64', family: 'm5',  vcpu: 2,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0960, windows: 0.1880, rhel: 0.1660, ubuntuPro: 0.1110, suse: 0.1120 } },
  { id: 'm5.xlarge',   arch: 'x86_64', family: 'm5',  vcpu: 4,  memory: '16 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.1920, windows: 0.3760, rhel: 0.3320, ubuntuPro: 0.2220, suse: 0.2240 } },
  { id: 'm5.2xlarge',  arch: 'x86_64', family: 'm5',  vcpu: 8,  memory: '32 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.3840, windows: 0.7520, rhel: 0.6640, ubuntuPro: 0.4440, suse: 0.4480 } },
  { id: 'c5.large',    arch: 'x86_64', family: 'c5',  vcpu: 2,  memory: '4 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0850, windows: 0.1770, rhel: 0.1550, ubuntuPro: 0.1000, suse: 0.1010 } },
  { id: 'c5.xlarge',   arch: 'x86_64', family: 'c5',  vcpu: 4,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.1700, windows: 0.3540, rhel: 0.3100, ubuntuPro: 0.2000, suse: 0.2020 } },
  { id: 'r5.large',    arch: 'x86_64', family: 'r5',  vcpu: 2,  memory: '16 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.1260, windows: 0.2520, rhel: 0.2220, ubuntuPro: 0.1510, suse: 0.1480 } },
  { id: 'r5.xlarge',   arch: 'x86_64', family: 'r5',  vcpu: 4,  memory: '32 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.2520, windows: 0.5040, rhel: 0.4440, ubuntuPro: 0.3020, suse: 0.2960 } },
  /* ── arm64 ── */
  { id: 't4g.micro',   arch: 'arm64',  family: 't4g', vcpu: 2,  memory: '1 GiB',   currentGen: true,  freeTier: true,  pricing: { linux: 0.0084, windows: null,   rhel: 0.0234, ubuntuPro: 0.0110, suse: 0.0084 } },
  { id: 't4g.small',   arch: 'arm64',  family: 't4g', vcpu: 2,  memory: '2 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0168, windows: null,   rhel: 0.0318, ubuntuPro: 0.0194, suse: 0.0168 } },
  { id: 't4g.medium',  arch: 'arm64',  family: 't4g', vcpu: 2,  memory: '4 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0336, windows: null,   rhel: 0.0486, ubuntuPro: 0.0362, suse: 0.0336 } },
  { id: 't4g.large',   arch: 'arm64',  family: 't4g', vcpu: 2,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0672, windows: null,   rhel: 0.0822, ubuntuPro: 0.0698, suse: 0.0672 } },
  { id: 'm6g.large',   arch: 'arm64',  family: 'm6g', vcpu: 2,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0770, windows: null,   rhel: 0.1270, ubuntuPro: 0.0880, suse: 0.0880 } },
  { id: 'm6g.xlarge',  arch: 'arm64',  family: 'm6g', vcpu: 4,  memory: '16 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.1540, windows: null,   rhel: 0.2540, ubuntuPro: 0.1760, suse: 0.1760 } },
  { id: 'm6g.2xlarge', arch: 'arm64',  family: 'm6g', vcpu: 8,  memory: '32 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.3080, windows: null,   rhel: 0.5080, ubuntuPro: 0.3520, suse: 0.3520 } },
  { id: 'c6g.large',   arch: 'arm64',  family: 'c6g', vcpu: 2,  memory: '4 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.0680, windows: null,   rhel: 0.1180, ubuntuPro: 0.0810, suse: 0.0810 } },
  { id: 'c6g.xlarge',  arch: 'arm64',  family: 'c6g', vcpu: 4,  memory: '8 GiB',   currentGen: true,  freeTier: false, pricing: { linux: 0.1360, windows: null,   rhel: 0.2360, ubuntuPro: 0.1620, suse: 0.1620 } },
  { id: 'r6g.large',   arch: 'arm64',  family: 'r6g', vcpu: 2,  memory: '16 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.1008, windows: null,   rhel: 0.1708, ubuntuPro: 0.1208, suse: 0.1208 } },
  { id: 'r6g.xlarge',  arch: 'arm64',  family: 'r6g', vcpu: 4,  memory: '32 GiB',  currentGen: true,  freeTier: false, pricing: { linux: 0.2016, windows: null,   rhel: 0.3416, ubuntuPro: 0.2416, suse: 0.2416 } },
]

const DEFAULT_INSTANCE = { x86_64: 't2.micro', arm64: 't4g.micro' }

function InstanceTypeCard({ it }) {
  return (
    <div className={styles.itCardContent}>
      <div className={styles.itCardRow1}>
        <span className={styles.itCardName}>{it.id}</span>
        {it.freeTier && <span className={styles.itCardFree}>Free tier eligible</span>}
      </div>
      <div className={styles.itCardRow2}>
        Family: {it.family}&nbsp;&nbsp;&nbsp;{it.vcpu} vCPU&nbsp;&nbsp;&nbsp;{it.memory} Memory&nbsp;&nbsp;&nbsp;Current generation: {it.currentGen ? 'true' : 'false'}
      </div>
      <div className={styles.itCardPricing}>
        {it.pricing.windows != null && <div>On-Demand Windows base pricing: {it.pricing.windows.toFixed(4)} USD per Hour</div>}
        <div>On-Demand RHEL base pricing: {it.pricing.rhel.toFixed(4)} USD per Hour</div>
        <div>On-Demand Linux base pricing: {it.pricing.linux.toFixed(4)} USD per Hour</div>
        <div>On-Demand Ubuntu Pro base pricing: {it.pricing.ubuntuPro.toFixed(4)} USD per Hour</div>
        <div>On-Demand SUSE base pricing: {it.pricing.suse.toFixed(4)} USD per Hour</div>
      </div>
    </div>
  )
}

function InstanceTypeSelector({ value, onChange, arch }) {
  const [open, setOpen] = useState(false)
  const [allGen, setAllGen] = useState(false)
  const [search, setSearch] = useState('')
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 300 })
  const triggerRef = useRef(null)

  // Close on outside click — only attached while open
  useEffect(() => {
    if (!open) return
    const handler = () => setOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  const openDropdown = (e) => {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  const oldFamilies = ['t1', 'm1', 'c1', 'm2', 'c3', 'm3']
  const filtered = INSTANCE_TYPES.filter(it => {
    if (arch && it.arch !== arch) return false
    if (!allGen && oldFamilies.some(f => it.family === f)) return false
    if (search && !it.id.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selected = INSTANCE_TYPES.find(it => it.id === value) || INSTANCE_TYPES[0]

  return (
    <div className={styles.itSelector}>
      <div className={styles.itSelectorMain}>
        {/* Selected card trigger */}
        <div
          ref={triggerRef}
          className={`${styles.itTrigger} ${open ? styles.itTriggerOpen : ''}`}
          onClick={openDropdown}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && openDropdown(e)}
        >
          <InstanceTypeCard it={selected} />
          <span className={styles.itChevron}>▼</span>
        </div>

        {/* Dropdown — position: fixed to escape overflow:hidden/auto ancestors */}
        {open && (
          <div
            className={styles.itDropdown}
            style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
            onClick={e => e.stopPropagation()}
          >
            <div className={styles.itDropdownHead}>
              <input
                className={styles.itSearch}
                placeholder="Search instance types…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.itList}>
              {filtered.length === 0
                ? <p className={styles.itEmpty}>No instance types match.</p>
                : filtered.map(it => (
                  <div
                    key={it.id}
                    className={`${styles.itOption} ${it.id === value ? styles.itOptionActive : ''}`}
                    onClick={() => { onChange(it.id); setOpen(false); setSearch('') }}
                  >
                    <InstanceTypeCard it={it} />
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className={styles.itSidePanel}>
        <label className={styles.itToggleRow}>
          <button
            type="button"
            className={`${styles.itToggle} ${allGen ? styles.itToggleOn : ''}`}
            onClick={() => setAllGen(v => !v)}
            aria-label="Toggle all generations"
          >
            <span className={styles.itToggleKnob} />
          </button>
          <span className={styles.itToggleLabel}>All generations</span>
        </label>
        <span className={styles.itCompareLink}>Compare instance types</span>
        <p className={styles.itPricingNote}>Additional costs apply for AMIs with pre-installed software</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Quick Start AMIs
───────────────────────────────────────── */
const QUICK_START_AMIS = [
  {
    key: 'al2023', icon: '🐧', name: 'Amazon Linux 2023', freeTier: true,
    fullName: 'Amazon Linux 2023 AMI 2023.8.20250707.0 x86_64 HVM kernel-6.1',
    description: 'Amazon Linux 2023 (kernel-6.1) is a modern, general purpose Linux-based OS that comes with 5 years of long term support, optimized for AWS and designed to provide a secure, stable and high-performance execution environment to develop and run cloud applications.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0c101f26f147fa7fd', bootMode: 'uefi-preferred', published: '2025-07-08', username: 'ec2-user' },
      { arch: '64-bit (Arm)', id: 'ami-03e81965fd8e52909', bootMode: 'uefi',           published: '2025-07-08', username: 'ec2-user' },
    ],
  },
  {
    key: 'al2', icon: '🐧', name: 'Amazon Linux 2', freeTier: true,
    fullName: 'Amazon Linux 2 AMI (HVM) - Kernel 5.10, SSD Volume Type',
    description: 'Amazon Linux 2 is the next generation of Amazon Linux, a Linux server operating system from Amazon Web Services (AWS). It provides a secure, stable, and high-performance execution environment to develop and run cloud and enterprise applications.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0cff7528ff583bf9a', bootMode: 'legacy-bios', published: '2024-01-10', username: 'ec2-user' },
      { arch: '64-bit (Arm)', id: 'ami-0c42ce72d0e46f9c5', bootMode: 'legacy-bios', published: '2024-01-10', username: 'ec2-user' },
    ],
  },
  {
    key: 'ubuntu2404', icon: '🟠', name: 'Ubuntu Server 24.04 LTS', freeTier: true,
    fullName: 'Ubuntu Server 24.04 LTS (HVM), SSD Volume Type',
    description: 'Ubuntu Server 24.04 LTS (Noble Numbat). Ubuntu is a popular open-source operating system for cloud computing with Linux kernel 6.8 and 5 years of LTS support through April 2029.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0e2c8caa4b6378d8c', bootMode: 'uefi-preferred', published: '2024-04-29', username: 'ubuntu' },
      { arch: '64-bit (Arm)', id: 'ami-0f8d219c4e5d8b0b9', bootMode: 'uefi',           published: '2024-04-29', username: 'ubuntu' },
    ],
  },
  {
    key: 'ubuntu2204', icon: '🟠', name: 'Ubuntu Server 22.04 LTS', freeTier: true,
    fullName: 'Ubuntu Server 22.04 LTS (HVM), SSD Volume Type',
    description: 'Ubuntu Server 22.04 LTS (Jammy Jellyfish). Ubuntu is a popular open-source operating system for cloud computing with Linux kernel 5.15 and LTS support through April 2027.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-053b0d53c279acc90', bootMode: 'legacy-bios',    published: '2023-11-20', username: 'ubuntu' },
      { arch: '64-bit (Arm)', id: 'ami-0cd560869e17e5e9b', bootMode: 'uefi-preferred', published: '2023-11-20', username: 'ubuntu' },
    ],
  },
  {
    key: 'windows2022', icon: '🪟', name: 'Windows Server 2022', freeTier: false,
    fullName: 'Microsoft Windows Server 2022 Base',
    description: 'Microsoft Windows Server 2022 Base with 64-bit architecture. AWS provides Windows Server images to help you build, host, and scale Windows workloads on AWS infrastructure.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0c7217cdde317cfec', bootMode: 'uefi', published: '2024-02-08', username: 'Administrator' },
    ],
  },
  {
    key: 'rhel9', icon: '🎩', name: 'RHEL 9', freeTier: false,
    fullName: 'Red Hat Enterprise Linux 9 (HVM), SSD Volume Type',
    description: 'Red Hat Enterprise Linux 9 is the latest major release of RHEL. It includes OpenSSL 3.0, kernel 5.14, and enhanced security and developer tooling for enterprise workloads.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0ba62214afa52bec7', bootMode: 'legacy-bios',    published: '2024-01-30', username: 'ec2-user' },
      { arch: '64-bit (Arm)', id: 'ami-0b9fd9e0ed2e23ad5', bootMode: 'uefi-preferred', published: '2024-01-30', username: 'ec2-user' },
    ],
  },
  {
    key: 'suse15', icon: '🦎', name: 'SUSE Linux 15 SP5', freeTier: false,
    fullName: 'SUSE Linux Enterprise Server 15 SP5 (HVM), SSD Volume Type',
    description: 'SUSE Linux Enterprise Server (SLES) 15 SP5 provides a modern, modular OS for optimizing traditional IT infrastructure while simplifying digital transformation.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-0ce5f4d8e3e4b4e24', bootMode: 'legacy-bios', published: '2023-12-05', username: 'ec2-user' },
    ],
  },
  {
    key: 'debian12', icon: '🌀', name: 'Debian 12', freeTier: false,
    fullName: 'Debian 12 (Bookworm), SSD Volume Type',
    description: 'Debian GNU/Linux 12 (Bookworm) is the latest stable release of Debian. It provides a stable and secure base environment built around the Linux kernel 6.1.',
    virtualization: 'hvm', enaEnabled: true, rootDeviceType: 'ebs',
    variants: [
      { arch: '64-bit (x86)', id: 'ami-064519b8c76274859', bootMode: 'uefi-preferred', published: '2024-03-01', username: 'admin' },
    ],
  },
]

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
function LaunchInstancePage({ onClose, onDone, showToast }) {
  const [form, setForm] = useState({
    name: '', imageId: '', instanceType: 't2.micro', keyName: '',
    minCount: 1, maxCount: 1,
    vpcId: '', subnetId: '', associatePublicIp: true,
  })
  const [selectedAmiKey, setSelectedAmiKey] = useState('al2023')
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0)
  const [tags, setTags] = useState([{ key: '', value: '' }])
  const [selectedSGs, setSelectedSGs] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [userData, setUserData] = useState('')
  const [s3Buckets, setS3Buckets] = useState([])
  const [vpcs, setVpcs] = useState([])
  const [subnets, setSubnets] = useState([])
  const [securityGroups, setSecurityGroups] = useState([])
  const [netLoading, setNetLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/aws/s3/buckets').then(r => r.data.Buckets || []).catch(() => []),
      api.get('/aws/ec2/vpcs').then(r => r.data.Vpcs || []).catch(() => []),
      api.get('/aws/ec2/subnets').then(r => r.data.Subnets || []).catch(() => []),
      api.get('/aws/ec2/security-groups').then(r => r.data.SecurityGroups || []).catch(() => []),
    ]).then(([buckets, vpcList, subnetList, sgList]) => {
      setS3Buckets(buckets)
      setVpcs(vpcList)
      setSubnets(subnetList)
      setSecurityGroups(sgList)
      const defaultVpc = vpcList.find(v => v.IsDefault) || vpcList[0]
      if (defaultVpc) setForm(f => ({ ...f, vpcId: defaultVpc.VpcId }))
    }).finally(() => setNetLoading(false))
  }, [])

  const filteredSubnets = form.vpcId
    ? subnets.filter(s => s.VpcId === form.vpcId)
    : subnets

  const filteredSGs = form.vpcId
    ? securityGroups.filter(sg => sg.VpcId === form.vpcId)
    : securityGroups

  const toggleSG = (id) => {
    setSelectedSGs(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    if (k === 'vpcId') { next.subnetId = ''; setSelectedSGs([]) }
    return next
  })

  const activeAmi = QUICK_START_AMIS.find(a => a.key === selectedAmiKey) || null
  const activeVariant = activeAmi?.variants[selectedVariantIdx] || null

  const archFromVariant = (variant) =>
    variant?.arch?.includes('Arm') ? 'arm64' : 'x86_64'

  const selectAmi = (key) => {
    setSelectedAmiKey(key)
    setSelectedVariantIdx(0)
    const ami = QUICK_START_AMIS.find(a => a.key === key)
    const v = ami?.variants[0]
    if (v) {
      set('imageId', v.id)
      const newArch = archFromVariant(v)
      const cur = INSTANCE_TYPES.find(it => it.id === form.instanceType)
      if (!cur || cur.arch !== newArch) set('instanceType', DEFAULT_INSTANCE[newArch])
    }
  }

  const selectVariant = (idx) => {
    setSelectedVariantIdx(idx)
    const v = activeAmi?.variants[idx]
    if (v) {
      set('imageId', v.id)
      const newArch = archFromVariant(v)
      const cur = INSTANCE_TYPES.find(it => it.id === form.instanceType)
      if (!cur || cur.arch !== newArch) set('instanceType', DEFAULT_INSTANCE[newArch])
    }
  }

  const currentArch = archFromVariant(activeVariant)

  useEffect(() => {
    const ami = QUICK_START_AMIS.find(a => a.key === 'al2023')
    if (ami?.variants[0]) set('imageId', ami.variants[0].id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setErr('Name is required.')
    if (!form.imageId.trim()) return setErr('AMI ID is required.')
    setBusy(true); setErr('')
    try {
      const validTags = tags.filter(t => t.key.trim() && t.value.trim())
      await api.post('/aws/ec2/instances/run', {
        name: form.name.trim(),
        imageId: form.imageId.trim(),
        instanceType: form.instanceType,
        minCount: Number(form.minCount),
        maxCount: Number(form.maxCount),
        ...(form.keyName.trim() ? { keyName: form.keyName.trim() } : {}),
        ...(userData.trim() ? { userData: userData.trim() } : {}),
        ...(form.subnetId ? { subnetId: form.subnetId } : {}),
        ...(selectedSGs.length ? { securityGroupIds: selectedSGs } : {}),
        associatePublicIpAddress: form.associatePublicIp,
        ...(validTags.length ? { tags: validTags } : {}),
      })
      showToast('Instance launch requested.')
      onDone()
      onClose()
    } catch (ex) {
      setErr(ex.response?.data?.message || ex.message)
    } finally { setBusy(false) }
  }

  return (
    <div className={styles.launchPage}>
      {/* Page header */}
      <div className={styles.launchPageHeader}>
        <div className={styles.launchBreadcrumb}>
          <span className={styles.breadLink}>EC2</span>
          <span className={styles.breadSep}>›</span>
          <span className={styles.breadLink}>Instances</span>
          <span className={styles.breadSep}>›</span>
          <span className={styles.breadCurrent}>Launch an instance</span>
        </div>
        <h1 className={styles.launchPageTitle}>Launch an instance</h1>
      </div>

      {/* Scrollable form body */}
      <form className={styles.launchPageBody} onSubmit={submit}>

        {/* Name and tags */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Name and tags</div>
          <div className={styles.launchSectionBody}>
            <div className={styles.launchField}>
              <label className={styles.launchLabel}>Name *</label>
              <input
                className={styles.launchInput}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="My instance"
              />
            </div>

            {/* Additional tags */}
            <div className={styles.launchTagsBlock}>
              <div className={styles.launchTagsHeader}>
                <span className={styles.launchLabel}>Additional tags</span>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                  onClick={() => setTags(prev => [...prev, { key: '', value: '' }])}
                >
                  + Add tag
                </button>
              </div>
              {tags.length > 0 && (
                <div className={styles.launchTagList}>
                  <div className={styles.launchTagHeaderRow}>
                    <span className={styles.launchTagColLabel}>Key</span>
                    <span className={styles.launchTagColLabel}>Value</span>
                  </div>
                  {tags.map((tag, i) => (
                    <div key={i} className={styles.launchTagRow}>
                      <input
                        className={styles.launchInput}
                        value={tag.key}
                        onChange={e => setTags(prev => prev.map((t, j) => j === i ? { ...t, key: e.target.value } : t))}
                        placeholder="e.g. Environment"
                      />
                      <input
                        className={styles.launchInput}
                        value={tag.value}
                        onChange={e => setTags(prev => prev.map((t, j) => j === i ? { ...t, value: e.target.value } : t))}
                        placeholder="e.g. Production"
                      />
                      <button
                        type="button"
                        className={styles.launchTagRemove}
                        onClick={() => setTags(prev => prev.filter((_, j) => j !== i))}
                        title="Remove tag"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className={styles.launchHint}>Tags are key-value pairs applied to this instance. The Name tag is set above.</p>
            </div>
          </div>
        </div>

        {/* Application and OS Images */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Application and OS Images (Amazon Machine Image)</div>
          <div className={styles.launchSectionBody}>

            {/* Quick Start OS tabs */}
            <p className={styles.amiQsLabel}>Quick Start</p>
            <div className={styles.amiTabs}>
              {QUICK_START_AMIS.map(ami => (
                <button
                  key={ami.key}
                  type="button"
                  className={`${styles.amiTab} ${selectedAmiKey === ami.key ? styles.amiTabActive : ''}`}
                  onClick={() => selectAmi(ami.key)}
                >
                  <span className={styles.amiTabIcon}>{ami.icon}</span>
                  <span className={styles.amiTabName}>{ami.name}</span>
                  {ami.freeTier && <span className={styles.amiTabFree}>Free tier</span>}
                </button>
              ))}
            </div>

            {/* Selected AMI detail panel */}
            {activeAmi && (
              <div className={styles.amiPanel}>
                {/* Header */}
                <div className={styles.amiPanelHead}>
                  <div className={styles.amiPanelTitle}>{activeAmi.fullName}</div>
                  <div className={styles.amiPanelIds}>
                    {activeAmi.variants.map((v, i) => (
                      <span key={i} className={styles.amiPanelIdChip}>
                        {v.id} ({v.arch}){i < activeAmi.variants.length - 1 ? ' /' : ''}
                      </span>
                    ))}
                  </div>
                  <div className={styles.amiPanelMeta}>
                    <span>Virtualization: <strong>{activeAmi.virtualization}</strong></span>
                    <span>ENA enabled: <strong>{activeAmi.enaEnabled ? 'true' : 'false'}</strong></span>
                    <span>Root device type: <strong>{activeAmi.rootDeviceType}</strong></span>
                  </div>
                </div>

                {/* Description */}
                <div className={styles.amiPanelDesc}>
                  <p className={styles.amiPanelDescTitle}>Description</p>
                  <p className={styles.amiPanelDescText}>{activeAmi.description}</p>
                  <p className={styles.amiPanelDescFull}>{activeAmi.fullName}</p>
                </div>

                {/* Five detail columns */}
                <div className={styles.amiPanelCols}>
                  <div className={styles.amiPanelCol}>
                    <span className={styles.amiColHead}>Architecture</span>
                    <select
                      className={styles.amiArchSelect}
                      value={selectedVariantIdx}
                      onChange={e => selectVariant(Number(e.target.value))}
                    >
                      {activeAmi.variants.map((v, i) => (
                        <option key={i} value={i}>{v.arch}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.amiPanelCol}>
                    <span className={styles.amiColHead}>Boot mode</span>
                    <span className={styles.amiColVal}>{activeVariant?.bootMode}</span>
                  </div>
                  <div className={styles.amiPanelCol}>
                    <span className={styles.amiColHead}>AMI ID</span>
                    <span className={styles.amiColMono} title={activeVariant?.id}>{activeVariant?.id}</span>
                  </div>
                  <div className={styles.amiPanelCol}>
                    <span className={styles.amiColHead}>Publish Date</span>
                    <span className={styles.amiColVal}>{activeVariant?.published}</span>
                  </div>
                  <div className={styles.amiPanelCol}>
                    <span className={styles.amiColHead}>Username</span>
                    <span className={styles.amiColUser}>{activeVariant?.username}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Manual override */}
            <div className={styles.launchField} style={{ marginTop: 16 }}>
              <label className={styles.launchLabel}>AMI ID *</label>
              <input
                className={styles.launchInput}
                value={form.imageId}
                onChange={e => set('imageId', e.target.value)}
                placeholder="ami-0abcdef1234567890"
              />
              <p className={styles.launchHint}>Auto-filled from the Quick Start selection above, or enter a custom AMI ID.</p>
            </div>
          </div>
        </div>

        {/* Instance type */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Instance type</div>
          <div className={styles.launchSectionBody}>
            <InstanceTypeSelector
              value={form.instanceType}
              onChange={v => set('instanceType', v)}
              arch={currentArch}
            />
          </div>
        </div>

        {/* Key pair */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Key pair (login)</div>
          <div className={styles.launchSectionBody}>
            <div className={styles.launchField}>
              <label className={styles.launchLabel}>
                Key pair name <span className={styles.launchOptional}>(optional)</span>
              </label>
              <input
                className={styles.launchInput}
                value={form.keyName}
                onChange={e => set('keyName', e.target.value)}
                placeholder="my-key-pair"
              />
              <p className={styles.launchHint}>A key pair allows you to connect securely to your instance via SSH.</p>
            </div>
          </div>
        </div>

        {/* Number of instances */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Number of instances</div>
          <div className={styles.launchSectionBody}>
            <div className={styles.launchGrid2}>
              <div className={styles.launchField}>
                <label className={styles.launchLabel}>Min count</label>
                <input
                  className={styles.launchInput}
                  type="number"
                  min="1"
                  value={form.minCount}
                  onChange={e => set('minCount', e.target.value)}
                  style={{ maxWidth: 140 }}
                />
              </div>
              <div className={styles.launchField}>
                <label className={styles.launchLabel}>Max count</label>
                <input
                  className={styles.launchInput}
                  type="number"
                  min="1"
                  value={form.maxCount}
                  onChange={e => set('maxCount', e.target.value)}
                  style={{ maxWidth: 140 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Network settings */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Network settings</div>
          <div className={styles.launchSectionBody}>
            {netLoading ? (
              <p className={styles.launchHint}>Loading network resources…</p>
            ) : (
              <div className={styles.launchNetGrid}>
                {/* VPC */}
                <div className={styles.launchField}>
                  <label className={styles.launchLabel}>VPC</label>
                  <select
                    className={styles.launchInput}
                    value={form.vpcId}
                    onChange={e => set('vpcId', e.target.value)}
                  >
                    <option value="">— No preference —</option>
                    {vpcs.map(v => (
                      <option key={v.VpcId} value={v.VpcId}>
                        {v.VpcId}{v.IsDefault ? ' (default)' : ''}{v.CidrBlock ? ` — ${v.CidrBlock}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className={styles.launchHint}>Virtual private cloud where the instance will run.</p>
                </div>

                {/* Subnet */}
                <div className={styles.launchField}>
                  <label className={styles.launchLabel}>
                    Subnet <span className={styles.launchOptional}>(optional)</span>
                  </label>
                  <select
                    className={styles.launchInput}
                    value={form.subnetId}
                    onChange={e => set('subnetId', e.target.value)}
                  >
                    <option value="">— No preference —</option>
                    {filteredSubnets.map(s => (
                      <option key={s.SubnetId} value={s.SubnetId}>
                        {s.SubnetId}{s.AvailabilityZone ? ` (${s.AvailabilityZone})` : ''}{s.CidrBlock ? ` — ${s.CidrBlock}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className={styles.launchHint}>
                    {filteredSubnets.length === 0 && form.vpcId
                      ? 'No subnets found for this VPC.'
                      : 'Subnet within the selected VPC.'}
                  </p>
                </div>

                {/* Auto-assign public IP */}
                <div className={styles.launchField}>
                  <label className={styles.launchLabel}>Auto-assign public IP</label>
                  <div className={styles.launchRadioGroup}>
                    {[{ val: true, label: 'Enable' }, { val: false, label: 'Disable' }].map(opt => (
                      <label key={String(opt.val)} className={styles.launchRadioRow}>
                        <input
                          type="radio"
                          name="publicIp"
                          checked={form.associatePublicIp === opt.val}
                          onChange={() => set('associatePublicIp', opt.val)}
                          className={styles.launchRadio}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  <p className={styles.launchHint}>Assigns a public IPv4 address from Amazon's pool.</p>
                </div>

                {/* Security Groups */}
                <div className={`${styles.launchField} ${styles.launchFieldFull}`}>
                  <label className={styles.launchLabel}>
                    Firewall (security groups) <span className={styles.launchOptional}>(optional)</span>
                  </label>
                  {filteredSGs.length === 0 ? (
                    <p className={styles.launchHint}>
                      {form.vpcId ? 'No security groups found for this VPC.' : 'Select a VPC to filter security groups.'}
                    </p>
                  ) : (
                    <div className={styles.launchSgList}>
                      {filteredSGs.map(sg => (
                        <label key={sg.GroupId} className={styles.launchSgRow}>
                          <input
                            type="checkbox"
                            checked={selectedSGs.includes(sg.GroupId)}
                            onChange={() => toggleSG(sg.GroupId)}
                            className={styles.launchCheckbox}
                          />
                          <span className={styles.launchSgName}>{sg.GroupName}</span>
                          <span className={styles.launchSgId}>{sg.GroupId}</span>
                          {sg.Description && (
                            <span className={styles.launchSgDesc}>{sg.Description}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  {selectedSGs.length > 0 && (
                    <p className={styles.launchHint}>{selectedSGs.length} group{selectedSGs.length !== 1 ? 's' : ''} selected.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Advanced details — User data */}
        <div className={styles.launchSection}>
          <div className={styles.launchSectionTitle}>Advanced details</div>
          <div className={styles.launchSectionBody}>
            <div className={styles.launchField}>
              <div className={styles.launchLabelRow}>
                <label className={styles.launchLabel}>
                  User data <span className={styles.launchOptional}>(optional)</span>
                </label>
                {s3Buckets.length > 0 && (
                  <div className={styles.launchS3Row}>
                    <span className={styles.launchS3Label}>S3 bootstrap:</span>
                    <select
                      className={styles.launchInput}
                      style={{ width: 'auto', fontSize: '0.8rem', padding: '3px 8px' }}
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
                className={styles.launchInput}
                value={userData}
                onChange={e => setUserData(e.target.value)}
                placeholder={"#!/bin/bash\necho 'Hello, World!' > /tmp/hello.txt"}
                rows={7}
                style={{ fontFamily: 'monospace', fontSize: '0.78rem', resize: 'vertical' }}
              />
              <p className={styles.launchHint}>
                Script runs on first boot. Select an S3 bucket above to auto-generate an S3 sync script.
              </p>
            </div>
          </div>
        </div>

        {err && <p className={styles.launchErr}>{err}</p>}

        {/* Sticky footer */}
        <div className={styles.launchFooter}>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy}>
            {busy ? 'Launching…' : 'Launch instance'}
          </button>
        </div>
      </form>
    </div>
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

  if (modal === 'launch') {
    return (
      <LaunchInstancePage
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null)
          if (section === 'dashboard') fetchDashboard()
          else fetchSection('instances')
        }}
        showToast={showToast}
      />
    )
  }

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
