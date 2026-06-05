import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useRegion, REGIONS } from '../context/RegionContext'
import S3Console from '../components/s3/S3Console'
import CloudShell from '../components/CloudShell'
import styles from './AWSPortal.module.css'

const BucketSVG = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* bucket body */}
    <path d="M5.5 9.5L7 20h10l1.5-10.5H5.5z" opacity="0.85"/>
    {/* bucket rim */}
    <ellipse cx="12" cy="9.5" rx="6.5" ry="2"/>
    {/* handle arc */}
    <path d="M9 7.5C9 5.567 10.343 4 12 4s3 1.567 3 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
  </svg>
)

const SERVICES = [
  {
    name: 'S3',
    full: 'Simple Storage Service',
    category: 'Storage',
    desc: 'Scalable object storage with high availability and security.',
    color: '#3f8624',
    bg: '#e6f2df',
    abbr: 'S3',
    icon: BucketSVG,
  },
  {
    name: 'EC2',
    full: 'Elastic Compute Cloud',
    category: 'Compute',
    desc: 'Secure, resizable compute capacity in the cloud.',
    color: '#c7511f',
    bg: '#fce8d8',
    abbr: 'EC2',
  },
  {
    name: 'Lambda',
    full: 'Lambda',
    category: 'Compute',
    desc: 'Run code without provisioning or managing servers.',
    color: '#c7511f',
    bg: '#fce8d8',
    abbr: 'λ',
  },
  {
    name: 'IAM',
    full: 'Identity and Access Management',
    category: 'Security, Identity & Compliance',
    desc: 'Securely manage access to AWS services and resources.',
    color: '#c7131f',
    bg: '#fddcde',
    abbr: 'IAM',
  },
  {
    name: 'CloudWatch',
    full: 'CloudWatch',
    category: 'Management & Governance',
    desc: 'Observe and monitor resources and applications on AWS.',
    color: '#c7006a',
    bg: '#fcd6eb',
    abbr: 'CW',
  },
]

const ALL_SERVICES_BY_CATEGORY = [
  { category: 'Compute',                    items: ['EC2', 'Lambda'] },
  { category: 'Storage',                    items: ['S3'] },
  { category: 'Security, Identity',         items: ['IAM'] },
  { category: 'Management & Governance',    items: ['CloudWatch'] },
]

const ICON_PX = { xs: 10, sm: 14, md: 18, lg: 24, xl: 28 }

function ServiceIcon({ service, size = 'md' }) {
  const Icon = service.icon
  return (
    <div
      className={`${styles.svcIcon} ${styles['svcIcon_' + size]}`}
      style={{ background: service.bg, color: service.color }}
    >
      {Icon ? <Icon size={ICON_PX[size] ?? 18} /> : service.abbr}
    </div>
  )
}

/* ── Region selector dropdown ── */
const REGION_GROUPS = [...new Set(REGIONS.map(r => r.group))]

function RegionDropdown() {
  const { region, setRegion } = useRegion()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const filtered = search
    ? REGIONS.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.code.includes(search.toLowerCase()))
    : REGIONS

  const grouped = REGION_GROUPS.map(g => ({
    group: g,
    items: filtered.filter(r => r.group === g),
  })).filter(g => g.items.length > 0)

  return (
    <div className={styles.regionWrap} ref={ref}>
      <button
        className={`${styles.navBtn} ${open ? styles.navBtnActive : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M3 12h18" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        {region.code}
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.regionPanel}>
          <div className={styles.regionPanelHead}>
            <div className={styles.regionPanelTitle}>Select a Region</div>
            <input
              className={styles.regionSearch}
              placeholder="Search regions…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className={styles.regionList}>
            {grouped.map(g => (
              <div key={g.group}>
                <div className={styles.regionGroup}>{g.group}</div>
                {g.items.map(r => (
                  <button
                    key={r.code}
                    className={`${styles.regionItem} ${r.code === region.code ? styles.regionItemActive : ''}`}
                    onClick={() => { setRegion(r.code); setOpen(false); setSearch('') }}
                  >
                    <span className={styles.regionItemName}>{r.name}</span>
                    <span className={styles.regionItemCode}>{r.code}</span>
                    {r.code === region.code && <span className={styles.regionCheck}>✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Portal loading screen ── */
function PortalLoader() {
  return (
    <div className={styles.loaderPage}>
      <div className={styles.loaderBox}>
        <div className={styles.loaderLogo}>
          <span className={styles.loaderCloudlabs}>CloudLabs</span>
          <div className={styles.loaderAwsRow}>
            <span className={styles.loaderAws}>AWS</span>
            <svg className={styles.loaderSmile} viewBox="0 0 56 10" aria-hidden="true">
              <path d="M2 3 Q14 10 28 5.5 Q42 1 54 8" stroke="#ff9900" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className={styles.loaderTrack}>
          <div className={styles.loaderFill} />
        </div>
        <p className={styles.loaderText}>Initializing AWS Management Console…</p>
      </div>
    </div>
  )
}

/* ── Portal exit screen ── */
function PortalExitLoader() {
  return (
    <div className={styles.loaderPage}>
      <div className={styles.loaderBox}>
        <div className={styles.loaderLogo}>
          <span className={styles.loaderCloudlabs}>CloudLabs</span>
          <div className={styles.loaderAwsRow}>
            <span className={styles.loaderAws}>AWS</span>
            <svg className={styles.loaderSmile} viewBox="0 0 56 10" aria-hidden="true">
              <path d="M2 3 Q14 10 28 5.5 Q42 1 54 8" stroke="#ff9900" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        <div className={styles.loaderTrack}>
          <div className={styles.exitLoaderFill} />
        </div>
        <p className={styles.loaderText}>Signing out of AWS Management Console…</p>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════
   CONSOLE HOME — two-column AWS-style layout
════════════════════════════════════════════════ */
const BUILD_CARDS = [
  { icon: '🪣', title: 'Create an S3 bucket',        desc: 'Store and retrieve any amount of data.',         service: 'S3' },
  { icon: '🖥',  title: 'Launch an EC2 instance',     desc: 'Spin up virtual servers in minutes.',            service: 'EC2' },
  { icon: 'λ',  title: 'Build a Lambda function',    desc: 'Run code without managing servers.',             service: 'Lambda' },
  { icon: '🔐', title: 'Manage IAM access',          desc: 'Control access to your AWS resources.',         service: 'IAM' },
  { icon: '📊', title: 'Monitor with CloudWatch',    desc: 'Collect metrics, logs, and set alarms.',        service: 'CloudWatch' },
]

const WHAT_NEW = [
  { date: 'Jun 2026', title: 'S3 Object Lock GA',             desc: 'Immutable object storage now supports WORM compliance.' },
  { date: 'May 2026', title: 'Lambda SnapStart for Node.js',  desc: 'Sub-second cold starts for Node.js 18+ functions.' },
  { date: 'Apr 2026', title: 'IAM Identity Center updates',   desc: 'Simplified multi-account access management.' },
]

function ConsoleHome({ username, search, filtered, activeService, setActiveService, selected, region }) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)

  return (
    <div className={styles.consoleHome}>

      {/* ── Left: main content ── */}
      <div className={styles.consoleMain}>

        {/* Page heading */}
        <div className={styles.pageHead}>
          <h1 className={styles.pageTitle}>Console Home</h1>
          <button className={styles.customizeBtn}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 20h9" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="#0073bb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Customize layout
          </button>
        </div>

        {/* Welcome banner */}
        {!welcomeDismissed && !search && (
          <div className={styles.welcomeBanner}>
            <div className={styles.welcomeLeft}>
              <div className={styles.welcomeGreeting}>Welcome back, {username} 👋</div>
              <p className={styles.welcomeSub}>
                You're connected to your isolated AWS environment in <strong>{region?.code || 'us-east-1'}</strong>.
                Explore services below or use the search bar to find what you need.
              </p>
            </div>
            <button className={styles.welcomeDismiss} onClick={() => setWelcomeDismissed(true)}>✕</button>
          </div>
        )}

        {/* Recently visited */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {search ? `Results for "${search}"` : 'Recently visited'}
            </h2>
            {!search && <button className={styles.sectionLink}>Edit ✎</button>}
          </div>
          {filtered.length === 0
            ? <p className={styles.noResults}>No services match your search.</p>
            : (
              <div className={styles.tileRow}>
                {filtered.map(s => (
                  <div
                    key={s.name}
                    className={`${styles.tile} ${activeService === s.name ? styles.tileActive : ''}`}
                    onClick={() => setActiveService(s.name === activeService ? null : s.name)}
                  >
                    <ServiceIcon service={s} size="lg" />
                    <div className={styles.tileName}>{s.name}</div>
                    <div className={styles.tileFull}>{s.full}</div>
                  </div>
                ))}
              </div>
            )}
        </section>

        {/* Service detail panel */}
        {selected && (
          <div className={styles.detailCard}>
            <div className={styles.detailTop} style={{ borderLeftColor: selected.color }}>
              <ServiceIcon service={selected} size="xl" />
              <div className={styles.detailInfo}>
                <h3 className={styles.detailName}>{selected.full}</h3>
                <p className={styles.detailDesc}>{selected.desc}</p>
                <div className={styles.detailTags}>
                  <span className={styles.tag}>{selected.category}</span>
                  <span className={styles.tag}>{region?.code || 'us-east-1'}</span>
                  <span className={`${styles.tag} ${styles.tagGreen}`}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" fill="#1d8102"/>
                      <path d="M3.5 6l2 2 3-3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Build a solution */}
        {!search && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Build a solution</h2>
              <button className={styles.sectionLink}>View all</button>
            </div>
            <div className={styles.buildGrid}>
              {BUILD_CARDS.map(c => (
                <div
                  key={c.title}
                  className={styles.buildCard}
                  onClick={() => setActiveService(c.service)}
                >
                  <span className={styles.buildIcon}>{c.icon}</span>
                  <div className={styles.buildTitle}>{c.title}</div>
                  <div className={styles.buildDesc}>{c.desc}</div>
                  <span className={styles.buildArrow}>→</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All services */}
        {!search && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>All services</h2>
            </div>
            <div className={styles.allServicesGrid}>
              {ALL_SERVICES_BY_CATEGORY.map(g => (
                <div key={g.category} className={styles.catBlock}>
                  <div className={styles.catTitle}>{g.category}</div>
                  {g.items.map(name => {
                    const s = SERVICES.find(x => x.name === name)
                    return (
                      <div
                        key={name}
                        className={`${styles.catItem} ${activeService === name ? styles.catItemActive : ''}`}
                        onClick={() => setActiveService(name === activeService ? null : name)}
                      >
                        <ServiceIcon service={s} size="sm" />
                        <div>
                          <div className={styles.catItemName}>{s.name}</div>
                          <div className={styles.catItemFull}>{s.full}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ── Right: sidebar widgets ── */}
      {!search && (
        <aside className={styles.consoleSidebar}>

          {/* AWS Health */}
          <div className={styles.sideWidget}>
            <div className={styles.sideWidgetHead}>
              <span className={styles.sideWidgetTitle}>AWS Health</span>
              <button className={styles.widgetLink}>View all events</button>
            </div>
            <div className={styles.sideWidgetBody}>
              <div className={styles.healthBadge}>
                <span className={styles.healthDot} />
                <div>
                  <div className={styles.healthLabel}>No active issues</div>
                  <div className={styles.healthSub}>All services are operating normally in {region?.code || 'us-east-1'}</div>
                </div>
              </div>
              <div className={styles.healthStats}>
                {[{ n: 0, l: 'Open' }, { n: 0, l: 'Upcoming' }, { n: 0, l: 'Resolved' }].map(s => (
                  <div key={s.l} className={styles.healthStat}>
                    <div className={styles.healthStatNum}>{s.n}</div>
                    <div className={styles.healthStatLabel}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cost & Usage */}
          <div className={styles.sideWidget}>
            <div className={styles.sideWidgetHead}>
              <span className={styles.sideWidgetTitle}>Cost &amp; usage</span>
              <button className={styles.widgetLink}>View details</button>
            </div>
            <div className={styles.sideWidgetBody}>
              <div className={styles.costMain}>
                <span className={styles.costAmount}>$0.00</span>
                <span className={styles.costLabel}>Month-to-date cost</span>
              </div>
              <div className={styles.costBars}>
                {['S3', 'EC2', 'Lambda', 'IAM', 'CW'].map((name, i) => (
                  <div key={name} className={styles.costBar}>
                    <div className={styles.costBarLabel}>{name}</div>
                    <div className={styles.costBarTrack}>
                      <div className={styles.costBarFill} style={{ width: `${[20, 45, 30, 15, 10][i]}%` }} />
                    </div>
                    <div className={styles.costBarVal}>$0</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trusted Advisor */}
          <div className={styles.sideWidget}>
            <div className={styles.sideWidgetHead}>
              <span className={styles.sideWidgetTitle}>Trusted Advisor</span>
              <button className={styles.widgetLink}>View all checks</button>
            </div>
            <div className={styles.sideWidgetBody}>
              <div className={styles.taGrid}>
                {[
                  { label: 'Cost Opt.',    count: 0, color: '#3fb950' },
                  { label: 'Security',     count: 0, color: '#3fb950' },
                  { label: 'Performance',  count: 0, color: '#3fb950' },
                  { label: 'Fault Tol.',   count: 0, color: '#3fb950' },
                ].map(c => (
                  <div key={c.label} className={styles.taItem}>
                    <div className={styles.taDot} style={{ background: c.color }} />
                    <div className={styles.taLabel}>{c.label}</div>
                    <div className={styles.taCount}>{c.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What's new */}
          <div className={styles.sideWidget}>
            <div className={styles.sideWidgetHead}>
              <span className={styles.sideWidgetTitle}>What's new</span>
              <button className={styles.widgetLink}>View all</button>
            </div>
            <div className={styles.sideWidgetBody}>
              {WHAT_NEW.map(w => (
                <div key={w.title} className={styles.whatNewItem}>
                  <div className={styles.whatNewDate}>{w.date}</div>
                  <div className={styles.whatNewTitle}>{w.title}</div>
                  <div className={styles.whatNewDesc}>{w.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active region */}
          <div className={styles.sideWidget}>
            <div className={styles.sideWidgetHead}>
              <span className={styles.sideWidgetTitle}>Active services</span>
            </div>
            <div className={styles.sideWidgetBody}>
              <div className={styles.chipRow}>
                {SERVICES.map(s => (
                  <span key={s.name} className={styles.svcChip}
                    style={{ background: s.bg, color: s.color }}
                    onClick={() => setActiveService(s.name)}>
                    {s.name}
                  </span>
                ))}
              </div>
              <div className={styles.regionPill}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#0073bb" strokeWidth="1.5"/>
                  <path d="M12 3c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
                  <path d="M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9" stroke="#0073bb" strokeWidth="1.5" fill="none"/>
                  <path d="M3 12h18" stroke="#0073bb" strokeWidth="1.5"/>
                </svg>
                {region?.name || 'US East (N. Virginia)'} — {region?.code || 'us-east-1'}
              </div>
            </div>
          </div>

        </aside>
      )}
    </div>
  )
}

function AWSPortal() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { region } = useRegion()
  const [loading,  setLoading]  = useState(true)
  const [exiting,  setExiting]  = useState(false)
  const [search, setSearch] = useState('')
  const [activeService, setActiveService] = useState(null)
  const [showShell, setShowShell] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2200)
    return () => clearTimeout(t)
  }, [])

  const handleExit = () => {
    setExiting(true)
    setTimeout(() => navigate('/dashboard'), 2000)
  }

  const username = user?.username || user?.email?.split('@')[0] || 'User'

  const filtered = search
    ? SERVICES.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.full.toLowerCase().includes(search.toLowerCase()) ||
        s.category.toLowerCase().includes(search.toLowerCase())
      )
    : SERVICES

  const selected = activeService ? SERVICES.find(s => s.name === activeService) : null

  if (loading)  return <PortalLoader />
  if (exiting)  return <PortalExitLoader />

  return (
    <div className={styles.portal}>

      {/* ── Top Navigation Bar ── */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <button className={styles.hamburger} aria-label="menu">
            <span /><span /><span />
          </button>

          {/* CloudLabs AWS Logo */}
          <div className={styles.logo}>
            <div className={styles.logoTop}>
              <span className={styles.logoCloudlabs}>CloudLabs</span>
            </div>
            <div className={styles.logoBottom}>
              <span className={styles.logoAws}>AWS</span>
              <svg className={styles.logoSmile} viewBox="0 0 56 10" aria-hidden="true">
                <path
                  d="M2 3 Q14 10 28 5.5 Q42 1 54 8"
                  stroke="#ff9900"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div className={styles.navDivider} />
          <button className={styles.navBtn}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="0" y="0" width="5.5" height="5.5" rx="1" fill="#d5dbdb"/>
              <rect x="8.5" y="0" width="5.5" height="5.5" rx="1" fill="#d5dbdb"/>
              <rect x="0" y="8.5" width="5.5" height="5.5" rx="1" fill="#d5dbdb"/>
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="#d5dbdb"/>
            </svg>
            Services
          </button>
        </div>

        <div className={styles.navCenter}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.75" stroke="#8c9bb5" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="#8c9bb5" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className={styles.searchInput}
              placeholder="Search for services, features, and docs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className={styles.searchShortcut}>[Alt+S]</span>
          </div>
        </div>

        <div className={styles.navRight}>
          {/* CloudShell */}
          <button
            className={`${styles.navIconBtn} ${showShell ? styles.navIconBtnActive : ''}`}
            title="CloudShell"
            onClick={() => setShowShell(s => !s)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="18" rx="2" stroke={showShell ? '#ff9900' : '#d5dbdb'} strokeWidth="1.5"/>
              <path d="M7 8l4 4-4 4" stroke={showShell ? '#ff9900' : '#d5dbdb'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13 16h4" stroke={showShell ? '#ff9900' : '#d5dbdb'} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Bell */}
          <button className={styles.navIconBtn} title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="#d5dbdb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="#d5dbdb" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className={styles.navDivider} />
          <button className={styles.navBtn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="#d5dbdb" strokeWidth="1.5"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#d5dbdb" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {username}
            <span className={styles.caret}>▾</span>
          </button>
          <RegionDropdown />
          <button className={styles.navBtn}>Support <span className={styles.caret}>▾</span></button>
          <div className={styles.navDivider} />
          <button className={styles.exitBtn} onClick={handleExit}>
            ← Exit
          </button>
        </div>
      </nav>

      {/* ── Toolbar / Favorites Bar ── */}
      <div className={styles.toolbar}>
        <svg className={styles.toolbarStar} width="14" height="14" viewBox="0 0 24 24" fill="#8c9bb5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span className={styles.toolbarActive}>Console Home</span>
        {SERVICES.map(s => (
          <button
            key={s.name}
            className={`${styles.toolbarItem} ${activeService === s.name ? styles.toolbarItemActive : ''}`}
            onClick={() => setActiveService(s.name === activeService ? null : s.name)}
          >
            {s.name}
          </button>
        ))}
        <span className={styles.toolbarSep} />
        <span className={styles.toolbarRegion}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#8c9bb5" strokeWidth="1.5"/>
            <path d="M12 2c-2.8 2.8-4 6-4 10s1.2 7.2 4 10" stroke="#8c9bb5" strokeWidth="1.5" fill="none"/>
            <path d="M12 2c2.8 2.8 4 6 4 10s-1.2 7.2-4 10" stroke="#8c9bb5" strokeWidth="1.5" fill="none"/>
            <path d="M3 12h18" stroke="#8c9bb5" strokeWidth="1.5"/>
          </svg>
          {region?.code || 'us-east-1'}
        </span>
      </div>

      {/* ── Page Layout ── */}
      <div className={styles.layout}>

        {/* Main */}
        <main className={styles.main}>

          {/* S3 Console — full-width when active */}
          {activeService === 'S3' && (
            <S3Console onBack={() => setActiveService(null)} />
          )}

          {activeService !== 'S3' && (
          <ConsoleHome
            username={username}
            search={search}
            filtered={filtered}
            activeService={activeService}
            setActiveService={setActiveService}
            selected={selected}
            region={region}
          />
          )}

        </main>
      </div>

      {showShell && <CloudShell onClose={() => setShowShell(false)} />}
    </div>
  )
}

export default AWSPortal
