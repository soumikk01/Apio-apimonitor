'use client';
import { authStorage, fetchWithAuth } from '@/lib/fetchWithAuth';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ProjectSidebar from '@/components/ProjectSidebar/ProjectSidebar';
import ProjectSettingsSidebar from '@/components/ProjectSettingsSidebar/ProjectSettingsSidebar';
import { Shimmer, ShimmerBlock } from '@/components/Shimmer/Shimmer';
import styles from './SettingsPage.module.scss';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  // 'loading' = still fetching, 'empty' = no projects exist, 'ready' = project loaded
  const [loadState, setLoadState] = useState<'loading' | 'empty' | 'ready'>('loading');

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Tab state
  const [activeSection, setActiveSection] = useState('general');

  // Invite & Members state
  const [inviteInput, setInviteInput] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [members, setMembers] = useState<{user: {id: string; email: string; name: string | null}, role: string}[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const fetchMembers = async (pid: string) => {
    try {
      const res = await fetchWithAuth(`${API}/projects/${pid}/members`);
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch { /* ignore */ } finally {
      setMembersLoaded(true);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveSection(hash);
      else setActiveSection('general');
      // Clear invite error when switching tabs
      setInviteError('');
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // initial
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const paramId = searchParams.get('projectId');
    const token = authStorage.getAccessToken();
    if (!token) return;

    void (async () => {
      setLoadState('loading');
      const targetId = paramId ?? localStorage.getItem('activeProjectId');

      if (targetId) {
        try {
          const r = await fetchWithAuth(`${API}/projects/${targetId}`);
          if (r.ok) {
            const p = await r.json() as { id: string; name: string };
            setProjectId(p.id);
            setProjectName(p.name);
            setEditName(p.name);
            localStorage.setItem('activeProjectId', p.id);
            setLoadState('ready');
            void fetchMembers(p.id);
            return;
          }
        } catch { /* ignore */ }
      }

      // Fallback: load first project
      try {
        const r = await fetchWithAuth(`${API}/projects`);
        if (!r.ok) { setLoadState('empty'); return; }
        const projects = await r.json() as { id: string; name: string }[];
        if (projects.length > 0) {
          setProjectId(projects[0].id);
          setProjectName(projects[0].name);
          setEditName(projects[0].name);
          localStorage.setItem('activeProjectId', projects[0].id);
          setLoadState('ready');
          void fetchMembers(projects[0].id);
        } else {
          setLoadState('empty');
        }
      } catch { setLoadState('empty'); }
    })();
  }, [searchParams]);

  const handleSaveGeneral = async () => {
    if (!projectId || !editName.trim() || editName.trim() === projectName) return;
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetchWithAuth(`${API}/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setProjectName(editName.trim());
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!projectId || !inviteInput.trim()) return;
    setIsInviting(true);
    setInviteError('');
    try {
      const res = await fetchWithAuth(`${API}/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrId: inviteInput.trim() }),
      });
      if (res.ok) {
        setInviteInput('');
        await fetchMembers(projectId);
      } else {
        let data: { message?: string };
        try {
          data = await res.json() as { message?: string };
        } catch {
          data = { message: 'Server error occurred' };
        }
        
        let errorMessage = data.message || 'Failed to add member';
        // Sanitize raw Express/NestJS route leak messages
        if (typeof errorMessage === 'string' && errorMessage.startsWith('Cannot POST')) {
          errorMessage = 'The invitation service is currently unavailable. Please try again later.';
        }
        setInviteError(errorMessage);
      }
    } catch {
      setInviteError('Network error occurred');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    try {
      await fetchWithAuth(`${API}/projects/${projectId}`, { method: 'DELETE' });
      window.location.href = '/projects';
    } catch { /* ignore */ }
  };

  // ── Loading skeleton ──
  if (loadState === 'loading') {
    return (
      <div className={`${styles.page}`}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
      <div className={styles.gridLines} />
        <ProjectSidebar projectId={undefined} />
        <ProjectSettingsSidebar 
          projectId={undefined} 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
        />
        <main className={styles.content}>
          <ShimmerBlock>
            {/* Page header */}
            <Shimmer width="30%" height={34} borderRadius={6} delay={1} />
            <Shimmer width="52%" height={16} borderRadius={4} delay={1} />
            {/* General Settings panel */}
            <Shimmer height={48} borderRadius={8} delay={2} style={{ marginTop: '0.75rem' }} />
            <Shimmer height={56} borderRadius={8} delay={2} />
            <Shimmer height={56} borderRadius={8} delay={3} />
            <Shimmer width="20%" height={36} borderRadius={8} delay={3} style={{ alignSelf: 'flex-end' }} />
            {/* Project Access panel */}
            <Shimmer height={48} borderRadius={8} delay={3} style={{ marginTop: '0.75rem' }} />
            <Shimmer height={100} borderRadius={8} delay={4} />
            {/* Project Availability panel */}
            <Shimmer height={48} borderRadius={8} delay={4} style={{ marginTop: '0.75rem' }} />
            <Shimmer height={80} borderRadius={8} delay={5} />
          </ShimmerBlock>
        </main>
      </div>
    );
  }

  // ── No project empty state — redirect user to create one ──
  if (loadState === 'empty') {
    return (
      <div className={`${styles.page}`}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
      <div className={styles.gridLines} />
        <ProjectSidebar projectId={undefined} />
        <ProjectSettingsSidebar 
          projectId={undefined} 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
        />
        <main className={styles.content}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2>No project selected</h2>
            <p>You need to create a project before you can access settings. Projects are where your API monitoring data lives.</p>
            <Link href="/projects" className={styles.emptyBtn}>
              Go to Projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.page}`}>
      <div className={styles.ambientOrb1} />
      <div className={styles.ambientOrb2} />
      <div className={styles.gridLines} />

      {/* ── SIDEBARS — primary and settings specific ── */}
      <ProjectSidebar projectId={projectId ?? undefined} />
      <ProjectSettingsSidebar 
        projectId={projectId ?? undefined} 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />

      {/* ── MAIN AREA ── */}
      <main className={styles.content}>
        <div className={styles.header}>
          <h1>Project Settings</h1>
          <p>General configuration, domains, ownership, and lifecycle</p>
        </div>

        {/* ── General Settings ── */}
        {activeSection === 'general' && (
          <div className={styles.panel} id="general">
            <div className={styles.panelHeader}>
              <h3>General Settings</h3>
            </div>
            <div className={styles.panelBody}>
              <div className={styles.formGroup}>
                <label>Project name</label>
                <input
                  className={styles.input}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. my-backend-api"
                />
                <p className={styles.helperText}>Displayed throughout the dashboard.</p>
              </div>

              <div className={styles.formGroup}>
                <label>Project ID</label>
                <input
                  className={`${styles.input} ${styles.readOnly}`}
                  value={projectId ?? 'Loading...'}
                  readOnly
                />
                <p className={styles.helperText}>Reference used in APIs and URLs.</p>
              </div>
            </div>
            <div className={styles.panelFooter}>
              {saveStatus === 'success' && (
                <span style={{ fontSize: '0.85rem', color: '#16a34a', marginRight: '1rem' }}>✓ Saved successfully</span>
              )}
              {saveStatus === 'error' && (
                <span style={{ fontSize: '0.85rem', color: '#ef4444', marginRight: '1rem' }}>✗ Failed to save</span>
              )}
              <button
                className={styles.primaryBtn}
                onClick={() => void handleSaveGeneral()}
                disabled={isSaving || !editName.trim() || editName.trim() === projectName}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        )}

        {/* ── Project Access ── */}
        {activeSection === 'access' && (
          <div className={styles.panel} id="access">
            <div className={styles.panelHeader}>
              <h3>Project access</h3>
            </div>
            <div className={styles.panelBody}>
              <h4>Organization-wide access</h4>
              <p style={{ marginTop: '0.25rem' }}>All 1 organization members can access this project.</p>

              <div className={styles.addMemberRow}>
                <input 
                  type="text"
                  className={styles.input}
                  placeholder="Enter User ID or Email address"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleAddMember()}
                />
                <button 
                  className={styles.secondaryBtn} 
                  disabled={!inviteInput.trim() || isInviting}
                  onClick={() => void handleAddMember()}
                >
                  {isInviting ? 'Adding...' : 'Add member'}
                </button>
              </div>
              {inviteError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '0.5rem' }}>{inviteError}</div>}

              <div className={styles.tableBlock} style={{ marginTop: '1.5rem' }}>
                <div className={styles.tableHeader}>
                  <div className={styles.colName}>Member</div>
                  <div className={styles.colRole}>Role</div>
                </div>
                {membersLoaded ? (
                  members.length > 0 ? members.map((member) => (
                    <div className={styles.tableRow} key={member.user.id}>
                      <div className={styles.colName}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{member.user.email}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '1px' }}>
                          {member.user.email === user?.email ? 'You' : member.user.name || 'Member'}
                        </div>
                      </div>
                      <div className={styles.colRole}>{member.role}</div>
                    </div>
                  )) : (
                    <div className={styles.tableRow}>
                      <div className={styles.colName}>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>No members yet. Add one above.</div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className={styles.tableRow}>
                    <div className={styles.colName}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading members...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Project Availability ── */}
        {activeSection === 'availability' && (
          <div className={styles.panel} id="availability">
            <div className={styles.panelHeader}>
              <h3>Project availability</h3>
            </div>
            <div className={styles.panelBody}>
              <p>Restart or pause your project when performing maintenance.</p>

              <div className={styles.actionRow} style={{ marginTop: '1.5rem' }}>
                <div>
                  <h4>Restart project</h4>
                  <p style={{ marginTop: '0.25rem' }}>Your project will not be available for a few minutes.</p>
                </div>
                <button className={styles.secondaryBtn}>Restart project</button>
              </div>

              <hr className={styles.divider} />

              <div className={styles.actionRow}>
                <div>
                  <h4>Pause project</h4>
                  <p style={{ marginTop: '0.25rem' }}>Your project will not be accessible while it is paused.</p>
                </div>
                <button className={styles.secondaryBtn}>Pause project</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Custom Domains ── */}
        {activeSection === 'domains' && (
          <div className={styles.panel} id="domains">
            <div className={styles.panelHeader}>
              <h3>Custom domains</h3>
            </div>
            <div className={styles.panelBody}>
              <p>Present a branded experience to your users.</p>
              <div className={styles.infoBox} style={{ marginTop: '1.25rem' }}>
                <h4>Custom domains are a Pro Plan add-on</h4>
                <p style={{ marginTop: '0.35rem' }}>Paid Plans come with free vanity subdomains or Custom Domains for an additional $10/month per domain.</p>
                <button className={styles.secondaryBtn} style={{ marginTop: '1rem' }}>Upgrade to Pro</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Advanced / Danger Zone ── */}
        {activeSection === 'advanced' && (
          <>
            <div className={`${styles.panel} ${styles.dangerPanel}`} id="advanced">
              <div className={styles.panelHeader}>
                <h3>Transfer project</h3>
              </div>
              <div className={styles.panelBody}>
                <p>Transfer this project to another organization or account.</p>
                <p className={styles.helperText} style={{ marginTop: '0.5rem' }}>
                  To transfer projects, the owner must be a member of both the source and target organizations.
                </p>
              </div>
              <div className={styles.panelFooter}>
                <button className={styles.secondaryBtn}>Transfer project</button>
              </div>
            </div>

            <div className={`${styles.panel} ${styles.dangerPanel}`}>
              <div className={styles.panelHeader}>
                <h3>Delete project</h3>
              </div>
              <div className={styles.panelBody}>
                <p>Permanently remove your project and all of its data.</p>
                <p className={styles.helperText} style={{ marginTop: '0.5rem' }}>
                  This action is irreversible. All API call logs, configurations, and project data will be deleted
                  permanently. Make a backup if needed.
                </p>
              </div>
              <div className={`${styles.panelFooter} ${styles.dangerFooter}`}>
                <button className={styles.dangerBtn} onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}>
                  Delete project
                </button>
              </div>
            </div>
          </>
        )}

      </main>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Confirm deletion of {projectName}</h2>
              <button className={styles.closeBtn} onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.warningBanner}>
                <AlertTriangle size={18} />
                <span>This action cannot be undone.</span>
              </div>
              
              <p className={styles.modalText}>
                This will permanently delete the <strong>{projectName}</strong> project and all of its data.
              </p>

              <div className={styles.confirmSection}>
                <label>Type <strong>{projectName}</strong> to confirm.</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type the project name in here"
                  autoFocus
                />
                <button 
                  className={styles.dangerBtnFull} 
                  disabled={deleteConfirmText !== projectName}
                  onClick={() => void handleDelete()}
                >
                  I understand, delete this project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
