'use client';
import { authStorage, fetchWithAuth } from '@/lib/fetchWithAuth';
import { toast } from 'sonner';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Moon, Sun, Droplets, Monitor, User, ClipboardList, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchProjects as fetchProjectsList, API_BASE } from '@/lib/queries';
import { AVATARS } from '@/features/dashboard/components/AccountPage/avatars';
import { openAiPanel } from '@/components/AiChatPanel/AiChatPanel';
import styles from './TopNavbar.module.scss';

// Use the shared constant — avoids repeating the env-var fallback across files.
const API = API_BASE;

interface Project {
  id: string;
  name: string;
  serviceMode?: 'single' | 'multi';
}

/* ── Inline SVG icons (no lucide dep for these) ── */
const SingleSvcIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="8"/>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
  </svg>
);

const MultiSvcIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="7.5" r="4.5"/>
    <circle cx="7.5" cy="15.5" r="4.5"/>
    <circle cx="16.5" cy="15.5" r="4.5"/>
    <circle cx="12" cy="7.5" r="1.8" fill="currentColor" stroke="none"/>
    <circle cx="7.5" cy="15.5" r="1.8" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="15.5" r="1.8" fill="currentColor" stroke="none"/>
  </svg>
);

const ProjectsStackIcon = () => (
  <svg viewBox="0 0 28 28" fill="none" width="14" height="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="11" width="24" height="14" rx="2.5"/>
    <rect x="4.5" y="7" width="19" height="14" rx="2"/>
    <rect x="7" y="3" width="14" height="14" rx="1.5"/>
    <line x1="10" y1="8" x2="18" y2="8"/>
    <line x1="10" y1="11" x2="15.5" y2="11"/>
  </svg>
);

export default function TopNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isProjectsPage = pathname === '/projects';
  const isAccountPage = pathname.startsWith('/projects/account');
  const isAuditPage = pathname === '/projects/account/audit';
  const isServicesPage = pathname === '/services';

  const { user, logoutWithTransition } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  // Read cached service name synchronously (avoids 'Loading...' flash on navigation)
  const [activeServiceName, setActiveServiceName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const sid = new URLSearchParams(window.location.search).get('serviceId');
    if (!sid) return '';
    return localStorage.getItem(`svcName:${sid}`) ?? '';
  });
  const [showUserDrop, setShowUserDrop] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [avatarIndex, setAvatarIndex] = useState<number>(0);

  const userRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const getAvatar = () => parseInt(localStorage.getItem('userAvatarIndex') ?? '0', 10);
      
      setAvatarIndex(getAvatar());

      const handleStorage = () => setAvatarIndex(getAvatar());
      window.addEventListener('storage', handleStorage);
      window.addEventListener('avatarChanged', handleStorage);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('avatarChanged', handleStorage);
      };
    }
  }, []);

  const currentAvatar = AVATARS[avatarIndex] ?? AVATARS[0];


  /* ── Projects via React Query — deduplicates with all other pages ── */
  const hasSession = !!user || authStorage.hasSession();
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjectsList,
    enabled: hasSession,
    staleTime: 60_000,
  });

  // Derive active project from cache — zero extra network requests
  useEffect(() => {
    const urlId = searchParams.get('projectId');
    const savedId = localStorage.getItem('activeProjectId');
    const targetId = urlId ?? savedId;
    const found = projects.find(p => p.id === targetId) ?? projects[0] ?? null;
    setActiveProject(found as Project | null);
  }, [projects, searchParams]);

  /* ── fetch active service name — only when on a dashboard page with a projectId ── */
  useEffect(() => {
    const serviceId = searchParams.get('serviceId');
    const projectId = searchParams.get('projectId');

    // Guard: skip fetch on pages that never need a service name
    if (!projectId || isProjectsPage || isAccountPage) {
      setActiveServiceName('');
      return;
    }

    // Show cached value immediately (no flash)
    if (serviceId) {
      const cached = localStorage.getItem(`svcName:${serviceId}`);
      if (cached) setActiveServiceName(cached);
    }

    const controller = new AbortController();

    if (serviceId) {
      void fetchWithAuth(`${API}/projects/${projectId}/services/${serviceId}`, {
        signal: controller.signal,
      }).then(async r => {
        if (r.ok) {
          const svc = await r.json() as { name: string };
          setActiveServiceName(svc.name);
          // Cache so next navigation is instant
          localStorage.setItem(`svcName:${serviceId}`, svc.name);
        }
      }).catch(err => {
        if ((err as Error).name !== 'AbortError') console.warn('[TopNavbar] service fetch failed', err);
      });
    } else {
      // No serviceId — fetch first/default service
      void fetchWithAuth(`${API}/projects/${projectId}/services`, {
        signal: controller.signal,
      }).then(async r => {
        if (r.ok) {
          const services = await r.json() as { id: string; name: string }[];
          if (services && services.length > 0) {
            setActiveServiceName(services[0].name);
            localStorage.setItem(`svcName:${services[0].id}`, services[0].name);
          } else {
            setActiveServiceName('');
          }
        }
      }).catch(err => {
        if ((err as Error).name !== 'AbortError') console.warn('[TopNavbar] services list fetch failed', err);
      });
    }

    return () => controller.abort();
  }, [searchParams, isProjectsPage, isAccountPage]);

  /* ── Ctrl+K shortcut ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(s => !s);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') { setSearchOpen(false); setSearchVal(''); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* ── click outside dropdowns ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUserDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  const handleLogout = () => {
    setShowUserDrop(false);
    logoutWithTransition();
  };

  return (
    <nav className={styles.navbar} id="top-navbar">
      {/* ══ LEFT ══ */}
      <div className={styles.left}>
        {/* Logo */}
        <Link href="/projects" className={styles.brand} title="Back to Projects">
          <span className={styles.brandIcon}>
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <circle cx="10" cy="10" r="3" fill="currentColor"/>
            </svg>
          </span>
          <span className={styles.brandText}>
            <span className={styles.brandApi}>Api</span>
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={styles.brandAiSvg}>
              {/* Outer O ring */}
              <path d="M 10 53 A 40 40 0 0 1 63 12" />
              <path d="M 85 30 A 40 40 0 0 1 18 73" />
              <circle cx="12" cy="64" r="4.5" fill="currentColor" stroke="none" />
              {/* Inner a */}
              <path d="M 54 60 A 12 12 0 1 1 30 60 A 12 12 0 1 1 54 60" />
              <path d="M 54 48 L 54 66 C 54 72, 57 72, 60 72" />
              {/* Inner i — hexagon dot echoes the main logo mark */}
              <path d="M 75 35 L 75 72" />
              <polygon points="75,12 80,15.5 80,22.5 75,26 70,22.5 70,15.5" fill="currentColor" stroke="none" />
            </svg>
          </span>
        </Link>

        {!isProjectsPage && !isAccountPage && (
          <>
            <span className={styles.sep} />

            {/* Active project name with stacked-pages icon */}
            <Link href="/projects" className={styles.selectorBtn} title="Back to Projects">
              <ProjectsStackIcon />
              <span className={styles.selectorLabel}>{activeProject?.name ?? 'No project'}</span>
            </Link>

            {/* Services Page: show service mode after project name */}
            {isServicesPage && activeProject?.serviceMode && (
              <>
                <span className={styles.sep} />
                <div className={styles.svcModeNav}>
                  <span className={styles.svcIconBadge}>
                    {activeProject.serviceMode === 'multi' ? <MultiSvcIcon /> : <SingleSvcIcon />}
                  </span>
                  <span className={styles.svcModeText}>
                    {activeProject.serviceMode === 'multi' ? 'Multi Service' : 'Single Service'}
                  </span>
                </div>
              </>
            )}

            {/* On dashboard: service icon + env badge + connect */}
            {!isServicesPage && (
              <>
                <span className={styles.sep} />

                {/* Service mode icon before env badge */}
                {activeProject?.serviceMode && (
                  <span className={styles.svcIconBadge} title={activeProject.serviceMode === 'multi' ? 'Multi Service' : 'Single Service'}>
                    {activeProject.serviceMode === 'multi' ? <MultiSvcIcon /> : <SingleSvcIcon />}
                  </span>
                )}

                {/* Environment badge — click to go back to Services page */}
                <button
                  className={styles.envBtn}
                  title="Back to Services"
                  onClick={() => {
                    const pid = searchParams.get('projectId') ?? activeProject?.id ?? '';
                    if (pid) router.push(`/services?projectId=${pid}`);
                  }}
                >
                  <span className={styles.selectorLabel}>{activeServiceName}</span>
                  <span className={styles.prodBadge}>PRODUCTION</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                <span className={styles.sep} />

                {/* Connect */}
                <button
                  className={styles.connectBtn}
                  title="Connect your backend"
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('panel', 'getting-started');
                    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                  Connect
                </button>
              </>
            )}
          </>
        )}

        {isAccountPage && (
          <>
            <span className={styles.sep} />
            <span className={styles.selectorBtn} style={{ cursor: 'default', pointerEvents: 'none' }}>
              <User size={14} style={{ marginRight: '6px', opacity: 0.8 }} />
              <span className={styles.selectorLabel}>Account</span>
            </span>
            
            {isAuditPage && (
              <>
                <span className={styles.sep} />
                <span className={styles.selectorBtn} style={{ cursor: 'default', pointerEvents: 'none' }}>
                  <ClipboardList size={14} style={{ marginRight: '6px', opacity: 0.8 }} />
                  <span className={styles.selectorLabel}>Audit</span>
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* ══ RIGHT ══ */}
      <div className={styles.right}>


        {/* Search */}
        <div
          className={`${styles.searchBox} ${searchOpen ? styles.searchOpen : ''}`}
          onClick={() => {
            if (!searchOpen) {
              setSearchOpen(true);
              setTimeout(() => searchRef.current?.focus(), 50);
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className={styles.searchIco}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={searchRef}
            className={styles.searchInput}
            placeholder="Search projects… (coming soon)"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onFocus={() => {
              if (!searchVal) {
                toast.info('Global search coming soon!', { id: 'search-wip', duration: 2000 });
              }
            }}
            onBlur={() => { if (!searchVal) setSearchOpen(false); }}
            readOnly
          />
          {!searchOpen && (
            <button className={styles.kbdBtn} onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}>
              <kbd className={styles.kbd}>Ctrl K</kbd>
            </button>
          )}
        </div>

        {/* Icon buttons */}
        <button className={styles.iconBtn} title="Help & Docs" onClick={() => router.push('/docs')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>

        {/* AI Assistant — hexagon button */}
        <button
          className={styles.iconBtn}
          title="Apio AI Assistant"
          id="topnav-ai-btn"
          onClick={() => openAiPanel()}
          style={{ position: 'relative' }}
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
            <polygon points="10,1 19,6 19,14 10,19 1,14 1,6" />
            <path d="M10 5 Q10 10, 15 10 Q10 10, 10 15 Q10 10, 5 10 Q10 10, 10 5 Z" fill="#3b82f6" stroke="none" />
          </svg>
          {/* pulse dot */}
          <span style={{
            position: 'absolute', top: '5px', right: '5px',
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent)', display: 'block',
            animation: 'ai-topnav-pulse 2s ease-in-out infinite',
          }} />
        </button>


        {/* Upgrade */}
        <Link href="#" className={styles.upgradeBtn}>
          Upgrade to Pro
        </Link>

        {/* User avatar */}
        <div className={styles.dropWrap} ref={userRef}>
          <button
            id="user-avatar-btn"
            className={styles.avatar}
            onClick={() => setShowUserDrop(s => !s)}
            title={user?.name || user?.email}
          >
            {currentAvatar.svg}
          </button>

          {showUserDrop && (
            <div className={`${styles.drop} ${styles.dropRight}`}>
              <div className={styles.dropHeader}>
                <div className={styles.dropAvatar}>
                  {currentAvatar.svg}
                </div>
                <div className={styles.dropUser}>{user?.name || 'Account'}</div>
                <div className={styles.dropEmail}>{user?.email}</div>
              </div>
              <div className={styles.dropDivider}/>
              <button className={styles.dropItem} onClick={() => { setShowUserDrop(false); router.push('/projects/account'); }}>
                <User size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
                Account
              </button>

              <div className={styles.dropDivider}/>
              <div className={styles.dropSectionTitle}>Theme</div>
              <div className={styles.themeToggleRow}>
                <button
                  className={`${styles.themeToggleBtn} ${theme === 'light' ? styles.themeToggleBtnActive : ''}`}
                  onClick={() => setTheme('light')}
                  title="Light"
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  className={`${styles.themeToggleBtn} ${theme === 'dark' ? styles.themeToggleBtnActive : ''}`}
                  onClick={() => setTheme('dark')}
                  title="Dark"
                >
                  <Moon size={13} /> Dark
                </button>
                <button
                  className={`${styles.themeToggleBtn} ${styles.themeToggleBtnDarkBlue} ${theme === 'dark-blue' ? styles.themeToggleBtnActive : ''}`}
                  onClick={() => setTheme('dark-blue')}
                  title="Dark Blue"
                >
                  <Droplets size={13} /> Ocean
                </button>
                <button
                  className={`${styles.themeToggleBtn} ${styles.themeToggleBtnSystem} ${theme === 'system' ? styles.themeToggleBtnActive : ''}`}
                  onClick={() => setTheme('system')}
                  title="System (follows OS)"
                >
                  <Monitor size={13} /> System
                </button>
              </div>

              <div className={styles.dropDivider}/>
              <a href="mailto:feedback@apio.one" className={styles.dropItem} style={{ textDecoration: 'none' }}>
                <MessageSquare size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
                Feedback
              </a>
              <div className={styles.dropDivider}/>
              <button className={`${styles.dropItem} ${styles.dropItemDanger} ${styles.signOutBtn}`} onClick={handleLogout}>
                <div className={styles.signOutIconWrapper}>
                  <svg className={styles.signOutDoor} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  </svg>
                  <svg className={styles.signOutArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                <span className={styles.signOutText}>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
