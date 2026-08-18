import { Activity, ArrowUpRight, CheckCircle2, FolderKanban, Loader2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminOverview } from '../types/domain';
import AdminHeader from './AdminHeader';

const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const statusLabel = (value: string) => value.split('_').join(' ').toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
const card = 'rounded-[24px] border border-[#e4e4e4] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)]';
const statItems = (data: AdminOverview): Array<{ icon: LucideIcon; label: string; value: number; href: string }> => [
  { icon: Users, label: 'Users', value: data.metrics.users, href: '/admin/users' },
  { icon: FolderKanban, label: 'Projects', value: data.metrics.projects, href: '/admin/projects' },
  { icon: Activity, label: 'Pipeline jobs', value: data.metrics.jobs, href: '/admin/jobs' },
  { icon: CheckCircle2, label: 'Active subscriptions', value: data.metrics.activeSubscriptions, href: '/admin/users' },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { void api<AdminOverview>('/admin/overview').then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load overview.')); }, []);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111111]">
      <AdminHeader />
      <div className="mx-auto max-w-[1500px] p-3 sm:p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-5 sm:mb-8">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Operations room</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">What is moving today?</h1><p className="mt-2 text-sm text-[#666666]">A live read on users, websites, and the creative pipeline.</p></div>
          <div className="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-semibold text-[#666666]">Updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        {error ? <p role="alert" className="mb-5 rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : null}
        {!data ? <div className={`${card} grid h-48 place-items-center`}><Loader2 className="animate-spin text-[#888888]" /></div> : <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{statItems(data).map(({ icon: Icon, label, value, href }) => <Link to={href} key={label} className={`${card} group transition hover:-translate-y-0.5 hover:border-[#111111]`}><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f3f3f3] text-[#555555]"><Icon size={18} /></span><ArrowUpRight size={16} className="text-[#aaaaaa] transition group-hover:text-[#111111]" /></div><p className="mt-6 text-3xl font-bold tracking-[-0.06em]">{value}</p><p className="mt-1 text-sm text-[#666666]">{label}</p></Link>)}</div>
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Project flow</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Where projects are landing</h2><div className="mt-6 space-y-3">{Object.entries(data.projectStatuses).map(([key, value]) => <div key={key}><div className="mb-1 flex justify-between text-xs"><span>{statusLabel(key)}</span><span className="font-semibold">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eeeeee]"><div className="h-full rounded-full bg-[#111111]" style={{ width: `${Math.min(100, Math.max(4, value / Math.max(1, data.metrics.projects) * 100))}%` }} /></div></div>)}</div></section>
            <section className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Reliability</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Latest pipeline activity</h2><div className="mt-5 divide-y divide-[#ededed]">{data.recentJobs.map((job) => <Link to={`/admin/projects/${job.project.id}`} key={job.id} className="flex items-center justify-between gap-4 py-3 first:pt-0"><div className="min-w-0"><p className="truncate text-sm font-semibold">{job.type.split('_').join(' ')}</p><p className="truncate text-xs text-[#777777]">{job.project.website} · {date(job.updatedAt)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${job.status === 'FAILED' ? 'bg-red-50 text-red-700' : job.status === 'COMPLETED' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#f3f4f6] text-[#555555]'}`}>{job.status}</span></Link>)}{data.recentJobs.length === 0 ? <p className="py-5 text-sm text-[#888888]">No pipeline activity yet.</p> : null}</div></section>
          </div>
          <section className={`${card} mt-5`}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Recent users</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">New accounts to know</h2></div><Link to="/admin/users" className="text-sm font-semibold text-[#111111] underline-offset-4 hover:underline">View all</Link></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.recentUsers.map((user) => <Link to={`/admin/users/${user.id}`} key={user.id} className="rounded-2xl border border-[#ededed] p-4 transition hover:border-[#111111]"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold">{user.name || user.email}</p><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666]">{user.role}</span></div><p className="mt-1 truncate text-xs text-[#777777]">{user.email}</p><p className="mt-3 text-xs text-[#777777]">{user._count.projects} projects · Joined {date(user.createdAt)}</p></Link>)}</div></section>
        </>}
      </div>
    </main>
  );
}
