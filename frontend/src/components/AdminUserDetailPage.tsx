import { ArrowLeft, Ban, FolderKanban, Gift, Loader2, Mail, MessageSquare, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminProjectRow, AdminUserRow, SupportRequest } from '../types/domain';
import AdminHeader from './AdminHeader';

type ComplimentaryAccess = { id: string; planId: 'starter' | 'pro'; startsAt: string; expiresAt: string | null; revokedAt: string | null; reason: string | null; grantedBy: { id: string; name: string | null; email: string } | null };
type UserDetail = AdminUserRow & { projects: AdminProjectRow[]; subscriptions: Array<{ id: string; status: string; currentPeriodEnd: string | null; dodoProductId: string }>; complimentaryAccess: ComplimentaryAccess | null; supportRequests: SupportRequest[] };
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const shell = 'rounded-[24px] border border-[#e4e4e4] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-6';

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [planId, setPlanId] = useState<'starter' | 'pro'>('pro');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');

  const loadUser = async () => {
    if (!id) return;
    const response = await api<{ user: UserDetail }>(`/admin/users/${id}`);
    setUser(response.user);
    const grant = response.user.complimentaryAccess;
    if (grant) {
      setPlanId(grant.planId);
      setExpiresAt(grant.expiresAt ? grant.expiresAt.slice(0, 16) : '');
      setReason(grant.reason ?? '');
    }
  };

  useEffect(() => {
    if (!id) return;
    void loadUser().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load user.'));
    // The route id is the only trigger; loadUser deliberately stays local to this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const saveGrant = async () => {
    if (!id || !user) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const body = { planId, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, reason: reason.trim() || null };
      await api(`/admin/users/${id}/complimentary-access`, { method: user.complimentaryAccess && !user.complimentaryAccess.revokedAt ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      await loadUser(); setNotice('Complimentary access saved.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save complimentary access.'); }
    finally { setSaving(false); }
  };

  const revokeGrant = async () => {
    if (!id) return;
    setSaving(true); setError(''); setNotice('');
    try { await api(`/admin/users/${id}/complimentary-access`, { method: 'DELETE' }); await loadUser(); setNotice('Complimentary access revoked.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not revoke complimentary access.'); }
    finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111111]"><AdminHeader /><div className="mx-auto max-w-[1280px] p-3 sm:p-6"><Link to="/admin/users" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#777777] transition hover:text-[#111111]"><ArrowLeft size={16} />All users</Link>{error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : !user ? <div className={`${shell} grid h-48 place-items-center`}><Loader2 className="animate-spin text-[#888888]" /></div> : <>
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Account profile</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] sm:text-4xl">{user.name || 'Unnamed user'}</h1><p className="mt-2 flex items-center gap-2 text-sm text-[#666666]"><Mail size={14} />{user.email}</p></div><span className="rounded-full bg-[#f3f4f6] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{user.role}</span></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3"><div className={shell}><p className="text-xs text-[#888888]">Projects</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em]">{user._count.projects}</p></div><div className={shell}><p className="text-xs text-[#888888]">Subscriptions</p><p className="mt-2 text-3xl font-bold tracking-[-0.06em]">{user._count.subscriptions}</p></div><div className={shell}><p className="text-xs text-[#888888]">Joined</p><p className="mt-2 text-lg font-bold tracking-[-0.03em]">{date(user.createdAt)}</p></div></div>
      {user.role !== 'ADMIN' ? <section className={`${shell} mt-5 border-[#dcebcf] bg-[#fbfff7]`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#dff5c8]"><Gift size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#66834d]">Complimentary access</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Grant a plan without billing</h2></div></div>{user.complimentaryAccess ? <span className={`w-fit rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.1em] ${user.complimentaryAccess.revokedAt ? 'bg-[#eee] text-[#777]' : user.complimentaryAccess.expiresAt && new Date(user.complimentaryAccess.expiresAt) <= new Date() ? 'bg-amber-100 text-amber-800' : 'bg-[#dff5c8] text-[#3d6220]'}`}>{user.complimentaryAccess.revokedAt ? 'Revoked' : user.complimentaryAccess.expiresAt && new Date(user.complimentaryAccess.expiresAt) <= new Date() ? 'Expired' : 'Active'}</span> : null}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Plan<select value={planId} onChange={(event) => setPlanId(event.target.value as 'starter' | 'pro')} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3 outline-none focus:border-black"><option value="starter">Starter · 30 renders</option><option value="pro">Pro · 100 renders</option></select></label><label className="text-sm font-bold">Access ends <span className="font-normal text-[#777]">(optional)</span><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-3 outline-none focus:border-black" /></label></div><label className="mt-4 block text-sm font-bold">Internal reason <span className="font-normal text-[#777]">(optional)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Partner, tester, customer recovery…" className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-3 outline-none focus:border-black" /></label><div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void saveGrant()} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#111] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{user.complimentaryAccess ? 'Save access' : 'Grant access'}</button>{user.complimentaryAccess && !user.complimentaryAccess.revokedAt ? <button type="button" onClick={() => void revokeGrant()} disabled={saving} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"><Ban size={15} />Revoke</button> : null}{user.complimentaryAccess?.grantedBy ? <span className="text-xs text-[#777]">Last changed by {user.complimentaryAccess.grantedBy.name || user.complimentaryAccess.grantedBy.email}</span> : null}</div>{notice ? <p role="status" className="mt-4 text-sm font-semibold text-[#4b8125]">{notice}</p> : null}</section> : null}
      <section className={`${shell} mt-5`}><div className="flex items-center gap-3"><FolderKanban size={18} className="text-[#555555]" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Website history</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Projects run by this user</h2></div></div><div className="mt-5 divide-y divide-[#ededed]">{user.projects.map((project) => <Link to={`/admin/projects/${project.id}`} key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0"><div><p className="font-semibold tracking-[-0.02em]">{project.website}</p><p className="mt-1 text-xs text-[#777777]">{project._count.concepts} hooks · {project._count.mediaAssets} assets · Updated {date(project.updatedAt)}</p></div><span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{project.status}</span></Link>)}{user.projects.length === 0 ? <p className="py-6 text-sm text-[#888888]">This user has not run a website through the pipeline.</p> : null}</div></section>
      <section className={`${shell} mt-5`}><div className="flex items-center gap-3"><MessageSquare size={18} className="text-[#555555]" /><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Support context</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Recent requests</h2></div></div><div className="mt-5 space-y-3">{user.supportRequests.map((request) => <div key={request.id} className="rounded-2xl border border-[#ededed] p-4"><div className="flex justify-between gap-3"><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#666666]">{request.status}</span><span className="text-xs text-[#777777]">{date(request.createdAt)}</span></div><p className="mt-2 text-sm leading-6 text-[#444444]">{request.message}</p></div>)}{user.supportRequests.length === 0 ? <p className="py-6 text-sm text-[#888888]">No support requests.</p> : null}</div></section>
    </>}</div></main>
  );
}
