import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, Loader2, Server, TriangleAlert } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import { assignCreatorsToConcepts, effectiveCreatorSelection } from '../lib/creatorAssignments';
import { createZip } from '../lib/zip';
import { brandDemoName, brandDemos } from '../lib/brandDemos';
import HookVideoPreview from './HookVideoPreview';
import type { ConceptCard, CreatorClipRecord, CreatorRecord, GenerationJob, ProjectResponse, ProjectSnapshot } from '../types/domain';

const shell = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const black = 'inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-5 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50';
const white = 'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

type Reel = { concept: ConceptCard; creator: CreatorRecord; clip: CreatorClipRecord; demoAssetId: string; demoName: string };
type Output = { conceptId: string; creatorName: string; url: string; sortOrder: number; format: string; demoAssetId?: string; demoName?: string };

function isCompleted(job: GenerationJob | null): job is GenerationJob & { status: 'COMPLETED' } { return job?.status === 'COMPLETED'; }
function isInProgress(job: GenerationJob | null) { return job?.status === 'QUEUED' || job?.status === 'ACTIVE'; }

export default function ProjectRenderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [creators, setCreators] = useState<CreatorRecord[]>([]);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      api<ProjectResponse>(`/projects/${id}`),
      api<{ creators: CreatorRecord[] }>('/creators'),
    ]).then(([projectResponse, creatorResponse]) => {
      if (cancelled) return;
      setProject(projectResponse.project);
      setCreators(creatorResponse.creators);
      // Jobs are returned newest-first; restore the latest render in any terminal
      // state as well so completed outputs survive a page reload.
      const existing = projectResponse.project.jobs.find((item) => item.type === 'RENDER_REELS');
      if (existing) setJob(existing);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load render'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!job || (job.status !== 'QUEUED' && job.status !== 'ACTIVE')) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await api<{ job: GenerationJob }>(`/jobs/${job.id}`);
        if (cancelled) return;
        setJob(response.job);
        if (response.job.status === 'QUEUED' || response.job.status === 'ACTIVE') window.setTimeout(() => void poll(), 1200);
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to poll render job'); }
    };
    void poll();
    return () => { cancelled = true; };
  }, [job?.id, job?.status]);

  const batchConceptIds = useMemo(() => {
    const value = job?.input?.conceptIds;
    return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : null;
  }, [job?.input]);
  const concepts = useMemo(() => {
    const source = batchConceptIds?.length
      ? (project?.concepts ?? []).filter((concept) => batchConceptIds.includes(concept.id))
      : (project?.concepts ?? []).filter((concept) => concept.reviewDecision === 'LIKED');
    return source.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [batchConceptIds, project?.concepts]);
  const assignments = useMemo(() => project ? assignCreatorsToConcepts(concepts, creators, effectiveCreatorSelection(project, creators)) : [], [project, creators, concepts]);
  const demos = project ? brandDemos(project) : [];
  const defaultDemo = demos.find((demo) => demo.id === project?.defaultBrandDemoAssetId) ?? demos[0];
  const reels: Reel[] = assignments.flatMap((item) => {
    const demo = demos.find((candidate) => candidate.id === item.concept.assignedBrandDemoAssetId) ?? defaultDemo;
    return item.clip && demo ? [{ concept: item.concept, creator: item.creator, clip: item.clip, demoAssetId: demo.id, demoName: brandDemoName(demo) }] : [];
  });
  const outputs = isCompleted(job) && job.result && typeof job.result === 'object' && Array.isArray((job.result as { reels?: unknown }).reels)
    ? (job.result as { reels: Output[] }).reels : [];
  const outputByConcept = new Map(outputs.map((output) => [output.conceptId, output]));
  const progress = job?.progress ?? 0;
  const renderInProgress = isInProgress(job);

  async function startRender() {
    if (!id || starting || reels.length === 0) return;
    setStarting(true); setError('');
    try {
      const response = await api<{ job: GenerationJob }>(`/projects/${id}/render`, {
        method: 'POST',
        body: JSON.stringify({ conceptIds: reels.map((reel) => reel.concept.id) }),
      });
      setJob(response.job);
    } catch (caught) { setError(caught instanceof ApiClientError ? caught.message : 'Unable to start server render'); }
    finally { setStarting(false); }
  }

  async function downloadAll() {
    if (outputs.length === 0 || downloading) return;
    setDownloading(true);
    try {
      const files = await Promise.all(outputs.map(async (output, index) => ({ name: `${id}-reel-${index + 1}.mp4`, blob: await fetch(output.url).then((response) => response.blob()) })));
      const blob = await createZip(files);
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${id}-reels.zip`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Unable to prepare the ZIP download.'); } finally { setDownloading(false); }
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#fafaf8]">Loading render…</div>;
  const failed = job?.status === 'FAILED';
  return <main className="min-h-screen bg-[#fafaf8] pb-16 text-[#111]">
    <header className="border-b border-black/6 bg-white"><div className={`${shell} flex items-center justify-between gap-4 py-4`}><div><p className="text-[13px] uppercase tracking-[0.34em]">ContentLane</p><p className="mt-2 text-sm text-[#666]">Server-rendered MP4 reels</p></div><button type="button" onClick={() => navigate(-1)} className={white}><ArrowLeft size={16} />Back</button></div></header>
    <section className={`${shell} pt-12`}>
      <div className="text-center"><div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"><Server size={15} />Video render</div><h1 className="mx-auto mt-7 max-w-[15ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[.94] tracking-[-.07em]">Your {reels.length} Reels are taking shape.</h1><p className="mx-auto mt-4 max-w-2xl text-[1.05rem] leading-7 text-[#666]">This render is preserved in your campaign history. Start another from your saved content whenever you want.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => navigate(`/projects/${id}/content`)} className={white}>Render more videos</button><button type="button" onClick={() => void startRender()} disabled={starting || renderInProgress || isCompleted(job) || reels.length === 0} className={black}>{starting || renderInProgress ? <Loader2 size={16} className="animate-spin" /> : <Server size={15} />}{starting || renderInProgress ? `Rendering ${progress}%` : isCompleted(job) ? 'Render complete' : 'Render on server'}</button><button type="button" onClick={() => void downloadAll()} disabled={outputs.length === 0 || downloading} className={white}><Download size={16} />{downloading ? 'Preparing ZIP…' : 'Download all'}</button></div></div>
      {failed ? <div className="mx-auto mt-8 flex max-w-2xl items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span className="flex items-center gap-2"><TriangleAlert size={17} />{job.errorMessage ?? 'The render failed.'}</span><button type="button" onClick={() => { setJob(null); void startRender(); }} className={white}>Retry</button></div> : null}
      {error ? <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-red-700">{error}</p> : null}
      <div className="mx-auto mt-10 grid max-w-[1120px] grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {reels.map((reel, index) => {
          const output = outputByConcept.get(reel.concept.id);
          const statusLabel = failed ? 'Failed' : renderInProgress ? `Rendering ${progress}%` : isCompleted(job) ? 'Unavailable' : 'Queued';
          return (
            <article
              key={reel.concept.id}
              aria-label={`Reel ${index + 1}: ${reel.concept.hookText}`}
              className="aspect-[9/16] w-full max-w-[360px] justify-self-center overflow-hidden rounded-[28px] border-2 border-[#151515] bg-[#111] shadow-[0_14px_34px_rgba(0,0,0,0.14)] sm:max-w-none"
            >
              <HookVideoPreview
                concept={reel.concept}
                creator={reel.creator}
                clip={reel.clip}
                videoSourceOverride={output?.url}
                compact
                className="rounded-[25px]"
                bottomMetadata={(
                  <div className="text-[10px] leading-[1.25] text-white/75 drop-shadow-sm sm:text-[11px]">
                    <p className="font-semibold text-white">Reel {index + 1}</p>
                    <p className="mt-0.5 line-clamp-2">Demo: {output?.demoName ?? reel.demoName}</p>
                  </div>
                )}
                bottomAction={output ? (
                  <a
                    href={output.url}
                    download={`${id}-reel-${index + 1}.mp4`}
                    aria-label={`Download Reel ${index + 1} as MP4`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/35 bg-black/65 px-3 py-2 text-[11px] font-bold text-white shadow-sm backdrop-blur transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <Download size={12} /> Download
                  </a>
                ) : (
                  <span aria-live="polite" className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold shadow-sm backdrop-blur ${failed ? 'border-red-300/50 bg-red-950/70 text-red-100' : 'border-white/25 bg-black/60 text-white'}`}>
                    {renderInProgress ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" /> : null}
                    {statusLabel}
                  </span>
                )}
              />
            </article>
          );
        })}
      </div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-[#888]">Server rendering keeps the browser responsive while the worker downloads, composes, and uploads each reel.</p>
    </section>
  </main>;
}
