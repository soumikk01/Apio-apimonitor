'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMonitorSocket, ApiCallEvent } from '@/hooks/useMonitorSocket';
import { useAuth } from '@/hooks/useAuth';
import ProjectSidebar from '@/components/ProjectSidebar/ProjectSidebar';
import OverviewSidebar from '@/components/OverviewSidebar/OverviewSidebar';
import { Shimmer, ShimmerBlock, ShimmerRow } from '@/components/Shimmer/Shimmer';
import styles from './OverviewPage.module.scss';
import {
  queryKeys,
  fetchProjects,
  fetchProject,
  fetchService,
  fetchProjectStats,
  fetchRecentCalls,
  type RecentCall,
} from '@/lib/queries';

export default function OverviewPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const paramId = searchParams.get('projectId');
  const paramServiceId = searchParams.get('serviceId');

  // ── Projects list — only when no projectId in URL ───────────────────────────
  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
    enabled: !paramId,
  });

  // ── Resolve active project ID ────────────────────────────────────────────────
  // useMemo prevents the localStorage read from running as a render-phase side
  // effect, which would be unsafe under React 18 Strict Mode double-invoke.
  const resolvedProjectId = useMemo(() => {
    if (paramId) return paramId;
    const saved = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
    return projects?.find(p => p.id === saved)?.id ?? projects?.[0]?.id ?? '';
  }, [paramId, projects]);

  // ── Project detail — shows instantly from cache (5 min stale time) ──────────
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: queryKeys.projects.detail(resolvedProjectId),
    queryFn: () => fetchProject(resolvedProjectId),
    enabled: !!resolvedProjectId,
    placeholderData: () => {
      try {
        const list = JSON.parse(localStorage.getItem('cachedProjectsV2') ?? '[]') as { id: string; name: string; serviceMode: string; createdAt: string }[];
        return list.find(p => p.id === resolvedProjectId);
      } catch { return undefined; }
    },
  });

  // ── Service name — instant from localStorage ────────────────────────────────
  const { data: service } = useQuery({
    queryKey: queryKeys.services.detail(resolvedProjectId, paramServiceId ?? ''),
    queryFn: () => fetchService(resolvedProjectId, paramServiceId!),
    enabled: !!resolvedProjectId && !!paramServiceId,
    placeholderData: () => {
      if (!paramServiceId) return undefined;
      const name = localStorage.getItem(`svcName:${paramServiceId}`);
      return name ? { id: paramServiceId, name, isDefault: false, createdAt: '' } : undefined;
    },
  });

  // ── Stats — 30s stale time (matches backend cache TTL) ─────────────────────
  const { data: dbStats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.projects.stats(resolvedProjectId),
    queryFn: () => fetchProjectStats(resolvedProjectId),
    enabled: !!resolvedProjectId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // ── Recent calls — 15s stale time, seeds the traffic feed ──────────────────
  const { data: dbCalls = [] } = useQuery({
    queryKey: queryKeys.projects.calls(resolvedProjectId, 50),
    queryFn: () => fetchRecentCalls(resolvedProjectId, 50),
    enabled: !!resolvedProjectId,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  // Persist active project — in useEffect to avoid render side-effects
  useEffect(() => {
    if (project?.id) localStorage.setItem('activeProjectId', project.id);
  }, [project?.id]);

  const projectId = project?.id ?? resolvedProjectId;
  const projectName = project?.name ?? '';
  const serviceName = service?.name ?? '';

  // ── Real-time WebSocket feed ──────────────────────────────────────────────
  const { connected: isConnected, events: liveEvents } = useMonitorSocket({ projectId });

  // Merge live WebSocket events on top of DB-seeded list (dedup by id)
  const mergedCalls: (RecentCall | ApiCallEvent)[] = [
    ...liveEvents,
    ...dbCalls.filter(db =>
      !liveEvents.some((live: ApiCallEvent) => live.id != null && live.id === db.id),
    ),
  ].slice(0, 50);

  // Compute display stats — prefer live counts, fall back to DB stats
  const totalCalls = liveEvents.length > 0 ? liveEvents.length : (dbStats?.total ?? 0);
  const liveErrors = liveEvents.filter((c: ApiCallEvent) =>
    c.status === 'CLIENT_ERROR' || c.status === 'SERVER_ERROR' || (c.statusCode != null && c.statusCode >= 400)
  ).length;
  const errorCalls = liveEvents.length > 0 ? liveErrors : (dbStats?.errors ?? 0);
  const errorRate = totalCalls > 0 ? ((errorCalls / totalCalls) * 100).toFixed(1) : (dbStats?.errorRate?.toFixed(1) ?? '0.0');
  const avgLatency = dbStats?.avgLatency ?? 0;

  // ── Loading state — only show shimmer on first load (no cached data) ────────
  const isInitialLoad = projectLoading && !project;

  if (isInitialLoad) {
    return (
      <div className={`${styles.page}`}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
        <div className={styles.gridLines} />
        <ProjectSidebar projectId={undefined} />
        <OverviewSidebar />
        <main className={styles.content}>
          <ShimmerBlock>
            <ShimmerRow>
              <Shimmer width="50%" height={36} borderRadius={6} delay={1} />
              <Shimmer width={96} height={34} borderRadius={8} delay={1} style={{ marginLeft: 'auto' }} />
            </ShimmerRow>
            <Shimmer width="32%" height={18} borderRadius={4} delay={2} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
              <Shimmer height={110} borderRadius={10} delay={2} />
              <Shimmer height={110} borderRadius={10} delay={3} />
              <Shimmer height={110} borderRadius={10} delay={4} />
            </div>
            <Shimmer height={28} width="40%" borderRadius={6} delay={3} />
            <Shimmer height={52} borderRadius={8} delay={4} />
            <Shimmer height={52} borderRadius={8} delay={4} />
            <Shimmer height={52} borderRadius={8} delay={5} />
            <Shimmer height={52} borderRadius={8} delay={5} />
          </ShimmerBlock>
        </main>
      </div>
    );
  }

  // ── No project empty state ─────────────────────────────────────────────────
  if (!resolvedProjectId && !projectLoading) {
    return (
    <div className={styles.page}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
        <div className={styles.gridLines} />
        <ProjectSidebar projectId={undefined} />
        <OverviewSidebar />
        <main className={styles.content}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2>No project selected</h2>
            <p>You need to create a project before you can access the dashboard overview.</p>
            <Link href="/projects" className={styles.emptyBtn}>Go to Projects</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambientOrb1} />
      <div className={styles.ambientOrb2} />
      <div className={styles.gridLines} />
      <ProjectSidebar projectId={projectId || undefined} />
      <OverviewSidebar />

      <main className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1>{serviceName ? `${serviceName} — Overview` : projectName ? `${projectName} — Overview` : 'Platform Overview'}</h1>
            <p>Welcome back, {user?.name || 'Operator'} — Live Socket: {isConnected ? 'Connected 🟢' : 'Connecting 🟡'}</p>
          </div>
          {/* No manual refresh button needed — React Query auto-refetches every 30s */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
            {statsLoading ? '⟳ Refreshing…' : '● Live'}
          </div>
        </div>

        {/* Stat cards */}
        <div id="metrics" className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active Instances</span>
            <span className={styles.statValue}>{dbStats?.activeInstances ?? (statsLoading ? '…' : '0')}</span>
            <span className={styles.statSub}>
              {(dbStats?.activeInstances ?? 0) > 0 ? '🟢 System Nominal' : '⚪ No recent traffic'}
            </span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total API Calls</span>
            <span className={styles.statValue}>{totalCalls}</span>
            <span className={styles.statSub}>{avgLatency > 0 ? `Avg ${avgLatency}ms latency` : 'All time'}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Error Rate</span>
            <span className={styles.statValue} style={{ color: errorCalls > 0 ? '#ef4444' : undefined }}>
              {errorRate}%
            </span>
            <span className={styles.statSub} style={{ color: errorCalls > 0 ? '#ef4444' : undefined }}>
              {errorCalls} Failed Requests
            </span>
          </div>
        </div>

        {/* Traffic feed */}
        <div id="traffic" className={styles.panel}>
          <h3>Real-time Traffic Control Matrix</h3>
          <div className={styles.feedList}>
            {mergedCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                {statsLoading ? 'Loading traffic data…' : 'No traffic yet. Run the CLI tool to ingest data!'}
              </div>
            ) : (
              mergedCalls.map((call, idx) => {
                const code = (call as RecentCall).statusCode ?? (call as ApiCallEvent).statusCode ?? 200;
                const method = call.method;
                const endpoint = (call as RecentCall).url ?? (call as ApiCallEvent).url ?? (call as ApiCallEvent).path ?? '';
                const latency = call.latency;
                return (
                  <div key={(call as RecentCall).id ?? idx} className={styles.feedItem}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '0.75rem' }}>
                      <span className={styles.feedMethod}>{method}</span>
                      <span className={styles.feedEndpoint}>{endpoint}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{latency}ms</span>
                      <span className={`${styles.feedStatus} ${Number(code) >= 400 ? styles.status400 : styles.status200}`}>
                        {code}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
