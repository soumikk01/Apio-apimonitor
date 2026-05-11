import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export interface AuditQueryDto {
  page: number;
  limit: number;
  projectId?: string;
  startDate?: string;
  endDate?: string;
}

const AUDIT_TTL = 20; // seconds — audit logs are written rarely, safe to cache briefly

@Injectable()
export class AuditService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  /**
   * Paginated audit log list.
   * Cache key encodes all filter params for per-query isolation.
   */
  async findAll(userId: string, query: AuditQueryDto) {
    const { page, limit, projectId, startDate, endDate } = query;

    // Verify project access (owner OR member) if projectId provided
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId },
            { members: { some: { userId } } },
          ],
        },
      });
      if (!project)
        throw new ForbiddenException('Project not found or access denied');
    }

    const cacheKey = `audit:${userId}:${projectId ?? ''}:p${page}:l${limit}:${startDate ?? ''}:${endDate ?? ''}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const where: Record<string, unknown> = { userId };

    if (projectId) {
      where.projectId = projectId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        (where.createdAt as any).gte = new Date(startDate);
      }
      if (endDate) {
        (where.createdAt as any).lte = new Date(endDate);
      }
    }

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: {
            select: { name: true, id: true },
          },
        },
      }),
    ]);

    const result = {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cache.set(cacheKey, result, AUDIT_TTL);
    return result;
  }

  // Helper for other services to log audit events — no cache needed (write path)
  async logAction(
    userId: string,
    action: string,
    detail: any = null,
    projectId: string | null = null,
    ipAddress: string | null = null,
    userAgent: string | null = null,
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        projectId,
        action,
        detail,
        ipAddress,
        userAgent,
      },
    });
  }
}
