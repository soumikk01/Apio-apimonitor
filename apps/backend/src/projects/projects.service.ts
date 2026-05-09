import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ServicesService } from '../services/services.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

// TTLs
const STATS_TTL = 30; // seconds — stats refresh every 30s
const CALLS_TTL = 15; // seconds — recent calls list
const PROJECT_TTL = 300; // seconds — single project metadata (5 min, rarely changes)
const LIST_TTL = 60; // seconds — user's project list
const MEMBERS_TTL = 60; // seconds — project members list

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
    private servicesService: ServicesService,
  ) {}

  /** List all projects for a user, including API call count */
  async list(userId: string) {
    const cacheKey = `projects:v2:${userId}`;
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    let result: object[];
    try {
      result = await this.prisma.project.findMany({
        where: {
          OR: [{ userId }, { members: { some: { userId } } }],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { apiCalls: true, services: true } },
        },
      });
    } catch {
      // Fallback to simple query if members relation is not yet available
      result = await this.prisma.project.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { apiCalls: true, services: true } },
        },
      });
    }

    await this.cache.set(cacheKey, result, LIST_TTL);
    return result;
  }

  /** Create a new project */
  async create(userId: string, dto: CreateProjectDto) {
    const serviceMode = dto.serviceMode ?? 'single';
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        serviceMode,
        userId,
      },
    });
    // Auto-create default service for single-mode projects
    if (serviceMode === 'single') {
      await this.servicesService.createDefault(project.id, project.name);
    }
    await this.cache.del(`projects:v2:${userId}`);
    return project;
  }

  /** Get a single project (ownership verified, cached) */
  async findOne(projectId: string, userId: string) {
    const cacheKey = `project:${projectId}`;
    const cached = await this.cache.get<{
      id: string;
      userId: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
      members?: { userId: string; role: string }[];
    }>(cacheKey);

    if (cached) {
      const isOwner = cached.userId === userId;
      const isMember =
        cached.members?.some((m) => m.userId === userId) ?? false;
      if (!isOwner && !isMember) throw new ForbiddenException();
      return cached;
    }

    // First try with members included (new schema)
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { members: { select: { userId: true, role: true } } },
      });

      if (!project) throw new NotFoundException('Project not found');

      const isOwner = project.userId === userId;
      const isMember = project.members.some((m) => m.userId === userId);
      if (!isOwner && !isMember) throw new ForbiddenException();

      await this.cache.set(cacheKey, project, PROJECT_TTL);
      return project;
    } catch (err) {
      // If it's already a NestJS exception, rethrow it
      if (
        err instanceof NotFoundException ||
        err instanceof ForbiddenException
      ) {
        throw err;
      }
      // Fallback: query without members (old Prisma client)
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) throw new NotFoundException('Project not found');
      if (project.userId !== userId) throw new ForbiddenException();
      await this.cache.set(cacheKey, project, PROJECT_TTL);
      return project;
    }
  }

  /** Update project name / description */
  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    await this.findOne(projectId, userId); // verifies ownership
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
    // Bust caches
    await this.cache.del(
      `project:${projectId}`,
      `stats:${projectId}`,
      `calls:${projectId}`,
    );
    return updated;
  }

  /** Delete a project + all its ApiCall records (Prisma cascade) */
  async remove(projectId: string, userId: string) {
    const project = await this.findOne(projectId, userId);
    await this.prisma.project.delete({ where: { id: project.id } });
    // Bust all caches for this project
    await this.cache.delByPattern(`*:${projectId}*`);
    return { message: 'Project deleted' };
  }

  /**
   * Aggregate DB stats — cached 30 seconds.
   * Eliminates repetitive Atlas round-trips on every dashboard refresh.
   */
  async getStats(projectId: string, userId: string) {
    // Fix #8: cache key scoped by userId so user A's cached stats can't be
    // returned to user B (who may not have access to this project)
    const cacheKey = `stats:${projectId}:u${userId}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    await this.findOne(projectId, userId); // ownership guard — only on cache miss

    const since60s = new Date(Date.now() - 60_000);

    // ⭐ 4 parallel lightweight DB queries — replaces loading 10,000 rows into RAM.
    // Each query returns a single number; MongoDB does all aggregation server-side.
    const [total, errors, latencyAgg, recentCount] = await Promise.all([
      this.prisma.apiCall.count({ where: { projectId } }),
      this.prisma.apiCall.count({
        where: { projectId, status: { in: ['CLIENT_ERROR', 'SERVER_ERROR'] } },
      }),
      this.prisma.apiCall.aggregate({
        where: { projectId },
        _avg: { latency: true },
      }),
      // Calls in the last 60 seconds count as "live"
      this.prisma.apiCall.count({
        where: { projectId, createdAt: { gte: since60s } },
      }),
    ]);

    const result = {
      total,
      errors,
      errorRate:
        total > 0 ? parseFloat(((errors / total) * 100).toFixed(1)) : 0,
      avgLatency: Math.round(latencyAgg._avg.latency ?? 0),
      successRate:
        total > 0
          ? parseFloat((((total - errors) / total) * 100).toFixed(1))
          : 100,
      activeInstances: recentCount > 0 ? 1 : 0,
    };

    await this.cache.set(cacheKey, result, STATS_TTL);
    return result;
  }

  /**
   * Return the most recent API calls with cursor-based pagination.
   * The first page (no cursor) seeds the live feed on load.
   * Subsequent pages use the returned `nextCursor` to load older records.
   *
   * Response: { data: ApiCall[], nextCursor: string | null, hasMore: boolean }
   */
  async getRecentCalls(
    projectId: string,
    userId: string,
    limit = 50,
    cursor?: string,
  ) {
    // Fix #8: same userId scoping as getStats
    const cacheKey = `calls:${projectId}:u${userId}:${limit}:${cursor ?? 'first'}`;
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    await this.findOne(projectId, userId); // guard — only on cache miss

    // Fetch one extra row to determine whether another page exists.
    // Never cache the extra item — it's only used for the hasMore flag.
    const rows = await this.prisma.apiCall.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        method: true,
        url: true,
        path: true,
        host: true,
        statusCode: true,
        statusText: true,
        latency: true,
        status: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    const result = { data, nextCursor, hasMore };
    await this.cache.set(cacheKey, result, CALLS_TTL);
    return result;
  }

  /** Add a new member to the project */
  async addMember(projectId: string, ownerId: string, emailOrId: string) {
    const project = await this.findOne(projectId, ownerId);
    if (project.userId !== ownerId) {
      throw new ForbiddenException('Only the project owner can add members');
    }

    // Try finding by email first, or fallback to exact ID if it's 24 chars
    const targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: emailOrId },
          {
            id:
              emailOrId.length === 24 ? emailOrId : '000000000000000000000000',
          },
        ],
      },
    });

    if (!targetUser) throw new NotFoundException('User not found');
    if (targetUser.id === ownerId)
      throw new BadRequestException('Cannot add yourself to the project');

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUser.id } },
    });
    if (existing) throw new BadRequestException('User is already a member');

    await this.prisma.projectMember.create({
      data: { projectId, userId: targetUser.id, role: 'MEMBER' },
    });

    await this.cache.del(`project:${projectId}`, `members:${projectId}`);
    return { message: 'Member added successfully' };
  }

  /** Get all members for a project */
  async getMembers(projectId: string, userId: string) {
    await this.findOne(projectId, userId); // Check permissions

    const cacheKey = `members:${projectId}`;
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    const result = [
      { user: project.user, role: 'OWNER' },
      ...project.members.map((m) => ({ user: m.user, role: m.role })),
    ];

    await this.cache.set(cacheKey, result, MEMBERS_TTL);
    return result;
  }
}
