import { ArrowLeft, FolderKanban, Loader2, Mail, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminProjectRow, AdminUserRow, SupportRequest } from '../types/domain';
import AdminHeader from './AdminHeader';

type UserDetail = AdminUserRow & { projects: AdminProjectRow[]; subscriptions: Array<{ id: string; status: string; currentPeriodEnd: string | null; dodoProductId: string }>; supportRequests: SupportRequest[] };
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const shell = 'rounded-[24px] border border-[#e4e4e4] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-6';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void api<{ user: UserDetail }>(`/admin/users/${id}`).then((response) => setUser(response.user)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load user.'));
  }, [id]);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111111]"><AdminHeader /><div className="mx-auto max-w-[1280px] p-3 sm:p-6"><Link to="/admin/users" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#777777] transition hover:text-[#111111]"><ArrowLeft size={16} />All users</Link>{error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : !user ? <div className={`${shell} grid h-48 place-items-center`}><Loader2 className="animate-spin text-[#888888]" /></div> : <>
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Account profile</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">{user.name || 'Unnamed user'}</h1><p className="mt-2 flex items-center gap-2 text-sm text-[#666666]"><Mail size={14} />{user.email}</p></div><span className="rounded-full bg-[#f3f4f6] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{user.role}</span></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3"><div className={shell}><p className="text-xs text-[#888888]">Projects</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em]">{user._count.projects}</p></div><div className={shell}><p className="text-xs text-[#888888]">Subscriptions</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em]">{user._count.subscriptions}</p></div><div className={shell}><p className="text-xs text-[#888888]">Joined</p><p className="mt-2 text-lg font-bold tracking-[-0.03em]">{date(user.createdAt)}</p></div></div>
      <section className={`${shell} mt-5`}><div className="flex items-center gap-3"><FolderKanban size={18} className="text-[#555555]" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Website history</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Projects run by this user</h2></div></div><div className="mt-5 divide-y divide-[#ededed]">{user.projects.map((project) => <Link to={`/admin/projects/${project.id}`} key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"><div><p className="font-semibold tracking-[-0.02em]">{project.website}</p><p className="mt-1 text-xs text-[#777777]">{project._count.concepts} hooks · {project._count.mediaAssets} assets · Updated {date(project.updatedAt)}</p></div><span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{project.status}</span></Link>)}{user.projects.length === 0 ? <p className="py-6 text-sm text-[#888888]">This user has not run a website through the pipeline.</p> : null}</div></section>
      <section className={`${shell} mt-5`}><div className="flex items-center gap-3"><MessageSquare size={18} className="text-[#555555]" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Support context</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Recent requests</h2></div></div><div className="mt-5 space-y-3">{user.supportRequests.map((request) => <div key={request.id} className="rounded-2xl border border-[#ededed] p-4"><div className="flex justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666]">{request.status}</span><span className="text-xs text-[#777777]">{date(request.createdAt)}</span></div><p className="mt-2 text-sm leading-6 text-[#444444]">{request.message}</p></div>)}{user.supportRequests.length === 0 ? <p className="py-6 text-sm text-[#888888]">No support requests.</p> : null}</div></section>
    </>}</div></main>
  );
}
