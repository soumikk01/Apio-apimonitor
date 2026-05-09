/**
 * Centralized query key factory + fetcher functions.
 * One place to define what data looks like and how to fetch it.
 */
import { fetchWithAuth } from './fetchWithAuth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  serviceMode: string;
  createdAt: string;
  _count?: { services?: number };
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  sdkToken?: string;
  createdAt: string;
  _count?: { apiCalls?: number };
}

export interface ProjectStats {
  total: number;
  errors: number;
  errorRate: number;
  avgLatency: number;
  successRate: number;
  activeInstances: number;
}

export interface RecentCall {
  id: string;
  method: string;
  url: string;
  path: string;
  host: string;
  statusCode: number | null;
  latency: number;
  status: string;
  createdAt: string;
}

/** Paginated response envelope for /calls endpoint */
export interface RecentCallsPage {
  data: RecentCall[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Member {
  user: { id: string; email: string; name: string | null };
  role: string;
}

// ── Query Keys ────────────────────────────────────────────────────────────────
// Structured as arrays so React Query can invalidate subtrees efficiently.

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
    stats: (id: string) => [...queryKeys.projects.all, 'stats', id] as const,
    // cursor scopes the cache key so each page is cached independently
    calls: (id: string, limit?: number, cursor?: string) =>
      [...queryKeys.projects.all, 'calls', id, limit, cursor] as const,
    members: (id: string) => [...queryKeys.projects.all, 'members', id] as const,
  },
  services: {
    all: ['services'] as const,
    list: (projectId: string) => [...queryKeys.services.all, 'list', projectId] as const,
    detail: (projectId: string, serviceId: string) =>
      [...queryKeys.services.all, 'detail', projectId, serviceId] as const,
  },
  user: {
    me: ['user', 'me'] as const,
  },
};

// ── Fetcher Functions ─────────────────────────────────────────────────────────

/** Fetch all projects for the current user */
export async function fetchProjects(): Promise<Project[]> {
  // Seed from localStorage for instant render on first paint
  const seed = (() => {
    try { return JSON.parse(localStorage.getItem('cachedProjectsV2') ?? '[]') as Project[]; }
    catch { return []; }
  })();

  const res = await fetchWithAuth(`${API}/projects`);
  if (!res.ok) return seed; // Return cached on error rather than crashing
  const fresh = await res.json() as Project[];
  localStorage.setItem('cachedProjectsV2', JSON.stringify(fresh));
  return fresh;
}

/** Fetch a single project by ID */
export async function fetchProject(projectId: string): Promise<Project> {
  const res = await fetchWithAuth(`${API}/projects/${projectId}`);
  if (!res.ok) throw new Error(`Failed to load project (${res.status})`);
  const data = await res.json() as Project;
  // Keep localStorage in sync for other pages that read it
  try {
    const list = JSON.parse(localStorage.getItem('cachedProjectsV2') ?? '[]') as Project[];
    const idx = list.findIndex(p => p.id === projectId);
    if (idx >= 0) list[idx] = data; else list.push(data);
    localStorage.setItem('cachedProjectsV2', JSON.stringify(list));
  } catch { /* ignore */ }
  return data;
}

/** Fetch all services for a project */
export async function fetchServices(projectId: string): Promise<Service[]> {
  const res = await fetchWithAuth(`${API}/projects/${projectId}/services`);
  if (!res.ok) throw new Error(`Failed to load services (${res.status})`);
  const data = await res.json() as Service[];
  // Cache service names for sidebar/dashboard title
  data.forEach(s => localStorage.setItem(`svcName:${s.id}`, s.name));
  return data;
}

/** Fetch a single service */
export async function fetchService(projectId: string, serviceId: string): Promise<Service> {
  // Fast path: check service name cache first
  const cachedName = localStorage.getItem(`svcName:${serviceId}`);

  const res = await fetchWithAuth(`${API}/projects/${projectId}/services/${serviceId}`);
  if (!res.ok) {
    // Return minimal cached data rather than crashing
    if (cachedName) return { id: serviceId, name: cachedName, isDefault: false, createdAt: '' };
    throw new Error(`Failed to load service (${res.status})`);
  }
  const data = await res.json() as Service;
  localStorage.setItem(`svcName:${serviceId}`, data.name);
  return data;
}

/** Fetch project stats (overview page) */
export async function fetchProjectStats(projectId: string): Promise<ProjectStats> {
  const res = await fetchWithAuth(`${API}/projects/${projectId}/stats`);
  if (!res.ok) throw new Error(`Failed to load stats (${res.status})`);
  return res.json() as Promise<ProjectStats>;
}

/**
 * Fetch recent API calls — first page (no cursor).
 * Returns a flat RecentCall[] for backward-compatible use in live feed components.
 */
export async function fetchRecentCalls(projectId: string, limit = 50): Promise<RecentCall[]> {
  const res = await fetchWithAuth(`${API}/projects/${projectId}/calls?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to load calls (${res.status})`);
  const page = await res.json() as RecentCallsPage;
  // Extract .data from the paginated envelope — callers receive RecentCall[] unchanged
  return page.data;
}

/**
 * Fetch a specific cursor page of API calls.
 * Use for infinite-scroll / "Load more" in the History & Logs pages.
 */
export async function fetchRecentCallsCursor(
  projectId: string,
  limit = 50,
  cursor?: string,
): Promise<RecentCallsPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const res = await fetchWithAuth(`${API}/projects/${projectId}/calls?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to load calls (${res.status})`);
  return res.json() as Promise<RecentCallsPage>;
}

/** Fetch project members list */
export async function fetchMembers(projectId: string): Promise<Member[]> {
  const res = await fetchWithAuth(`${API}/projects/${projectId}/members`);
  if (!res.ok) throw new Error(`Failed to load members (${res.status})`);
  return res.json() as Promise<Member[]>;
}
