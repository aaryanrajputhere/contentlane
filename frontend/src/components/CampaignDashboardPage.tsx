import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Edit3, Layers3, Save, Sparkles, Video } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import type { BrandProfile, ConceptCard, CreatorRecord, GenerationJob, HookPreferenceExample, ProjectResponse, ProjectSnapshot } from '../types/domain';

const fieldClass = 'mt-2 w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/10';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50';
const softButton = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#222] transition hover:border-black/25 hover:bg-[#f3f3f0] disabled:opacity-50';

type PreferenceDraft = { liked: string; rejected: string };

function preferenceText(items: HookPreferenceExample[]) {
  return items.map((item) => `${item.hookText} || ${item.demoOverlayText} || ${item.angle}`).join('\n');
}

function parsePreferences(value: string): HookPreferenceExample[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8).map((line) => {
    const [hookText, demoOverlayText, angle] = line.split('||').map((part) => part.trim());
    return { hookText: hookText || line, demoOverlayText: demoOverlayText || 'Show the product in action', angle: angle || 'User outcome', score: 90, selectedAt: new Date().toISOString() };
  });
}

function renderOutputs(job: GenerationJob) {
  const result = job.result;
  if (!result || typeof result !== 'object' || !Array.isArray((result as { reels?: unknown }).reels)) return [] as Array<{ url: string; conceptId: string }>;
  return (result as { reels: Array<{ url?: unknown; conceptId?: unknown }> }).reels.filter((item): item is { url: string; conceptId: string } => typeof item.url === 'string' && typeof item.conceptId === 'string');
}

export default function CampaignDashboardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [preferences, setPreferences] = useState<PreferenceDraft>({ liked: '', rejected: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [projectResponse, creatorResponse] = await Promise.all([
      api<ProjectResponse>(`/projects/${id}`),
      api<{ creators: CreatorRecord[] }>('/creators'),
    ]);
    setProject(projectResponse.project);
    setCreators(creatorResponse.creators);
    setProfile(projectResponse.project.brandProfile);
    const saved = projectResponse.project.hookPreferences;
    setPreferences({ liked: preferenceText(saved?.liked ?? []), rejected: preferenceText(saved?.rejected ?? []) });
  };

  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load campaign')); }, [id]);

  const concepts = useMemo(() => project?.concepts ?? [], [project]);
  const latestRender = project?.jobs.find((job) => job.type === 'RENDER_REELS');

  async function saveProfile() {
    if (!profile) return;
    setBusy('profile'); setError(''); setMessage('');
    try { const response = await api<ProjectResponse>(`/projects/${id}/brand-profile`, { method: 'PATCH', body: JSON.stringify({ brandName: profile.brandName, productSummary: profile.productSummary, targetAudience: profile.targetAudience, customerProblems: profile.customerProblems, keyBenefits: profile.keyBenefits, proofPoints: profile.proofPoints, claimConstraints: profile.claimConstraints }) }); setProject(response.project); setProfile(response.project.brandProfile); setMessage('Brand profile saved. Future generations will use it.'); }
    catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to save brand profile'); } finally { setBusy(''); }
  }

  async function savePreferences() {
    setBusy('preferences'); setError(''); setMessage('');
    try { const response = await api<ProjectResponse>(`/projects/${id}/hook-preferences`, { method: 'PATCH', body: JSON.stringify({ liked: parsePreferences(preferences.liked), rejected: parsePreferences(preferences.rejected), patterns: project?.hookPreferences?.patterns ?? [] }) }); setProject(response.project); setMessage('Generation examples saved.'); }
    catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to save generation examples'); } finally { setBusy(''); }
  }

  async function generateSimilar() {
    setBusy('hooks'); setError(''); setMessage('');
    try { const response = await api<ProjectResponse>(`/projects/${id}/concepts`, { method: 'POST', body: JSON.stringify({ count: 8, append: true, forceRegenerate: false, useHookPreferences: true }) }); setProject(response.project); setMessage('Eight similar hooks added to the library.'); }
    catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to generate similar hooks'); } finally { setBusy(''); }
  }

  async function saveConcept(concept: ConceptCard, hookText: string, demoOverlayText: string) {
    setBusy(`concept:${concept.id}`); setError('');
    try { const response = await api<ProjectResponse>(`/projects/${id}/concepts/${concept.id}`, { method: 'PATCH', body: JSON.stringify({ hookText, demoOverlayText }) }); setProject(response.project); setMessage('Hook copy saved.'); }
    catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to save hook copy'); } finally { setBusy(''); }
  }

  async function createBatch() {
    if (selected.length !== 8) return;
    setBusy('render'); setError('');
    try {
      await api(`/projects/${id}/render`, { method: 'POST', body: JSON.stringify({ conceptIds: selected }) });
      navigate(`/projects/${id}/render`);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to start render batch'); setBusy(''); }
  }

  function updateArray(key: 'customerProblems' | 'keyBenefits' | 'proofPoints' | 'claimConstraints', value: string) {
    setProfile((current) => current ? { ...current, [key]: value.split('\n').map((item) => item.trim()).filter(Boolean) } : current);
  }

  if (!project || !profile) return <main className="grid min-h-screen place-items-center bg-[#f6f6f1] text-sm">{error || 'Loading campaign…'}</main>;

  return <main className="min-h-screen bg-[#f6f6f1] text-[#111]">
    <header className="border-b border-black/8 bg-[#f6f6f1]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-5 sm:px-10"><div><p className="text-[11px] font-bold uppercase tracking-[.24em] text-[#777]">Campaign dashboard</p><h1 className="mt-1 text-2xl font-black tracking-[-.05em]">{profile.brandName}</h1></div><button className={softButton} onClick={() => navigate(`/projects/${id}`)}><ArrowLeft size={16} />Back to workflow</button></div></header>
    <section className="mx-auto max-w-[1440px] px-6 py-8 sm:px-10 sm:py-12">
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="rounded-[32px] bg-[#111] p-7 text-white shadow-[0_24px_80px_rgba(0,0,0,.14)] sm:p-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8f36b]">Your content engine</p><h2 className="mt-5 max-w-2xl text-4xl font-black leading-[.96] tracking-[-.06em] sm:text-6xl">Tune the brand. Keep the wins. Make the next batch.</h2><p className="mt-5 max-w-xl text-sm leading-6 text-white/65">Update the instructions behind your content without touching videos you have already rendered.</p><div className="mt-8 flex flex-wrap gap-3"><button className="inline-flex items-center gap-2 rounded-full bg-[#b8f36b] px-5 py-3 text-sm font-black text-[#111]" onClick={() => document.getElementById('hooks')?.scrollIntoView({ behavior: 'smooth' })}><Layers3 size={16} />Manage hook library</button>{latestRender ? <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-3 text-sm text-white/70"><Video size={16} />Previous batches stay safe</span> : null}</div></div><div className="grid grid-cols-2 gap-4"><div className="rounded-[28px] border border-black/8 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#888]">Hooks</p><p className="mt-4 text-4xl font-black">{concepts.length}</p><p className="mt-1 text-sm text-[#777]">in your library</p></div><div className="rounded-[28px] border border-black/8 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#888]">Batches</p><p className="mt-4 text-4xl font-black">{project.jobs.filter((job) => job.type === 'RENDER_REELS').length}</p><p className="mt-1 text-sm text-[#777]">render histories</p></div></div></div>
      {(message || error) ? <p className={`mt-5 rounded-2xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-[#e8f8d4] text-[#315016]'}`}>{error || message}</p> : null}
      <div className="mt-8 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
        <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#777]">01 · Brand profile</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">The source of truth</h2></div><button className={buttonClass} onClick={() => void saveProfile()} disabled={busy === 'profile'}><Save size={15} />{busy === 'profile' ? 'Saving…' : 'Save profile'}</button></div><div className="mt-6 space-y-4"><label className="block text-sm font-bold">Brand name<input className={fieldClass} value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} /></label><label className="block text-sm font-bold">Product summary<textarea className={fieldClass} rows={3} value={profile.productSummary} onChange={(e) => setProfile({ ...profile, productSummary: e.target.value })} /></label><label className="block text-sm font-bold">Target audience<textarea className={fieldClass} rows={2} value={profile.targetAudience} onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })} /></label>{([['customerProblems', 'Customer problems'], ['keyBenefits', 'Key benefits'], ['proofPoints', 'Proof points'], ['claimConstraints', 'Claim constraints']] as const).map(([key, label]) => <label className="block text-sm font-bold" key={key}>{label}<textarea className={fieldClass} rows={3} value={profile[key].join('\n')} onChange={(e) => updateArray(key, e.target.value)} placeholder="One item per line" /></label>)}</div></section>
        <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#777]">02 · Generation preferences</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Teach the next prompt</h2></div><button className={buttonClass} onClick={() => void savePreferences()} disabled={busy === 'preferences'}><Save size={15} />Save examples</button></div><p className="mt-3 text-sm leading-6 text-[#666]">One example per line. Use <span className="font-mono text-xs">hook || demo overlay || angle</span>. Liked examples guide the style; rejected examples mark patterns to avoid.</p><div className="mt-6 grid gap-4"><label className="block text-sm font-bold">Liked examples<textarea className={fieldClass} rows={8} value={preferences.liked} onChange={(e) => setPreferences({ ...preferences, liked: e.target.value })} placeholder="why was i doing this manually?? || turns out there's an easier way || saved time" /></label><label className="block text-sm font-bold">Rejected examples<textarea className={fieldClass} rows={8} value={preferences.rejected} onChange={(e) => setPreferences({ ...preferences, rejected: e.target.value })} placeholder="Generic headline || Generic product claim || broad claim" /></label></div></section>
      </div>
      <section id="hooks" className="mt-6 rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#777]">03 · Hook library</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Choose the next eight</h2><p className="mt-2 text-sm text-[#666]">Edit copy, select a fresh set, and render another batch. Existing videos are never replaced.</p></div><div className="flex flex-wrap gap-2"><button className={softButton} onClick={() => void generateSimilar()} disabled={busy === 'hooks'}><Sparkles size={15} />{busy === 'hooks' ? 'Generating…' : 'Generate similar hooks'}</button><button className={buttonClass} onClick={() => void createBatch()} disabled={selected.length !== 8 || busy === 'render'}><Video size={15} />{busy === 'render' ? 'Starting…' : `Render selected (${selected.length}/8)`}</button></div></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{concepts.map((concept) => <ConceptEditor key={concept.id} concept={concept} selected={selected.includes(concept.id)} disabled={busy === `concept:${concept.id}`} onToggle={() => setSelected((current) => current.includes(concept.id) ? current.filter((id) => id !== concept.id) : current.length < 8 ? [...current, concept.id] : current)} onSave={(hookText, demoOverlayText) => void saveConcept(concept, hookText, demoOverlayText)} />)}</div></section>
      <section className="mt-6 rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#777]">04 · Video batches</p><div className="mt-2 flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black tracking-[-.04em]">Your render history</h2><p className="mt-2 text-sm text-[#666]">Every completed batch stays available for download.</p></div><button className={softButton} onClick={() => navigate(`/projects/${id}/render`)}><Video size={15} />Open latest</button></div><div className="mt-5 space-y-3">{project.jobs.filter((job) => job.type === 'RENDER_REELS').map((job, index) => <div key={job.id} className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-[#fafaf8] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Batch {project.jobs.filter((item) => item.type === 'RENDER_REELS').length - index}</p><p className="mt-1 text-xs uppercase tracking-[.12em] text-[#888]">{job.status.toLowerCase()} · {new Date(job.createdAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{renderOutputs(job).map((output, outputIndex) => <a key={output.conceptId} className={softButton} href={output.url} download={`batch-${index + 1}-reel-${outputIndex + 1}.mp4`}>Download {outputIndex + 1}</a>)}</div></div>)}{project.jobs.every((job) => job.type !== 'RENDER_REELS') ? <p className="rounded-2xl bg-[#fafaf8] p-5 text-sm text-[#666]">No video batches yet. Select eight hooks above to create the first one.</p> : null}</div></section>
    </section>
  </main>;
}

function ConceptEditor({ concept, selected, disabled, onToggle, onSave }: { concept: ConceptCard; selected: boolean; disabled: boolean; onToggle: () => void; onSave: (hookText: string, demoOverlayText: string) => void }) {
  const [hookText, setHookText] = useState(concept.hookText);
  const [demoOverlayText, setDemoOverlayText] = useState(concept.demoOverlayText);
  return <article className={`rounded-[24px] border p-5 transition ${selected ? 'border-[#111] bg-[#f3f9e9] shadow-[0_8px_20px_rgba(42,68,14,.08)]' : 'border-black/8 bg-[#fafaf8]'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#888]">{concept.angle}</p><p className="mt-2 text-sm font-black leading-5">{hookText}</p></div><button type="button" aria-pressed={selected} onClick={onToggle} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${selected ? 'border-[#111] bg-[#111] text-white' : 'border-black/15 bg-white text-transparent'}`}><Check size={15} /></button></div><label className="mt-4 block text-xs font-bold text-[#555]">Hook text<input className={fieldClass} value={hookText} onChange={(e) => setHookText(e.target.value)} /></label><label className="mt-3 block text-xs font-bold text-[#555]">Demo overlay<input className={fieldClass} value={demoOverlayText} onChange={(e) => setDemoOverlayText(e.target.value)} /></label><button className={`${softButton} mt-4 w-full`} onClick={() => onSave(hookText, demoOverlayText)} disabled={disabled}><Edit3 size={14} />Save copy</button></article>;
}
