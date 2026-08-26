import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, Edit3, Home, Layers3, Save, Settings2, Sparkles, Video } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import { assignCreatorsToConcepts, effectiveCreatorSelection } from '../lib/creatorAssignments';
import { DEFAULT_HOOK_PATTERNS } from '../data/hookPatterns';
import type { BillingStatus, ConceptCard, CreatorRecord, GenerationJob, GenerationLanguage, HookPreferenceExample, ProjectResponse, ProjectSnapshot } from '../types/domain';
import BrandDemoLibrary from './BrandDemoLibrary';
import { HookEditSheet, SwipeReview } from './ProjectPage';
import type { ReviewAssignment } from './ProjectPage';
import { brandDemoName, brandDemos } from '../lib/brandDemos';
import HookVideoPreview from './HookVideoPreview';

const button = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-[#222] transition hover:border-black/25 hover:bg-[#f3f3f0] disabled:opacity-50';
const input = 'mt-2 w-full rounded-2xl border border-black/10 bg-[#fafaf8] px-4 py-3 text-sm outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/10';
const generationLanguages: GenerationLanguage[] = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi', 'Arabic', 'Japanese', 'Korean'];

type Section = 'home' | 'brand' | 'demos' | 'content' | 'generate';
type PreferenceDraft = { liked: string; rejected: string; patterns: string };
type ReelOutput = { url: string; conceptId: string };
type PendingRenderState = { pendingRenderConceptIds?: unknown };

function pendingRenderConceptIds(state: unknown, project: ProjectSnapshot) {
  if (!state || typeof state !== 'object') return [];
  const value = (state as PendingRenderState).pendingRenderConceptIds;
  if (!Array.isArray(value)) return [];
  const savedIds = new Set(project.concepts.filter((concept) => concept.reviewDecision === 'LIKED').map((concept) => concept.id));
  return [...new Set(value.filter((conceptId): conceptId is string => typeof conceptId === 'string' && savedIds.has(conceptId)))].slice(0, 100);
}

function sectionFromPath(pathname: string): Section {
  if (pathname.endsWith('/brand')) return 'brand';
  if (pathname.endsWith('/demos')) return 'demos';
  if (pathname.endsWith('/content')) return 'content';
  if (pathname.endsWith('/generate')) return 'generate';
  return 'home';
}

function parsePreferences(value: string): HookPreferenceExample[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 8).map((line) => {
    const [hookText, demoOverlayText, angle] = line.split('||').map((part) => part.trim());
    return { hookText: hookText || line, demoOverlayText: demoOverlayText || 'Show the product in action', angle: angle || 'User outcome', score: 90, selectedAt: new Date().toISOString() };
  });
}

function contextRows(items: string[]) {
  return Math.max(4, items.reduce((total, item) => total + Math.ceil(item.length / 34), 0) + 1);
}

function EditableExampleList({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const items = value ? value.split('\n') : [''];
  const updateItem = (index: number, nextValue: string) => {
    const nextItems = [...items];
    nextItems[index] = nextValue;
    onChange(nextItems.join('\n'));
  };
  const removeItem = (index: number) => onChange(items.filter((_, itemIndex) => itemIndex !== index).join('\n'));
  return <div className="mt-2 space-y-2">{items.map((item, index) => <div className="flex items-center gap-1.5" key={`example-${index}`}><input className="h-8 w-full rounded-[10px] border border-black/10 bg-[#fafaf8] px-3 text-xs outline-none transition focus:border-[#111] focus:ring-2 focus:ring-black/10" value={item} onChange={(event) => updateItem(index, event.target.value)} placeholder={placeholder} /><button type="button" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/10 text-base leading-none text-[#888] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" onClick={() => removeItem(index)} aria-label={`Remove example ${index + 1}`}>×</button></div>)}<button type="button" className="rounded-full border border-dashed border-black/20 px-3 py-2 text-xs font-bold text-[#666] transition hover:border-black/40 hover:text-[#111]" onClick={() => onChange([...items, ''].join('\n'))}>+ Add example</button></div>;
}

function outputs(job: GenerationJob): ReelOutput[] {
  const result = job.result;
  if (!result || typeof result !== 'object' || !Array.isArray((result as { reels?: unknown }).reels)) return [];
  return (result as { reels: Array<{ url?: unknown; conceptId?: unknown }> }).reels.filter((item): item is ReelOutput => typeof item.url === 'string' && typeof item.conceptId === 'string');
}

function projectOutputs(project: ProjectSnapshot): ReelOutput[] {
  return project.jobs.filter((job) => job.type === 'RENDER_REELS').flatMap(outputs);
}

export default function CampaignWorkspacePage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const section = sectionFromPath(location.pathname);
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const [projectResponse, creatorResponse, billingResponse] = await Promise.all([api<ProjectResponse>(`/projects/${id}`), api<{ creators: CreatorRecord[] }>('/creators'), api<BillingStatus>('/billing/status')]);
    setProject(projectResponse.project);
    setCreators(creatorResponse.creators);
    setBilling(billingResponse);
  };
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load campaign')); }, [id]);

  if (!project) return <main className="grid min-h-screen place-items-center bg-[#f6f6f1] text-sm">{error || 'Loading campaign…'}</main>;
  const pendingConceptIds = pendingRenderConceptIds(location.state, project);
  return <WorkspaceShell project={project} section={section}>
    {section === 'home' ? <HomeSection project={project} /> : null}
    {section === 'brand' ? <BrandSection project={project} onProjectChange={setProject} /> : null}
    {section === 'demos' ? <BrandDemosSection project={project} pendingRenderConceptIds={pendingConceptIds} onProjectChange={setProject} /> : null}
    {section === 'content' ? <ContentSection project={project} creators={creators} billing={billing} initialSelectedConceptIds={pendingConceptIds} onProjectChange={setProject} /> : null}
    {section === 'generate' ? <GenerateSection project={project} creators={creators} onProjectChange={setProject} /> : null}
  </WorkspaceShell>;
}

function WorkspaceShell({ project, section, children }: { project: ProjectSnapshot; section: Section; children: ReactNode }) {
  const navigate = useNavigate();
  const links: Array<{ key: Section; label: string; icon: typeof Home }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'brand', label: 'Brand', icon: Settings2 },
    { key: 'demos', label: 'Brand demos', icon: Video },
    { key: 'content', label: 'Content', icon: Layers3 },
    { key: 'generate', label: 'Generate more', icon: Sparkles },
  ];
  const pathFor = (key: Section) => key === 'home' ? `/projects/${project.id}` : `/projects/${project.id}/${key}`;
  const description = section === 'brand' ? 'Your strategy, feedback, and generation preferences.' : section === 'demos' ? 'The product footage available to every hook in this campaign.' : section === 'content' ? 'Your saved hooks and rendered videos.' : section === 'generate' ? 'Swipe through eight fresh ideas and keep the ones you want.' : '';
  return <main className="min-h-screen bg-[#f6f6f1] text-[#111]">
    <header className="border-b border-black/8 bg-[#f6f6f1]/90 backdrop-blur-xl"><div className="mx-auto flex max-w-[1240px] items-center justify-between gap-5 px-5 py-4 sm:px-8"><button onClick={() => navigate('/')} className="text-[11px] font-bold uppercase tracking-[.24em] text-[#777]">ContentLane</button><div className="hidden items-center gap-1 overflow-x-auto rounded-full border border-black/8 bg-white p-1 md:flex">{links.map(({ key, label, icon: Icon }) => <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => navigate(pathFor(key))} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${section === key ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f3f3f0]'}`}><Icon size={14} />{label}</button>)}</div><button onClick={() => navigate('/')} className={secondary}><ArrowLeft size={15} />Projects</button></div><div className="mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-5 pb-3 md:hidden sm:px-8">{links.map(({ key, label, icon: Icon }) => <button key={key} aria-current={section === key ? 'page' : undefined} onClick={() => navigate(pathFor(key))} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${section === key ? 'bg-[#111] text-white' : 'bg-white text-[#666]'}`}><Icon size={13} />{label}</button>)}</div></header>
    <section className="mx-auto max-w-[1240px] px-5 py-7 sm:px-8 sm:py-10"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#888]">{project.brandProfile?.brandName ?? 'Campaign'}</p><h1 className="mt-2 text-3xl font-black tracking-[-.055em] sm:text-5xl">{section === 'home' ? 'Make the next render.' : links.find((item) => item.key === section)?.label}</h1></div>{section === 'home' ? null : <p className="hidden max-w-sm text-right text-sm leading-6 text-[#777] sm:block">{description}</p>}</div>{children}</section>
  </main>;
}

function nextAction(project: ProjectSnapshot) {
  const saved = project.concepts.filter((concept) => concept.reviewDecision === 'LIKED').length;
  const hasDemo = project.mediaAssets.some((asset) => asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo');
  if (!project.brandProfile) return { label: 'Complete your brand profile', description: 'Give ContentLane the context it needs to make useful hooks.', route: 'brand' as Section };
  if (!saved) return { label: 'Generate more content', description: 'Swipe through fresh ideas and save the ones you want to use.', route: 'generate' as Section };
  if (!hasDemo) return { label: 'Add your product demo', description: 'Upload the product video that will follow the creator hook.', route: 'demos' as Section };
  return { label: 'Render more videos', description: 'Select any saved hooks from your content library and render the set you need.', route: 'content' as Section };
}

function HomeSection({ project }: { project: ProjectSnapshot }) {
  const navigate = useNavigate();
  const action = nextAction(project);
  const saved = project.concepts.filter((concept) => concept.reviewDecision === 'LIKED');
  const demos = brandDemos(project);
  return <div className="space-y-6"><section className="rounded-[32px] bg-[#111] p-7 text-white shadow-[0_24px_80px_rgba(0,0,0,.12)] sm:p-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#b8f36b]">Next step</p><h2 className="mt-5 max-w-2xl text-4xl font-black leading-[.98] tracking-[-.06em] sm:text-6xl">{action.label}</h2><p className="mt-5 max-w-xl text-sm leading-6 text-white/65">{action.description}</p><button className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#b8f36b] px-5 py-3 text-sm font-black text-[#111]" onClick={() => navigate(`/projects/${project.id}/${action.route === 'home' ? '' : action.route}`)}>{action.label}<ArrowRight size={16} /></button></section><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatusCard label="Brand" value={project.brandProfile ? 'Ready' : 'Needs setup'} complete={Boolean(project.brandProfile)} onClick={() => navigate(`/projects/${project.id}/brand`)} /><StatusCard label="Demos" value={`${demos.length} videos`} complete={demos.length > 0} onClick={() => navigate(`/projects/${project.id}/demos`)} /><StatusCard label="Saved" value={`${saved.length} hooks`} complete={saved.length > 0} onClick={() => navigate(`/projects/${project.id}/content`)} /><StatusCard label="Generate" value="8 fresh ideas" complete={false} onClick={() => navigate(`/projects/${project.id}/generate`)} /></div><section className="rounded-[28px] border border-black/8 bg-white p-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888]">Campaign</p><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-black tracking-[-.04em]">{project.website}</h2><p className="mt-1 text-sm text-[#777]">Brand feedback guides future ideas. Existing videos stay safe.</p></div><button className={secondary} onClick={() => navigate(`/projects/${project.id}/content`)}>Open content <ArrowRight size={15} /></button></div></section></div>;
}

function StatusCard({ label, value, complete, onClick }: { label: string; value: string; complete: boolean; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-[24px] border border-black/8 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#888]">{label}</p><span className={`grid h-7 w-7 place-items-center rounded-full ${complete ? 'bg-[#e5f6d4] text-[#4b8125]' : 'bg-[#f3f3f0] text-[#999]'}`}><Check size={14} /></span></div><p className="mt-4 text-lg font-black">{value}</p><p className="mt-1 text-xs font-semibold text-[#888]">Open {label.toLowerCase()}</p></button>;
}

function BrandSection({ project, onProjectChange }: { project: ProjectSnapshot; onProjectChange: (project: ProjectSnapshot) => void }) {
  const [profile, setProfile] = useState(project.brandProfile);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [languageBusy, setLanguageBusy] = useState(false);
  const [languageMessage, setLanguageMessage] = useState('');
  const [preferences, setPreferences] = useState<PreferenceDraft>({ liked: '', rejected: '', patterns: (project.hookPreferences?.patterns?.length ? project.hookPreferences.patterns : DEFAULT_HOOK_PATTERNS).join('\n') });
  if (!profile) return <EmptyPanel title="Brand profile is not ready" action="Open guided workflow" onClick={() => window.location.assign(`/projects/${project.id}/hooks`)} />;
  const updateList = (key: 'customerProblems' | 'keyBenefits' | 'proofPoints' | 'claimConstraints', value: string) => setProfile({ ...profile, [key]: value.split('\n').map((item) => item.trim()).filter(Boolean) });
  const save = async () => { setBusy('profile'); setMessage(''); try { const response = await api<ProjectResponse>(`/projects/${project.id}/brand-profile`, { method: 'PATCH', body: JSON.stringify({ brandName: profile.brandName, productSummary: profile.productSummary, targetAudience: profile.targetAudience, customerProblems: profile.customerProblems, keyBenefits: profile.keyBenefits, proofPoints: profile.proofPoints, claimConstraints: profile.claimConstraints }) }); onProjectChange(response.project); setProfile(response.project.brandProfile); setMessage('Brand profile saved for future generation.'); } catch (caught) { setMessage(caught instanceof ApiClientError ? caught.message : 'Unable to save changes.'); } finally { setBusy(''); } };
  const saveRules = async () => { setBusy('rules'); setMessage(''); try { const response = await api<ProjectResponse>(`/projects/${project.id}/hook-preferences`, { method: 'PATCH', body: JSON.stringify({ liked: [], rejected: parsePreferences(preferences.rejected), patterns: preferences.patterns.split('\n').map((item) => item.trim()).filter(Boolean) }) }); onProjectChange(response.project); setPreferences({ liked: '', rejected: '', patterns: (response.project.hookPreferences?.patterns?.length ? response.project.hookPreferences.patterns : DEFAULT_HOOK_PATTERNS).join('\n') }); setMessage('Generation preferences saved.'); } catch (caught) { setMessage(caught instanceof ApiClientError ? caught.message : 'Unable to save preferences.'); } finally { setBusy(''); } };
  const saveLanguage = async (language: GenerationLanguage) => { setLanguageBusy(true); setLanguageMessage(''); try { const response = await api<ProjectResponse>(`/projects/${project.id}/language`, { method: 'PATCH', body: JSON.stringify({ language }) }); onProjectChange(response.project); setLanguageMessage('Language saved for future hooks.'); } catch (caught) { setLanguageMessage(caught instanceof ApiClientError ? caught.message : 'Unable to save language.'); } finally { setLanguageBusy(false); } };
  return <div className="space-y-5"><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]"><section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><p className="max-w-2xl text-sm leading-6 text-[#666]">This is the context ContentLane uses when it creates new hooks. Updating it never changes existing videos.</p><div className="mt-7 space-y-5"><label className="block text-sm font-bold">Brand name<input className={input} value={profile.brandName} onChange={(e) => setProfile({ ...profile, brandName: e.target.value })} /></label><label className="block text-sm font-bold">What does your product do?<textarea className={input} rows={3} value={profile.productSummary} onChange={(e) => setProfile({ ...profile, productSummary: e.target.value })} /></label><label className="block text-sm font-bold">Who is it for?<textarea className={input} rows={2} value={profile.targetAudience} onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })} /></label><div className="flex items-center gap-3 border-t border-black/8 pt-5"><button className={button} onClick={() => void save()} disabled={busy === 'profile'}><Save size={15} />{busy === 'profile' ? 'Saving…' : 'Save changes'}</button>{message ? <span className="text-sm font-semibold text-[#4b8125]">{message}</span> : null}</div></div></section><section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><button className="flex w-full items-center justify-between text-left" onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><span><span className="block text-xs font-bold uppercase tracking-[.18em] text-[#888]">Optional context</span><span className="mt-2 block text-2xl font-black tracking-[-.04em]">More brand context</span></span><ChevronDown size={18} className={`transition ${advanced ? 'rotate-180' : ''}`} /></button>{advanced ? <div className="mt-6 grid gap-4 border-t border-black/8 pt-5 sm:grid-cols-2">{([['customerProblems', 'Customer problems'], ['keyBenefits', 'Key benefits'], ['proofPoints', 'Proof points'], ['claimConstraints', 'Claim constraints']] as const).map(([key, label]) => <label key={key} className="block text-sm font-bold">{label}<textarea className={`${input} resize-y overflow-hidden`} rows={contextRows(profile[key])} value={profile[key].join('\n')} onChange={(e) => updateList(key, e.target.value)} placeholder="One item per line" /></label>)}</div> : <p className="mt-5 text-sm leading-6 text-[#666]">Add problems, benefits, proof, and claim guardrails to make future hooks more specific.</p>}</section></div><section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888]">Generation preferences</p><h2 className="mt-2 text-xl font-black tracking-[-.04em]">Shape the next batch</h2></div><div className="text-sm font-bold text-[#666]">Always on</div></div><div className="mt-5 rounded-2xl border border-black/8 bg-[#fafaf8] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">Content language</p><p className="mt-1 text-xs leading-5 text-[#666]">Future hooks and demo overlays will use this language.</p></div><label className="sr-only" htmlFor="workspace-generation-language">Content language</label><select id="workspace-generation-language" className="rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-black focus:ring-2 focus:ring-black/10" value={project.hookPreferences?.language ?? "English"} onChange={(event) => void saveLanguage(event.target.value as GenerationLanguage)} disabled={languageBusy}>{generationLanguages.map((language) => <option key={language} value={language}>{language}</option>)}</select></div><p className="mt-2 min-h-5 text-xs font-semibold text-[#4b8125]" role="status" aria-live="polite">{languageBusy ? "Saving language…" : languageMessage}</p></div><div className="mt-5 space-y-5 border-t border-black/8 pt-5"><div><p className="text-sm font-bold">Good examples</p><EditableExampleList value={preferences.patterns} onChange={(patterns) => setPreferences({ ...preferences, patterns })} placeholder="Good hook pattern" /><span className="mt-2 block text-xs font-medium leading-5 text-[#777]">Each example is injected into the proven-pattern guidance and adapted to your brand.</span></div><div><p className="text-sm font-bold">Bad examples</p><EditableExampleList value={preferences.rejected} onChange={(rejected) => setPreferences({ ...preferences, rejected })} placeholder="Pattern to avoid" /><span className="mt-2 block text-xs font-medium leading-5 text-[#777]">Leave this empty if there are no patterns to avoid. These examples become negative guidance.</span></div><button className={`${secondary} w-fit`} onClick={() => void saveRules()} disabled={busy === 'rules'}><Save size={15} />{busy === 'rules' ? 'Saving…' : 'Save preferences'}</button></div></section></div>;
}

function BrandDemosSection({ project, pendingRenderConceptIds, onProjectChange }: { project: ProjectSnapshot; pendingRenderConceptIds: string[]; onProjectChange: (project: ProjectSnapshot) => void }) {
  const navigate = useNavigate();
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState('');
  const demos = brandDemos(project);
  const defaultDemo = demos.find((demo) => demo.id === project.defaultBrandDemoAssetId) ?? demos[0] ?? null;
  const overrideCount = project.concepts.filter((concept) => concept.assignedBrandDemoAssetId).length;
  const pendingCount = pendingRenderConceptIds.length;
  const pendingLabel = `${pendingCount} ${pendingCount === 1 ? 'video' : 'videos'}`;
  const continueRender = async () => {
    if (!defaultDemo || pendingCount === 0 || renderBusy) return;
    setRenderBusy(true); setRenderError('');
    try {
      await api(`/projects/${project.id}/render`, { method: 'POST', body: JSON.stringify({ conceptIds: pendingRenderConceptIds }) });
      navigate(`/projects/${project.id}/render`);
    } catch (caught) {
      setRenderError(caught instanceof ApiClientError ? caught.message : 'Unable to start render.');
      setRenderBusy(false);
    }
  };

  return <div className="space-y-5">
    {pendingCount > 0 ? <section className="flex flex-col gap-5 rounded-[28px] border border-[#b6df91] bg-[#eef9e4] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="pending-render-title">
      <div className="flex min-w-0 items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#111] text-[#b8f36b]"><Video size={19} /></span><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#4b8125]">Render waiting</p><h2 id="pending-render-title" className="mt-1 text-xl font-black tracking-[-.04em]">{pendingLabel} selected</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[#567044]">{defaultDemo ? 'Your product demo is ready. Continue when you want to start the render.' : 'Upload a product demo below. Your selection is preserved and rendering will not start automatically.'}</p>{renderError ? <p className="mt-2 text-sm font-bold text-red-700" role="alert">{renderError}</p> : null}</div></div>
      <div className="flex shrink-0 flex-wrap gap-2"><button type="button" className={secondary} onClick={() => navigate(`/projects/${project.id}/content`, { state: { pendingRenderConceptIds } })}>Back to selection</button>{defaultDemo ? <button type="button" className={button} onClick={() => void continueRender()} disabled={renderBusy}>{renderBusy ? 'Starting…' : `Continue rendering ${pendingLabel}`}</button> : null}</div>
    </section> : null}
    <section className="relative overflow-hidden rounded-[34px] bg-[#151515] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,.13)] sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#b8f36b]/10 blur-3xl" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b8f36b]">Campaign footage</p>
          <h2 className="mt-3 max-w-[13ch] text-3xl font-black leading-[.98] tracking-[-.055em] sm:text-5xl">One library. The right demo for every hook.</h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">Your default demo fills every Reel automatically. Choose a different one from the hook editor only when the story calls for it.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-2">{demos.length} of 10 demos</span><span className="rounded-full bg-white/10 px-3 py-2">{overrideCount} hook overrides</span></div>
        </div>
        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-[26px] border border-white/15 bg-white/5 p-2 shadow-2xl lg:mx-0">
          {defaultDemo ? <><div className="relative aspect-[9/16] overflow-hidden rounded-[19px] bg-black"><video src={defaultDemo.url} className="h-full w-full object-contain" muted autoPlay loop playsInline controls preload="metadata" /><span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#b8f36b] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-[#111]">Project default</span></div><p className="truncate px-2 pb-1 pt-3 text-sm font-black">{brandDemoName(defaultDemo)}</p></> : <div className="grid aspect-[9/16] place-items-center rounded-[19px] border border-dashed border-white/15 text-center text-sm font-bold text-white/45"><span><Video className="mx-auto mb-2" size={24} />No demo uploaded yet</span></div>}
        </div>
      </div>
    </section>

    <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8">
      <BrandDemoLibrary projectId={project.id} demos={demos} defaultDemoAssetId={project.defaultBrandDemoAssetId} onProjectChange={onProjectChange} layout="grid" />
    </section>
  </div>;
}


function ContentSection({ project, creators, billing, initialSelectedConceptIds, onProjectChange }: { project: ProjectSnapshot; creators: CreatorRecord[]; billing: BillingStatus | null; initialSelectedConceptIds: string[]; onProjectChange: (project: ProjectSnapshot) => void }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(initialSelectedConceptIds);
  const [showRendered, setShowRendered] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [missingDemoSelection, setMissingDemoSelection] = useState<string[]>([]);
  const [editingAssignment, setEditingAssignment] = useState<ReviewAssignment | null>(null);
  const savedConcepts = useMemo(() => project.concepts
    .filter((concept) => concept.reviewDecision === 'LIKED')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.sortOrder - b.sortOrder), [project.concepts]);
  const assignments = useMemo(() => assignCreatorsToConcepts(savedConcepts, creators, effectiveCreatorSelection(project, creators)), [savedConcepts, creators, project]);
  const savedIds = useMemo(() => new Set(savedConcepts.map((concept) => concept.id)), [savedConcepts]);
  const rendered = useMemo(() => projectOutputs(project).filter((output) => savedIds.has(output.conceptId)), [project, savedIds]);
  const conceptById = useMemo(() => new Map(project.concepts.map((concept) => [concept.id, concept])), [project.concepts]);
  const renderCapacity = billing?.videoUsage.remaining ?? (billing?.accessTier === 'admin' ? 100 : 0);
  const demoLibrary = useMemo(() => brandDemos(project), [project]);
  const selectedCreatorIds = new Set(effectiveCreatorSelection(project, creators)?.characters.map((creator) => creator.id) ?? []);
  const editorCreators = creators.filter((creator) => selectedCreatorIds.has(creator.id));
  useEffect(() => {
    if (initialSelectedConceptIds.length === 0) return;
    setSelected(initialSelectedConceptIds.filter((conceptId) => savedIds.has(conceptId)).slice(0, renderCapacity));
  }, [initialSelectedConceptIds, renderCapacity, savedIds]);
  const saveConcept = async (input: { conceptId: string; hookText: string; demoOverlayText: string; creatorId: string; clipId: string; brandDemoAssetId: string | null }) => {
    setBusy(`edit:${input.conceptId}`); setError('');
    try {
      const response = await api<ProjectResponse>(`/projects/${project.id}/concepts/${input.conceptId}`, { method: 'PATCH', body: JSON.stringify({ hookText: input.hookText, demoOverlayText: input.demoOverlayText, creatorId: input.creatorId, clipId: input.clipId, brandDemoAssetId: input.brandDemoAssetId }) });
      onProjectChange(response.project); setMessage('Hook, creator footage, and product demo saved.'); setEditingAssignment(null);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to save this hook.');
      throw caught;
    } finally { setBusy(''); }
  };
  const createBatch = async () => {
    if (selected.length === 0 || selected.length > renderCapacity) return;
    const hasBrandDemo = project.mediaAssets.some((asset) => asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo');
    if (!hasBrandDemo) {
      setMissingDemoSelection([...selected]);
      setError('');
      return;
    }
    setBusy('render');
    try {
      await api(`/projects/${project.id}/render`, { method: 'POST', body: JSON.stringify({ conceptIds: selected }) });
      navigate(`/projects/${project.id}/render`);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to start render.');
      setBusy('');
    }
  };
  return <div className="space-y-5"><section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm leading-6 text-[#666]">Only saved hooks appear here. Select any number up to your remaining render capacity.</p><p className="mt-2 text-xs font-bold uppercase tracking-[.16em] text-[#999]">{savedConcepts.length} saved hooks · {rendered.length} rendered outputs · {billing?.videoUsage.remaining ?? 'Unlimited'} remaining</p></div><button className={button} onClick={() => navigate(`/projects/${project.id}/generate`)}><Sparkles size={15} />Generate more</button></div><div className="mt-6 inline-flex rounded-full border border-black/10 bg-[#f3f3f0] p-1"><button className={`rounded-full px-4 py-2 text-sm font-bold ${!showRendered ? 'bg-[#111] text-white' : 'text-[#666]'}`} onClick={() => setShowRendered(false)}>Saved content</button><button className={`rounded-full px-4 py-2 text-sm font-bold ${showRendered ? 'bg-[#111] text-white' : 'text-[#666]'}`} onClick={() => setShowRendered(true)}>Rendered videos</button></div></section>{missingDemoSelection.length > 0 ? <section className="flex flex-col gap-4 rounded-[24px] border border-[#b6df91] bg-[#eef9e4] p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="missing-demo-title"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#4b8125]">Product demo required</p><h2 id="missing-demo-title" className="mt-1 text-lg font-black tracking-[-.03em]">Your {missingDemoSelection.length} selected {missingDemoSelection.length === 1 ? 'video is' : 'videos are'} saved.</h2><p className="mt-1 text-sm leading-6 text-[#567044]">Add the product footage that follows the hook, then choose when to start rendering.</p></div><div className="flex shrink-0 gap-2"><button type="button" className={secondary} onClick={() => setMissingDemoSelection([])}>Not now</button><button type="button" className={button} onClick={() => navigate(`/projects/${project.id}/demos`, { state: { pendingRenderConceptIds: missingDemoSelection } })}><Video size={15} />Add product demo</button></div></section> : null}{message || error ? <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-[#e8f8d4] text-[#315016]'}`}>{error || message}</p> : null}{showRendered ? <RenderedContent rendered={rendered} conceptById={conceptById} /> : <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div className="flex flex-col gap-3 border-b border-black/8 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888]">Saved content</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Choose what to render</h2><p className="mt-2 text-sm text-[#666]">Each selected hook becomes one rendered video.</p></div><button className={button} onClick={() => void createBatch()} disabled={selected.length === 0 || selected.length > renderCapacity || busy === 'render'}><Video size={15} />{busy === 'render' ? 'Starting…' : `Render selected · ${selected.length}`}</button></div>{renderCapacity === 0 ? <p className="mt-5 rounded-2xl bg-[#fff3ef] p-4 text-sm font-bold text-[#9a3e29]">Your render allowance is used for this billing period. Upgrade or wait for the reset.</p> : null}{assignments.length ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{assignments.map((assignment) => <HookVideoCard key={assignment.concept.id} assignment={assignment} selected={selected.includes(assignment.concept.id)} disabled={busy === `edit:${assignment.concept.id}`} onToggle={() => setSelected((current) => current.includes(assignment.concept.id) ? current.filter((conceptId) => conceptId !== assignment.concept.id) : current.length < renderCapacity ? [...current, assignment.concept.id] : current)} onEdit={() => setEditingAssignment(assignment)} />)}</div> : <EmptyPanel title="No saved content yet" action="Generate more" onClick={() => navigate(`/projects/${project.id}/generate`)} />}</section>}{editingAssignment ? <HookEditSheet assignment={editingAssignment} creators={editorCreators} demos={demoLibrary} defaultDemoAssetId={project.defaultBrandDemoAssetId} onCancel={() => setEditingAssignment(null)} onSave={saveConcept} /> : null}</div>;
}

function RenderedContent({ rendered, conceptById }: { rendered: ReelOutput[]; conceptById: Map<string, ConceptCard> }) {
  if (!rendered.length) return <EmptyPanel title="No rendered saved content yet" action="Go to saved content" onClick={() => window.history.back()} />;
  return <section className="rounded-[30px] border border-black/8 bg-white p-6 sm:p-8"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888]">Rendered videos</p><h2 className="mt-2 text-2xl font-black tracking-[-.04em]">Your finished content</h2></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rendered.map((output, index) => <article key={`${output.conceptId}-${output.url}`} className="overflow-hidden rounded-[26px] border border-black/10 bg-[#111] text-white"><video src={output.url} className="aspect-[9/16] w-full object-cover" controls playsInline /><div className="p-4"><p className="line-clamp-2 text-sm font-bold">{conceptById.get(output.conceptId)?.hookText ?? 'Rendered video'}</p><a href={output.url} download={`content-${index + 1}.mp4`} className={`${secondary} mt-4 w-full`}><Download size={14} />Download</a></div></article>)}</div></section>;
}

function GenerateSection({ project, creators, onProjectChange }: { project: ProjectSnapshot; creators: CreatorRecord[]; onProjectChange: (project: ProjectSnapshot) => void }) {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ConceptCard[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [assignmentMap, setAssignmentMap] = useState<Map<string, ReturnType<typeof assignCreatorsToConcepts>[number]>>(new Map());
  const started = useRef(false);
  const setReviewQueue = (concepts: ConceptCard[]) => { setQueue(concepts); setAssignmentMap(new Map(assignCreatorsToConcepts(concepts, creators, effectiveCreatorSelection(project, creators)).map((assignment) => [assignment.concept.id, assignment]))); };
  const reviewAssignments = queue.flatMap((concept) => {
    const assignment = assignmentMap.get(concept.id);
    return assignment ? [assignment] : [];
  });
  const reviewedCount = 8 - queue.length;
  const demoLibrary = useMemo(() => brandDemos(project), [project]);
  const selectedCreatorIds = new Set(effectiveCreatorSelection(project, creators)?.characters.map((creator) => creator.id) ?? []);
  const editorCreators = creators.filter((creator) => selectedCreatorIds.has(creator.id));
  const generate = async () => { setBusy('generate'); setError(''); const existingConceptIds = new Set(project.concepts.map((concept) => concept.id)); try { const response = await api<ProjectResponse>(`/projects/${project.id}/concepts`, { method: 'POST', body: JSON.stringify({ count: 8, append: true, forceRegenerate: false, useHookPreferences: true }) }); const freshConcepts = response.project.concepts.filter((concept) => !existingConceptIds.has(concept.id)).slice(-8); if (!freshConcepts.length) throw new Error('No fresh hooks were returned.'); onProjectChange(response.project); setReviewQueue(freshConcepts); } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to generate fresh hooks.'); } finally { setBusy(''); } };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const pending = project.concepts.filter((concept) => concept.reviewDecision === null).slice(-8);
    if (pending.length) setReviewQueue(pending);
    else void generate();
  }, [project.id]);
  const review = async (conceptId: string, decision: 'LIKED' | 'REJECTED') => {
    const assignment = assignmentMap.get(conceptId);
    if (!assignment) return false;
    setBusy(decision === 'LIKED' ? 'save' : 'reject');
    setError('');
    try {
      const response = await api<ProjectResponse>(`/projects/${project.id}/concepts/${conceptId}/review`, { method: 'PATCH', body: JSON.stringify({ decision, creatorId: assignment.creator.id, clipId: assignment.clip?.id }) });
      onProjectChange(response.project);
      setQueue((current) => current.filter((concept) => concept.id !== conceptId));
      return true;
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to save this decision.');
      return false;
    } finally {
      setBusy('');
    }
  };
  const saveConcept = async (input: { conceptId: string; hookText: string; demoOverlayText: string; creatorId: string; clipId: string; brandDemoAssetId: string | null }) => {
    setBusy('edit');
    setError('');
    try {
      const response = await api<ProjectResponse>(`/projects/${project.id}/concepts/${input.conceptId}`, { method: 'PATCH', body: JSON.stringify({ hookText: input.hookText, demoOverlayText: input.demoOverlayText, creatorId: input.creatorId, clipId: input.clipId, brandDemoAssetId: input.brandDemoAssetId }) });
      const updatedById = new Map(response.project.concepts.map((concept) => [concept.id, concept]));
      onProjectChange(response.project);
      setReviewQueue(queue.map((concept) => updatedById.get(concept.id) ?? concept));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Unable to save this hook.');
      throw caught;
    } finally {
      setBusy('');
    }
  };
  return <div className="flex flex-col items-center">
    <div className="mb-4 text-center text-[11px] font-bold uppercase tracking-[.2em] text-[#888]"><span>{reviewedCount} of 8 hooks selected</span><span className="mx-2">·</span><span>{queue.length} cards remaining</span><div className="mx-auto mt-3 flex gap-1.5">{Array.from({ length: 8 }, (_, index) => <span key={index} className={`h-1.5 w-7 rounded-full ${index < reviewedCount ? 'bg-[#111]' : 'bg-black/10'}`} />)}</div></div>
    {error ? <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
    {busy === 'generate' && !queue.length ? <div className="grid min-h-[620px] place-items-center text-center"><div><Sparkles className="mx-auto animate-pulse" size={28} /><p className="mt-4 font-bold">Generating…</p></div></div> : reviewAssignments.length ? <SwipeReview assignments={reviewAssignments} creators={editorCreators} demos={demoLibrary} defaultDemoAssetId={project.defaultBrandDemoAssetId} onDecision={review} onEdit={saveConcept} /> : <div className="pt-20 text-center"><Check className="mx-auto text-[#4b8125]" size={30} /><h2 className="mt-4 text-2xl font-black">All reviewed</h2><div className="mt-6 flex flex-wrap justify-center gap-3"><button className={secondary} onClick={() => navigate(`/projects/${project.id}/content`)}>View content <ArrowRight size={15} /></button><button className={button} onClick={() => { setQueue([]); void generate(); }}><Sparkles size={15} />Generate 8 more</button></div></div>}
  </div>;
}

function ContentCard({ assignment, selected, disabled, onToggle, onEdit }: { assignment: ReturnType<typeof assignCreatorsToConcepts>[number]; selected: boolean; disabled: boolean; onToggle: () => void; onEdit: () => void }) {
  const { concept, clip, creator } = assignment;
  const metadata = <p className="line-clamp-2 text-xs font-medium leading-4 text-white/80">{concept.demoOverlayText}</p>;
  const editButton = <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} onKeyDown={(event) => event.stopPropagation()} disabled={disabled} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/30 bg-black/55 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-50"><Edit3 size={13} />Edit</button>;
  return <article role="button" tabIndex={0} aria-pressed={selected} onClick={onToggle} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onToggle(); } }} className={`hook-card group relative aspect-[9/16] cursor-pointer overflow-hidden rounded-[26px] border-[3px] bg-[#111] transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 ${selected ? 'hook-card-selected z-10 scale-[1.025] border-black opacity-100 shadow-[0_0_0_5px_rgba(0,0,0,.1),0_18px_34px_rgba(0,0,0,.24)]' : 'border-white opacity-75 shadow-[0_8px_18px_rgba(0,0,0,.08)] hover:-translate-y-1 hover:scale-[1.01] hover:opacity-100 hover:shadow-[0_14px_26px_rgba(0,0,0,.16)]'}`}><HookVideoPreview concept={concept} creator={creator} clip={clip} compact bottomMetadata={metadata} bottomAction={editButton} /></article>;
}

function HookVideoCard(props: { assignment: ReturnType<typeof assignCreatorsToConcepts>[number]; selected: boolean; disabled: boolean; onToggle: () => void; onEdit: () => void }) { return <ContentCard {...props} />; }

function EmptyPanel({ title, action, onClick }: { title: string; action: string; onClick: () => void }) { return <section className="rounded-[30px] border border-dashed border-black/15 bg-white p-10 text-center"><h2 className="text-xl font-black">{title}</h2><button className={`${button} mt-5`} onClick={onClick}>{action}<ArrowRight size={15} /></button></section>; }
