import { ChevronLeft, ChevronRight, Loader2, Search, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminUserRow } from '../types/domain';
import AdminHeader from './AdminHeader';

type UsersResponse = { users: AdminUserRow[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));

export default function AdminUsersPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search.trim()) params.set('search', search.trim());
      setData(await api<UsersResponse>(`/admin/users?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Directory</p>
                <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">Users</h1>
                <p className="mt-2 text-sm text-[#666666]">Every account, project, and support footprint in one place.</p>
              </div>
              <label className="relative w-full sm:w-80">
                <span className="sr-only">Search name, email, or ID</span>
                <Search size={16} className="absolute left-3.5 top-3.5 text-[#999999]" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, email, or ID" className="w-full rounded-xl border border-[#dddddd] py-3 pl-10 pr-3 text-sm outline-none transition placeholder:text-[#999999] focus:border-[#111111]" />
              </label>
            </div>
            {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : null}
          </div>

          {loading && !data ? (
            <div className="grid h-56 place-items-center"><Loader2 className="animate-spin text-[#888888]" /></div>
          ) : data?.users.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-[#e8e8e8] bg-[#fafafa] text-[11px] uppercase tracking-[0.16em] text-[#888888]">
                    <tr><th className="px-5 py-4 font-semibold">Person</th><th className="px-5 py-4 font-semibold">Role</th><th className="px-5 py-4 font-semibold">Projects</th><th className="px-5 py-4 font-semibold">Support</th><th className="px-5 py-4 font-semibold">Joined</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-[#ededed]">
                    {data.users.map((user) => (
                      <tr key={user.id} className="transition hover:bg-[#fafafa]">
                        <td className="px-5 py-4"><Link to={`/admin/users/${user.id}`} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f3f3f3] text-[#555555]"><UserRound size={16} /></span><span className="min-w-0"><span className="block truncate font-semibold tracking-[-0.02em]">{user.name || 'Unnamed user'}</span><span className="block truncate text-xs text-[#777777]">{user.email}</span></span></Link></td>
                        <td className="px-5 py-4"><span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{user.role}</span></td>
                        <td className="px-5 py-4 font-semibold">{user._count.projects}</td>
                        <td className="px-5 py-4 text-[#666666]">{user._count.supportRequests}</td>
                        <td className="px-5 py-4 text-[#666666]">{date(user.createdAt)}</td>
                        <td className="px-5 py-4 text-right"><Link to={`/admin/users/${user.id}`} className="text-xs font-semibold text-[#111111] underline-offset-4 hover:underline">Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-[#e8e8e8] px-5 py-3 text-xs text-[#777777]"><span>{data.pagination.total} total users</span><div className="flex items-center gap-2"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg p-2 transition hover:bg-[#f3f3f3] disabled:opacity-30"><ChevronLeft size={16} /></button><span>{page} of {data.pagination.totalPages}</span><button disabled={page === data.pagination.totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg p-2 transition hover:bg-[#f3f3f3] disabled:opacity-30"><ChevronRight size={16} /></button></div></div>
            </>
          ) : (
            <div className="px-8 py-20 text-center"><p className="font-semibold">No users here</p><p className="mt-1 text-sm text-[#888888]">Try another search.</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
