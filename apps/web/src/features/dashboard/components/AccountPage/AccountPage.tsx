'use client';
import { authStorage, fetchWithAuth } from '@/lib/fetchWithAuth';
import { toast } from 'sonner';

import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { Shimmer, ShimmerBlock, ShimmerRow } from '@/components/Shimmer/Shimmer';
import { AVATARS } from './avatars';
import styles from './AccountPage.module.scss';
import { API_BASE } from '@/lib/queries';

const API = API_BASE;

interface Stats {
  totalProjects: number;
  totalCalls: number;
  joinedAt?: string;
}

export default function AccountPage() {
  const { user, logoutWithTransition } = useAuth();

  const [stats, setStats] = useState<Stats>({ totalProjects: 0, totalCalls: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Saved avatar (persisted in DB + localStorage)
  const [savedAvatar, setSavedAvatar] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('userAvatarIndex') ?? '0', 10);
    }
    return 0;
  });

  // Pending avatar — only changed inside the picker, saved on explicit click
  const [pendingAvatar, setPendingAvatar] = useState<number>(savedAvatar);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarSaveStatus, setAvatarSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleStorage = () => {
        const idx = parseInt(localStorage.getItem('userAvatarIndex') ?? '0', 10);
        setSavedAvatar(idx);
      };
      window.addEventListener('storage', handleStorage);
      window.addEventListener('avatarChanged', handleStorage);
      return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('avatarChanged', handleStorage);
      };
    }
  }, []);

  const currentAvatar = AVATARS[savedAvatar] ?? AVATARS[0];

  // Reset pending selection to saved when the picker opens
  const openPicker = () => {
    setPendingAvatar(savedAvatar);
    setAvatarSaveStatus('idle');
    setShowAvatarPicker(true);
  };

  const closePicker = () => {
    setShowAvatarPicker(false);
    setAvatarSaveStatus('idle');
  };

  // Commit the pending avatar to DB + localStorage
  const handleSaveAvatar = async () => {
    if (pendingAvatar === savedAvatar) { closePicker(); return; }
    setSavingAvatar(true);
    setAvatarSaveStatus('idle');
    try {
      const res = await fetchWithAuth(`${API}/users/me/avatar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: pendingAvatar }),
      });
      if (!res.ok) throw new Error('Failed');
      // Persist locally only after confirmed save
      localStorage.setItem('userAvatarIndex', String(pendingAvatar));
      window.dispatchEvent(new Event('avatarChanged'));
      setSavedAvatar(pendingAvatar);
      setAvatarSaveStatus('success');
      toast.success('Avatar updated successfully');
      setTimeout(() => { closePicker(); }, 800);
    } catch (err) {
      console.error('Failed to update avatar in DB', err);
      setAvatarSaveStatus('error');
      toast.error('Failed to save avatar. Please try again.');
    } finally {
      setSavingAvatar(false);
    }
  };

  const loadData = useCallback(async () => {
    const token = authStorage.getAccessToken();
    if (!token) return;
    setIsLoading(true);
    setLoadError('');
    try {
      const pRes = await fetchWithAuth(`${API}/projects`);
      if (!pRes.ok) throw new Error(`Server error ${pRes.status}`);
      const projects = await pRes.json() as unknown[];
      setStats(s => ({ ...s, totalProjects: projects.length }));
    } catch (err) {
      const msg = (err as Error).message;
      setLoadError(msg || 'Failed to load account data. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleLogout = () => { logoutWithTransition(); };

  // Error state
  if (loadError && !isLoading) {
    return (
      <main className={styles.content}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem', color: 'var(--text-muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" style={{ opacity: 0.4 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ fontSize: '0.9rem', textAlign: 'center', maxWidth: '320px' }}>{loadError}</p>
          <button
            onClick={() => void loadData()}
            style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className={`${styles.content}`}>
        <ShimmerBlock>
          {/* Page header */}
          <Shimmer width="22%" height={34} borderRadius={6} delay={1} />
          <Shimmer width="50%" height={16} borderRadius={4} delay={1} />
          {/* Profile hero card */}
          <ShimmerRow style={{ marginTop: '0.5rem', alignItems: 'center', gap: '1.25rem' }}>
            <Shimmer width={72} height={72} borderRadius={36} delay={2} />
            <ShimmerBlock style={{ gap: '0.5rem', flex: 1 }}>
              <Shimmer width="35%" height={22} borderRadius={6} delay={2} />
              <Shimmer width="48%" height={16} borderRadius={4} delay={2} />
              <Shimmer width={80} height={22} borderRadius={12} delay={3} />
            </ShimmerBlock>
            <ShimmerRow style={{ gap: '2rem' }}>
              <Shimmer width={60} height={52} borderRadius={8} delay={3} />
              <Shimmer width={60} height={52} borderRadius={8} delay={3} />
            </ShimmerRow>
          </ShimmerRow>
          {/* Profile Details panel */}
          <Shimmer height={48} borderRadius={8} delay={3} style={{ marginTop: '0.5rem' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <Shimmer height={56} borderRadius={8} delay={3} />
            <Shimmer height={56} borderRadius={8} delay={4} />
            <Shimmer height={56} borderRadius={8} delay={4} />
            <Shimmer height={56} borderRadius={8} delay={4} />
          </div>
          {/* SDK Token panel */}
          <Shimmer height={48} borderRadius={8} delay={4} style={{ marginTop: '0.5rem' }} />
          <Shimmer height={64} borderRadius={8} delay={5} />
          <Shimmer width="30%" height={36} borderRadius={8} delay={5} />
        </ShimmerBlock>
      </main>
    );
  }

  return (
    <main className={`${styles.content}`}>
      <div className={styles.header}>
        <h1>My Account</h1>
        <p>Manage your profile, API token, and account preferences.</p>
      </div>

      {/* ── PROFILE HERO ── */}
      <div className={styles.heroCard}>
        {/* Avatar with edit icon */}
        <div className={styles.avatarWrap}>
          <div className={styles.avatarCircle}>
            {currentAvatar.svg}
          </div>
          <button
            className={styles.avatarEditBtn}
            onClick={openPicker}
            title="Change avatar"
            aria-label="Change profile photo"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
        <div className={styles.heroInfo}>
          <div className={styles.heroName}>{user?.name || 'Anonymous'}</div>
          <div className={styles.heroEmail}>{user?.email}</div>
          <div className={styles.heroBadge}>Free plan</div>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statItem}>
            <span className={styles.statNum}>{stats.totalProjects}</span>
            <span className={styles.statLabel}>Projects</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statNum}>Active</span>
            <span className={styles.statLabel}>Session</span>
          </div>
        </div>
      </div>

      {/* ── PROFILE DETAILS ── */}
      <div className={styles.panel}>
        <h3>Profile Details</h3>
        <div className={styles.fieldGrid}>
          <div className={styles.field}>
            <label>Full name</label>
            <div className={styles.fieldValue}>{user?.name || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Email address</label>
            <div className={styles.fieldValue}>{user?.email || '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Account ID</label>
            <div className={`${styles.fieldValue} ${styles.mono}`}>{user?.id ?? '—'}</div>
          </div>
          <div className={styles.field}>
            <label>Plan</label>
            <div className={styles.fieldValue}>Free</div>
          </div>
        </div>
      </div>

      {/* ── SDK TOKENS NOTE ── */}
      <div className={styles.panel}>
        <h3>SDK Tokens</h3>
        <p style={{ marginBottom: '1rem' }}>
          SDK tokens are now managed per service. Go to a service&apos;s settings to view, copy, or rotate its token.
        </p>
        <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          Open a project → select a service → <strong>Service Settings → SDK Token</strong>
        </p>
      </div>

      {/* ── DANGER ZONE ── */}
      <div className={`${styles.panel} ${styles.dangerPanel}`}>
        <h3>Danger Zone</h3>
        <p>These actions are permanent and cannot be undone.</p>
        <div style={{ marginTop: '1.25rem' }}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign out securely
          </button>
        </div>
      </div>

      {/* ── AVATAR PICKER MODAL ── */}
      {showAvatarPicker && (
        <div className={styles.pickerBackdrop} onClick={closePicker}>
          <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <span>Choose your avatar</span>
              <button className={styles.pickerClose} onClick={closePicker}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className={styles.pickerSub}>
              {pendingAvatar !== savedAvatar
                ? <span className={styles.hoverName}>Avatar changed — click Save to confirm</span>
                : 'Pick a unique avatar to match your personality'}
            </p>
            <div className={styles.pickerGrid}>
              {AVATARS.map((av, i) => (
                <button
                  key={i}
                  className={`${styles.pickerItem} ${pendingAvatar === i ? styles.pickerItemSelected : ''}`}
                  onClick={() => setPendingAvatar(i)}
                >
                  {av.svg}
                  <span className={styles.avatarTooltip}>{av.label}</span>
                  {pendingAvatar === i && (
                     <span className={styles.pickerCheck}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="10" height="10">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Save / Cancel footer */}
            <div className={styles.pickerFooter}>
              {avatarSaveStatus === 'error' && (
                <span className={styles.pickerError}>Failed to save — try again</span>
              )}
              <div className={styles.pickerActions}>
                <button className={styles.pickerCancelBtn} onClick={closePicker} disabled={savingAvatar}>
                  Cancel
                </button>
                <button
                  className={`${styles.pickerSaveBtn} ${
                    avatarSaveStatus === 'success' ? styles.pickerSaveBtnDone : ''
                  } ${
                    avatarSaveStatus === 'error' ? styles.pickerSaveBtnError : ''
                  }`}
                  onClick={() => void handleSaveAvatar()}
                  disabled={savingAvatar || pendingAvatar === savedAvatar || avatarSaveStatus === 'success'}
                >
                  {savingAvatar && (
                    <svg className={styles.savingSpinner} viewBox="0 0 20 20" fill="none" width="14" height="14">
                      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2.5" strokeDasharray="32" strokeDashoffset="12" strokeLinecap="round" />
                    </svg>
                  )}
                  {avatarSaveStatus === 'success' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14" className={styles.savingCheck}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  <span>
                    {savingAvatar
                      ? 'Saving…'
                      : avatarSaveStatus === 'success'
                        ? 'Saved!'
                        : pendingAvatar === savedAvatar
                          ? 'No changes'
                          : 'Save avatar'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
