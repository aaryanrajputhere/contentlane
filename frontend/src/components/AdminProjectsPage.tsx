import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminProjectRow, ProjectStatus } from '../types/domain';
import AdminHeader from './AdminHeader';

type ProjectsResponse = {
  projects: AdminProjectRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const statuses: Array<ProjectStatus | ''> = ['', 'DRAFT', 'ANALYZING', 'READY', 'HOOKS_READY', 'SCRIPTS_READY', 'MEDIA_READY', 'EXPORT_READY', 'FAILED'];

const label = (value: string) => value
  ? value.split('_').join(' ').toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase())
  : 'All statuses';

const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

function statusClass(status: ProjectStatus) {
  if (status === 'FAILED') return 'bg-red-50 text-red-700';
  if (status === 'EXPORT_READY') return 'bg-[#DCFCE7] text-[#15803D]';
  return 'bg-[#F3F4F6] text-[#555555]';
}

export default function AdminProjectsPage() {
  const [data, setData] = useState<ProjectsResponse | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search.trim()) params.set('search', search.trim());
      if (status) params.set('status', status);
      setData(await api<ProjectsResponse>(`/admin/projects?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111111]">
      <AdminHeader />
      <div className="mx-auto max-w-[1500px] p-3 sm:p-6">
        <section className="overflow-hidden rounded-[24px] border border-[#e4e4e4] bg-white shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
          <div className="border-b border-[#e8e8e8] px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Website activity</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">Projects</h1>
                <p className="mt-2 text-sm text-[#666666]">See which websites have entered the ContentLane pipeline.</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:flex-none">
                  <span className="sr-only">Search website or owner</span>
                  <Search size={16} className="absolute left-3.5 top-3.5 text-[#999999]" />
                  <input
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                    placeholder="Search website or owner"
                    className="w-full rounded-xl border border-[#dddddd] py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-[#999999] focus:border-[#111111] sm:w-72"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by project status</span>
                  <select
                    value={status}
                    onChange={(event) => { setStatus(event.target.value as ProjectStatus | ''); setPage(1); }}
                    className="h-full rounded-xl border border-[#dddddd] bg-white px-3 text-sm outline-none transition focus:border-[#111111]"
                  >
                    {statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}
                  </select>
                </label>
              </div>
            </div>
            {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : null}
          </div>

          {loading && !data ? (
            <div className="grid h-56 place-items-center"><Loader2 className="animate-spin text-[#888888]" /></div>
          ) : data?.projects.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-[#e8e8e8] bg-[#fafafa] text-[11px] uppercase tracking-[0.16em] text-[#888888]">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Website</th>
                      <th className="px-5 py-4 font-semibold">Owner</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Output</th>
                      <th className="px-5 py-4 font-semibold">Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ededed]">
                    {data.projects.map((project) => (
                      <tr key={project.id} className="transition hover:bg-[#fafafa]">
                        <td className="px-5 py-4">
                          <Link to={`/admin/projects/${project.id}`} className="group flex items-center gap-2">
                            <span className="min-w-0">
                              <span className="block max-w-[330px] truncate font-semibold tracking-[-0.02em]">{project.website}</span>
                              <span className="block truncate text-xs text-[#777777]">{project.normalizedWebsite}</span>
                            </span>
                            <ExternalLink size={13} className="shrink-0 text-[#aaaaaa] group-hover:text-[#111111]" />
                          </Link>
                        </td>
                        <td className="px-5 py-4">
                          <span className="block font-medium">{project.user?.name || 'Unknown user'}</span>
                          <span className="block text-xs text-[#777777]">{project.user?.email || 'No owner'}</span>
                        </td>
                        <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusClass(project.status)}`}>{label(project.status)}</span></td>
                        <td className="px-5 py-4 text-xs text-[#666666]">{project._count.concepts} hooks · {project._count.mediaAssets} assets · {project._count.jobs} jobs</td>
                        <td className="px-5 py-4 text-[#666666]">{date(project.updatedAt)}</td>
                        <td className="px-5 py-4 text-right"><Link to={`/admin/projects/${project.id}`} className="text-xs font-semibold text-[#111111] underline-offset-4 hover:underline">Inspect</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#e8e8e8] px-5 py-3 text-xs text-[#777777]">
                <span>{data.pagination.total} total projects</span>
                <div className="flex items-center gap-2">
                  <button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg p-2 transition hover:bg-[#f3f3f3] disabled:opacity-30"><ChevronLeft size={16} /></button>
                  <span>{page} of {data.pagination.totalPages}</span>
                  <button disabled={page === data.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg p-2 transition hover:bg-[#f3f3f3] disabled:opacity-30"><ChevronRight size={16} /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-8 py-20 text-center">
              <p className="font-semibold">No projects here</p>
              <p className="mt-1 text-sm text-[#888888]">Try another filter or search.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
