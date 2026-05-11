'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useQuery } from '@tanstack/react-query';
import { queryKeys, fetchProjects, API_BASE } from '@/lib/queries';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Shimmer } from '@/components/Shimmer/Shimmer';
import styles from './AccountAuditPage.module.scss';

// Use the shared API base URL constant — never duplicate the env-var fallback.
const API = API_BASE;

interface AuditLog {
  id: string;
  action: string;
  detail: unknown;
  createdAt: string;
  projectId?: string;
  project?: { id: string; name: string };
  ipAddress?: string;
}

export default function AccountAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');

  // ── Projects list — reads from the shared React Query cache so no extra
  // network request is fired when the Audit page is visited after the dashboard.
  const { data: projectsList = [] } = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
    staleTime: 60_000,
  });

  // ── Fetch audit logs — accepts an AbortSignal so previous requests are
  // cancelled when the filter changes, preventing race conditions / stale state.
  const loadLogs = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const url = new URL(`${API}/audit`);
      if (selectedProject) url.searchParams.set('projectId', selectedProject);

      const res = await fetchWithAuth(url.toString(), { signal });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      } else {
        throw new Error(`Server error ${res.status}`);
      }
    } catch (err) {
      // AbortError is expected when filter changes or on unmount — swallow silently.
      if ((err as Error).name === 'AbortError') return;
      const msg = (err as Error).message || 'Failed to load audit logs';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  // Cancel the previous request automatically whenever selectedProject changes
  // (or on component unmount).
  useEffect(() => {
    const controller = new AbortController();
    void loadLogs(controller.signal);
    return () => controller.abort();
  }, [loadLogs]);

  // ── Manual Refresh — tracked in a ref so rapid clicks abort the previous
  // in-flight request before starting a new one (prevents race conditions).
  const manualCtrlRef = useRef<AbortController | null>(null);

  const handleRefresh = useCallback(() => {
    // Abort any previous manual refresh that is still in flight.
    manualCtrlRef.current?.abort();
    const controller = new AbortController();
    manualCtrlRef.current = controller;
    void loadLogs(controller.signal);
  }, [loadLogs]);

  // Cleanup the manual controller on unmount.
  useEffect(() => {
    return () => { manualCtrlRef.current?.abort(); };
  }, []);

  const dateRangeStr = `${format(new Date(Date.now() - 86400000), 'dd MMM, HH:mm')} - ${format(new Date(), 'dd MMM, HH:mm')}`;

  return (
    <div className={`${styles.content}`}>
      <div className={styles.header}>
        <h1>Audit Logs</h1>
        <p>View a detailed history of account activities and security events.</p>
      </div>

      <div className={styles.panel}>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter by</span>
            <select
              className={styles.filterSelect}
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterText}>{dateRangeStr}</span>
            <span className={styles.filterText} style={{ margin: '0 0.5rem' }}>•</span>
            <span className={styles.filterText}>Viewing {logs.length} logs in total</span>

            <button
              className={styles.refreshBtn}
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh audit logs"
            >
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontSize: '0.875rem',
            }}
          >
            {loadError}
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Action</th>
                <th>Target</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: 'none' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Shimmer width="60%" height={16} borderRadius={4} delay={(Math.min(i + 1, 5)) as 1|2|3|4|5} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Shimmer width="75%" height={16} borderRadius={4} delay={(Math.min(i + 1, 5)) as 1|2|3|4|5} />
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Shimmer width="55%" height={16} borderRadius={4} delay={(Math.min(i + 1, 5)) as 1|2|3|4|5} />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyState}>No audit logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className={styles.actionCell}>
                      <strong>{log.action}</strong>
                      <span className={styles.viewDetails}>View details</span>
                    </td>
                    <td className={styles.targetCell}>
                      {log.project ? (
                        <>
                          Project: {log.project.name}
                          <br />
                          <span style={{ opacity: 0.6 }}>Ref: {log.id.slice(-12)}</span>
                        </>
                      ) : (
                        <span style={{ opacity: 0.6, fontSize: '1.2rem' }}>-</span>
                      )}
                    </td>
                    <td className={styles.dateCell}>
                      {format(new Date(log.createdAt), 'dd MMM yy HH:mm:ss')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
