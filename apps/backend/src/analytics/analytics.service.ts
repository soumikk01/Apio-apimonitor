import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

// TTLs — analytics data is heavier to compute so we cache longer
const SUMMARY_TTL = 30; // seconds — per range bucket
const ENDPOINTS_TTL = 60; // seconds — endpoint breakdown changes less often
const ACCESS_TTL = 60; // seconds — project access check result

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  private async assertProjectAccess(projectId: string, userId: string) {
    // Cache ownership check to avoid repeated DB hits on parallel requests
    const accessKey = `access:${projectId}:${userId}`;
    const cached = await this.cache.get<boolean>(accessKey);
    if (cached) return;

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ userId }, { members: { some: { userId } } }],
      },
    });
    if (!project)
      throw new ForbiddenException('Project not found or access denied');

    await this.cache.set(accessKey, true, ACCESS_TTL);
  }

  /**
   * GET /analytics/summary?projectId=&range=1h
   * range: 1h | 24h | 7d | 30d
   * Cached per (project + range) bucket.
   */
  async summary(userId: string, projectId: string, range = '24h') {
    await this.assertProjectAccess(projectId, userId);

    const cacheKey = `analytics:summary:${projectId}:${range}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const since = this.rangeToDate(range);
    const where = { projectId, createdAt: { gte: since } };

    // ⭐ 3 parallel lightweight DB queries — replaces loading 50,000 rows into RAM.
    // MongoDB computes counts and average server-side; Node.js receives only numbers.
    const [total, errors, latencyAgg] = await Promise.all([
      this.prisma.apiCall.count({ where }),
      this.prisma.apiCall.count({
        where: { ...where, status: { in: ['CLIENT_ERROR', 'SERVER_ERROR'] } },
      }),
      this.prisma.apiCall.aggregate({
        where,
        _avg: { latency: true },
      }),
    ]);

    const result = {
      total,
      errorRate:   total > 0 ? Math.round((errors / total) * 100) : 0,
      successRate: total > 0 ? Math.round(((total - errors) / total) * 100) : 0,
      avgLatency:  Math.round(latencyAgg._avg.latency ?? 0),
      range,
    };

    await this.cache.set(cacheKey, result, SUMMARY_TTL);
    return result;
  }

  /**
   * GET /analytics/endpoints?projectId=&range=24h
   * Returns per-endpoint breakdown sorted by call count.
   * Fix #10: now accepts an optional range parameter (same values as summary)
   * to filter by time. Cached per (project + range) bucket.
   */
  async endpoints(userId: string, projectId: string, range = '24h') {
    await this.assertProjectAccess(projectId, userId);

    const cacheKey = `analytics:endpoints:${projectId}:${range}`;
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const since = this.rangeToDate(range);

    // Fetch the most-recent 5,000 calls within the time window.
    // Prisma groupBy is not supported on MongoDB, so we group in Node.js.
    // 5k rows at ~200 bytes each = ~1 MB — safe, and covers high-traffic APIs.
    const calls = await this.prisma.apiCall.findMany({
      where: { projectId, createdAt: { gte: since } },
      select: {
        method: true,
        path: true,
        host: true,
        status: true,
        latency: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5_000, // Reduced from 50,000 — sufficient for top-endpoint analysis
    });

    // Group by method + host + path in memory
    const map = new Map<
      string,
      { count: number; errors: number; totalLatency: number }
    >();
    for (const c of calls) {
      const key = `${c.method} ${c.host}${c.path}`;
      const entry = map.get(key) ?? { count: 0, errors: 0, totalLatency: 0 };
      entry.count++;
      entry.totalLatency += c.latency;
      if (c.status === 'CLIENT_ERROR' || c.status === 'SERVER_ERROR') {
        entry.errors++;
      }
      map.set(key, entry);
    }

    const result = Array.from(map.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        errorRate: Math.round((data.errors / data.count) * 100),
        avgLatency: Math.round(data.totalLatency / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100); // Return top 100 endpoints only

    await this.cache.set(cacheKey, result, ENDPOINTS_TTL);
    return result;
  }

  private rangeToDate(range: string): Date {
    const now = new Date();
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h
    }
  }
}
