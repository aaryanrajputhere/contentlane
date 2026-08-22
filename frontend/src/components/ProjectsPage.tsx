import { useEffect, useState } from 'react';
import { ArrowRight, CreditCard, Globe2, Loader2, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, ApiClientError, post } from '../lib/api';
import type { ProjectListItem, ProjectResponse } from '../types/domain';

const button = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#222] transition hover:border-black/25 hover:bg-[#f3f3f0] disabled:opacity-50';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<{ projects: ProjectListItem[] }>('/projects').then((response) => setProjects(response.projects)).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load websites')).finally(() => setLoading(false));
  }, []);

  async function createWebsite() {
    if (!website.trim() || creating) return;
    setCreating(true); setError('');
    try {
      const response = await post<ProjectResponse>('/projects', { website: website.trim() });
      navigate(`/projects/${response.project.id}/hooks`);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'SUBSCRIPTION_REQUIRED') { navigate('/billing'); return; }
      setError(caught instanceof Error ? caught.message : 'Unable to start this website');
    } finally { setCreating(false); }
  }

  return <main className="min-h-screen bg-[#f6f6f1] text-[#111]"><header className="border-b border-black/8 bg-[#f6f6f1]/90"><div className="mx-auto flex max-w-[1160px] items-center justify-between px-5 py-5 sm:px-8"><button onClick={() => navigate('/')} className="text-[11px] font-bold uppercase tracking-[.24em] text-[#777]">ContentLane</button><div className="flex items-center gap-2"><button className={secondary} onClick={() => navigate('/billing')}><CreditCard size={15} />Billing</button><button className={secondary} onClick={() => navigate('/')}><Plus size={15} />New website</button></div></div></header><section className="mx-auto max-w-[1160px] px-5 py-10 sm:px-8 sm:py-16"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#888]">Your workspace</p><h1 className="mt-3 max-w-xl text-4xl font-black tracking-[-.06em] sm:text-6xl">Choose a website to continue.</h1><p className="mt-4 max-w-xl text-base leading-7 text-[#666]">Each website has its own brand profile, hooks, and video batches.</p><section className="mt-9 rounded-[30px] border border-black/8 bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,.04)] sm:p-7"><div className="flex flex-col gap-3 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-black/10 bg-[#fafaf8] px-4"><Globe2 size={17} className="shrink-0 text-[#888]" /><span className="sr-only">New website URL</span><input value={website} onChange={(event) => setWebsite(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createWebsite(); }} placeholder="Add another website, e.g. https://yourcompany.com" className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none" /></label><button className={button} onClick={() => void createWebsite()} disabled={!website.trim() || creating}>{creating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}{creating ? 'Starting…' : 'Start website'}</button></div>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}</section><div className="mt-10">{loading ? <div className="flex items-center gap-2 text-sm text-[#777]"><Loader2 size={16} className="animate-spin" />Loading your websites…</div> : projects.length ? <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <button key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="group rounded-[26px] border border-black/8 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_40px_rgba(0,0,0,.08)] sm:p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate text-lg font-black tracking-[-.03em]">{project.brandProfile?.brandName ?? project.website}</p><p className="mt-1 truncate text-sm text-[#777]">{project.website}</p></div><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f2f2ee] transition group-hover:bg-[#e8f8d4]"><ArrowRight size={17} /></span></div><div className="mt-6 flex gap-4 text-xs font-bold uppercase tracking-[.12em] text-[#888]"><span>{project._count.concepts} hooks</span><span>{project.status.toLowerCase()}</span></div></button>)}</div> : <div className="rounded-[26px] border border-dashed border-black/15 bg-white p-8 text-center"><p className="font-bold">No websites yet.</p><p className="mt-2 text-sm text-[#777]">Add your first website above to begin.</p></div>}</div></section></main>;
}
