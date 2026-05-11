'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import ProjectSidebar from '@/components/ProjectSidebar/ProjectSidebar';
import styles from './DashboardPage.module.scss';
import { Shimmer, ShimmerBlock, ShimmerRow } from '@/components/Shimmer/Shimmer';
import { ChevronDown, Activity, Zap, AlertTriangle, Layers, RotateCw } from 'lucide-react';
import { useEffect } from 'react';
import {
  queryKeys,
  fetchProjects,
  fetchProject,
  fetchService,
  fetchProjectStats,
  fetchRecentCalls,
} from '@/lib/queries';

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const paramId = searchParams.get('projectId');
  const paramServiceId = searchParams.get('serviceId');

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(),
    queryFn: fetchProjects,
    enabled: !paramId,
  });

  const resolvedProjectId = paramId ?? (() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('activeProjectId') : null;
    return projects?.find(p => p.id === saved)?.id ?? projects?.[0]?.id ?? '';
  })();

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

  const { data: dbStats } = useQuery({
    queryKey: queryKeys.projects.stats(resolvedProjectId),
    queryFn: () => fetchProjectStats(resolvedProjectId),
    enabled: !!resolvedProjectId,
    refetchInterval: 30_000,
    staleTime: 30_000, // match refetchInterval — no redundant fetch on mount
  });

  // Use limit=50 (same key as OverviewPage) — React Query deduplicates. Slice to 20 client-side.
  const { data: recentCallsFull } = useQuery({
    queryKey: queryKeys.projects.calls(resolvedProjectId, 50),
    queryFn: () => fetchRecentCalls(resolvedProjectId, 50),
    enabled: !!resolvedProjectId,
    refetchInterval: 15_000,
    staleTime: 15_000,
  });
  const recentCalls = (recentCallsFull ?? []).slice(0, 20);

  // Persist active project — in useEffect to avoid render side-effects
  useEffect(() => {
    if (project?.id) localStorage.setItem('activeProjectId', project.id);
  }, [project?.id]);

  const projectId   = project?.id ?? resolvedProjectId;
  const projectName = project?.name ?? '';
  const serviceName = service?.name ?? '';
  const isLoading   = projectLoading && !project;

  // ── Derive metrics ──────────────────────────────────────────────────────────
  const totalCalls  = dbStats?.total ?? 0;
  const errorCount  = dbStats?.errors ?? 0;
  const errorRate    = totalCalls > 0 ? ((errorCount / totalCalls) * 100).toFixed(1) : '0.0';
  const avgLatency   = dbStats?.avgLatency ?? 0;
  const activeInst   = dbStats?.activeInstances ?? 0;

  // Build sparkline points from recent calls (up to 20 points)
  const calls   = (recentCalls ?? []).slice(-20);
  const latencies = calls.map(c => (c as { latency?: number }).latency ?? 0);
  const maxLat    = Math.max(...latencies, 1);

  function buildSparkPath(values: number[], w = 200, h = 48): string {
    if (values.length < 2) return `M 0 ${h} L ${w} ${h}`;
    const step = w / (values.length - 1);
    return values.map((v, i) => {
      const x = i * step;
      const y = h - (v / maxLat) * (h - 6);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  function buildSparkFill(values: number[], w = 200, h = 48): string {
    if (values.length < 2) return '';
    return `${buildSparkPath(values, w, h)} L ${w} ${h} L 0 ${h} Z`;
  }

  // Status labels ──────────────────────────────────────────────────────────────
  const statusLabel = activeInst > 0 ? 'Live' : 'Idle';
  const statusColor = activeInst > 0 ? 'var(--green)' : 'var(--text-faint)';
  const health = Number(errorRate) < 5 ? 'Healthy' : Number(errorRate) < 20 ? 'Degraded' : 'Unhealthy';
  const healthColor = health === 'Healthy' ? 'var(--green)' : health === 'Degraded' ? 'var(--orange)' : 'var(--red)';

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
        <div className={styles.gridLines} />
        <ProjectSidebar projectId={undefined} />
        <main className={styles.content}>
          <ShimmerBlock>
            <ShimmerRow>
              <Shimmer width="38%" height={32} borderRadius={6} delay={1} />
              <Shimmer width={48} height={22} borderRadius={4} delay={1} style={{ alignSelf: 'center' }} />
            </ShimmerRow>
            <ShimmerRow>
              <Shimmer width="55%" height={18} borderRadius={4} delay={2} />
              <Shimmer width={72} height={22} borderRadius={4} delay={2} />
            </ShimmerRow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '0.5rem' }}>
              <Shimmer height={80} borderRadius={10} delay={2} />
              <Shimmer height={80} borderRadius={10} delay={3} />
              <Shimmer height={80} borderRadius={10} delay={3} />
              <Shimmer height={80} borderRadius={10} delay={4} />
            </div>
            <Shimmer height={340} borderRadius={12} delay={4} />
          </ShimmerBlock>
        </main>
      </div>
    );
  }

  const projectUrl = `https://${projectId.substring(0, 8) || 'yscdebrydv'}.api-monitor.co`;
  const sparkLinePath = buildSparkPath(latencies);
  const sparkFillPath = buildSparkFill(latencies);

  return (
    <div className={styles.page}>
      <div className={styles.ambientOrb1} />
      <div className={styles.ambientOrb2} />
      <div className={styles.gridLines} />
      <ProjectSidebar projectId={projectId || undefined} />

      <main className={styles.content}>
        <div className={styles.dashboardContainer}>

          {/* ── Left Column ── */}
          <div className={styles.leftCol}>
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <h1>{serviceName || projectName || 'api-monitor'}</h1>
                {serviceName && <span className={styles.parentName}>({projectName})</span>}
                <span className={styles.badge}>LIVE</span>
              </div>
              <div className={styles.urlRow}>
                <span className={styles.url}>{projectUrl}</span>
                <button
                  className={styles.copyBtn}
                  onClick={() => {
                    void navigator.clipboard.writeText(projectUrl).then(() => {
                      toast.success('URL copied to clipboard');
                    }).catch(() => {
                      toast.error('Failed to copy URL');
                    });
                  }}
                >
                  Copy <ChevronDown size={14} />
                </button>
              </div>
            </div>

            <div className={styles.gridCards}>

              {/* Card 1 — Health */}
              <div className={styles.card}>
                <div className={styles.iconBox} style={{ color: healthColor, background: `color-mix(in srgb, ${healthColor} 12%, transparent)` }}>
                  <Activity size={20} />
                </div>
                <div className={styles.cardText}>
                  <div className={styles.label}>HEALTH STATUS</div>
                  <div className={styles.value} style={{ color: healthColor, fontWeight: 700 }}>{health}</div>
                  <div className={styles.subValue}>{statusLabel} · {activeInst} instance{activeInst !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Card 2 — Total API Calls */}
              <div className={styles.card}>
                <div className={styles.iconBox} style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}>
                  <Layers size={20} />
                </div>
                <div className={styles.cardText}>
                  <div className={styles.label}>TOTAL API CALLS</div>
                  <div className={styles.value} style={{ fontWeight: 700 }}>{totalCalls.toLocaleString()}</div>
                  <div className={styles.subValue}>All time · this service</div>
                </div>
              </div>

              {/* Card 3 — Avg Latency */}
              <div className={styles.card}>
                <div className={styles.iconBox} style={{ color: 'var(--orange)', background: 'var(--orange-bg)' }}>
                  <Zap size={20} />
                </div>
                <div className={styles.cardText}>
                  <div className={styles.label}>AVG LATENCY</div>
                  <div className={styles.value} style={{ fontWeight: 700 }}>{avgLatency > 0 ? `${avgLatency}ms` : '—'}</div>
                  <div className={styles.subValue}>P50 response time</div>
                </div>
              </div>

              {/* Card 4 — Error Rate */}
              <div className={styles.card}>
                <div className={styles.iconBox} style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>
                  <AlertTriangle size={20} />
                </div>
                <div className={styles.cardText}>
                  <div className={styles.label}>ERROR RATE</div>
                  <div className={styles.value} style={{ color: errorCount > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{errorRate}%</div>
                  <div className={styles.subValue}>{errorCount} failed requests</div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Right Column — Latency Sparkline ── */}
          <div className={styles.rightCol}>
            <div className={styles.schemaCard}>
              <div className={styles.schemaHeader}>
                <span className={styles.schemaTitle}>API Traffic Monitor</span>
                <div className={styles.schemaLine} />
                <span className={styles.schemaLive}>
                  <span className={styles.pulseDot} style={{ background: statusColor }} />
                  {statusLabel}
                </span>
              </div>

              {/* Project node */}
              <div className={styles.clusterBox}>
                <div className={styles.clusterHeader}>
                  <span className={styles.clusterName}>{projectName || 'Project'}</span>
                  <span className={styles.clusterLabel}>PROJECT</span>
                </div>

                <div className={styles.logicalBox}>
                  <div className={styles.logicalHeader}>
                    <span className={styles.logicalName}>{serviceName || 'All Services'}</span>
                    <span className={styles.logicalLabel}>SERVICE</span>
                  </div>

                  {/* Sparkline — Latency trend */}
                  <div className={styles.tenantBox}>
                    <div className={styles.tenantHeader}>
                      <span className={styles.tenantUk}>LATENCY TREND</span>
                      <span className={styles.tenantLabel}>LAST {calls.length || 20} REQUESTS</span>
                    </div>
                    <div className={styles.graphContainer}>
                      <svg width="100%" height="48" viewBox="0 0 200 48" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="gradUk" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                          </linearGradient>
                          <filter id="glowBlue">
                            <feGaussianBlur stdDeviation="1.5" result="blur" />
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <path className={styles.graphFillUk} d={sparkFillPath || 'M 0 48 L 200 48 Z'} fill="url(#gradUk)" />
                        <path className={styles.graphStrokeUk} pathLength="100"
                          d={sparkLinePath || 'M 0 35 C 30 15, 60 40, 100 20 C 140 0, 170 30, 200 10'}
                          fill="none" stroke="#3b82f6" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke" filter="url(#glowBlue)" />
                      </svg>
                    </div>
                    <div className={styles.sparkMeta}>
                      <span>Min: {latencies.length ? Math.min(...latencies) : 0}ms</span>
                      <span>Avg: {avgLatency}ms</span>
                      <span>Max: {latencies.length ? Math.max(...latencies) : 0}ms</span>
                    </div>
                  </div>

                  {/* Error Rate bar */}
                  <div className={styles.tenantBox}>
                    <div className={styles.tenantHeader}>
                      <span className={styles.tenantDe}>ERROR RATE</span>
                      <span className={styles.tenantLabel}>SUCCESS vs FAIL</span>
                    </div>
                    <div className={styles.errorBarWrap}>
                      <div className={styles.errorBarTrack}>
                        <div
                          className={styles.errorBarFill}
                          style={{ width: `${Math.min(Number(errorRate), 100)}%` }}
                        />
                      </div>
                      <span className={styles.errorBarLabel}>{errorRate}% errors</span>
                    </div>
                    <div className={styles.sparkMeta}>
                      <span style={{ color: 'var(--green)' }}>✓ {totalCalls - errorCount} success</span>
                      <span style={{ color: 'var(--red)' }}>✗ {errorCount} failed</span>
                    </div>
                  </div>

                </div>
              </div>

              <div className={styles.replayBox} onClick={(e) => {
                const el = e.currentTarget.parentElement;
                if (el) {
                  const bars = el.querySelectorAll<SVGPathElement>('path[class*="graphStroke"], path[class*="graphFill"]');
                  bars.forEach((b) => { b.style.animation = 'none'; void b.getBoundingClientRect(); b.style.animation = ''; });
                }
              }}>
                <RotateCw size={12} className={styles.replayIcon} /> Refresh
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
