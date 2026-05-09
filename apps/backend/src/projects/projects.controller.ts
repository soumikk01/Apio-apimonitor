import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Header,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthRequest extends Request {
  user: { userId: string; email: string };
}

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  /** GET /projects — list user's projects (includes _count.apiCalls) */
  @Get()
  list(@Request() req: AuthRequest) {
    return this.projectsService.list(req.user.userId);
  }

  /** POST /projects — create project */
  @Post()
  create(@Request() req: AuthRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.userId, dto);
  }

  /** GET /projects/:id — single project */
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.findOne(id, req.user.userId);
  }

  /** PATCH /projects/:id — rename / update description */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, req.user.userId, dto);
  }

  /** DELETE /projects/:id — remove project (cascades ApiCalls) */
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.remove(id, req.user.userId);
  }

  /**
   * GET /projects/:id/stats
   * private — user-specific, browser caches 30s for instant back-navigation.
   */
  @Get(':id/stats')
  @Header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  getStats(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.getStats(id, req.user.userId);
  }

  /**
   * GET /projects/:id/calls?limit=50&cursor=<id>
   * First page: no cursor → seeds the live feed.
   * Next pages: pass nextCursor from previous response.
   * Browser caches 15s per page.
   */
  @Get(':id/calls')
  @Header('Cache-Control', 'private, max-age=15, stale-while-revalidate=30')
  getRecentCalls(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.projectsService.getRecentCalls(
      id,
      req.user.userId,
      limit ? parseInt(limit, 10) : 50,
      cursor,
    );
  }

  /** GET /projects/:id/members — get all members of a project */
  @Get(':id/members')
  getMembers(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.projectsService.getMembers(id, req.user.userId);
  }

  /** POST /projects/:id/members — add a member to the project */
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Request() req: AuthRequest,
    @Body('emailOrId') emailOrId: string,
  ) {
    return this.projectsService.addMember(id, req.user.userId, emailOrId);
  }
}
