'use client';
import { useState, useCallback, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Shimmer } from '@/components/Shimmer/Shimmer';
import styles from './AccountAuditPage.module.scss';


const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

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
  const [projectsList, setProjectsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`${API}/audit`);
      if (selectedProject) {
        url.searchParams.set('projectId', selectedProject);
      }
      const res = await fetchWithAuth(url.toString());
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjectsList(data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Try to define a default date range string just to match UI mockup
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
            
            <button className={styles.refreshBtn} onClick={() => void loadLogs()} disabled={loading}>
              <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
              Refresh
            </button>
          </div>
        </div>

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
