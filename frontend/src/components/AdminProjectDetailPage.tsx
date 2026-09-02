import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, Film, Loader2, Star, TriangleAlert, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { AdminProjectDetail } from '../types/domain';
import AdminHeader from './AdminHeader';

const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const label = (value: string) => value.split('_').join(' ').toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
const shell = 'rounded-[24px] border border-[#e4e4e4] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-6';

type AdminMediaAsset = AdminProjectDetail['mediaAssets'][number];

function isBrandDemo(asset: AdminMediaAsset) {
  return asset.conceptId === null && asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo';
}

function brandDemoName(asset: AdminMediaAsset) {
  const displayName = asset.metadata?.displayName;
  if (typeof displayName === 'string' && displayName.trim()) return displayName.trim();
  const originalName = asset.metadata?.originalName;
  if (typeof originalName === 'string' && originalName.trim()) return originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return 'Product demo';
}

function InspectableVideo({ src, label: videoLabel }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-[#111111]">
      {failed ? (
        <div className="absolute inset-0 grid place-items-center px-5 text-center text-xs leading-5 text-white/70">
          <span><TriangleAlert size={20} className="mx-auto mb-2 text-amber-300" />Video preview is unavailable.</span>
        </div>
      ) : (
        <video
          src={src}
          aria-label={videoLabel}
          className="h-full w-full bg-[#111111] object-contain outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a] focus-visible:ring-inset"
          controls
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

export default function AdminProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState<AdminProjectDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void api<{ project: AdminProjectDetail }>(`/admin/projects/${id}`)
      .then((response) => setProject(response.project))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load project.'));
  }, [id]);

  const brandDemos = useMemo(() => project?.mediaAssets.filter(isBrandDemo) ?? [], [project]);
  const reelCount = useMemo(() => project?.renderBatches.reduce((total, batch) => total + batch.reels.length, 0) ?? 0, [project]);
  const conceptById = useMemo(() => new Map(project?.concepts.map((concept) => [concept.id, concept]) ?? []), [project]);

  return (
    <main className="min-h-screen bg-[#f7f7f7] text-[#111111]">
      <AdminHeader />
      <div className="mx-auto max-w-[1280px] p-3 sm:p-6">
        <Link to="/admin/projects" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#777777] transition hover:text-[#111111]"><ArrowLeft size={16} />All projects</Link>
        {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm leading-5 text-red-700">{error}</p> : !project ? <div className={`${shell} grid h-48 place-items-center`}><Loader2 className="animate-spin text-[#888888]" /></div> : <>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#999999]">Project inspection</p><h1 className="mt-2 max-w-3xl break-words text-3xl font-bold tracking-[-0.05em] sm:text-4xl">{project.website}</h1><p className="mt-2 text-sm text-[#666666]">Owned by {project.user?.name || project.user?.email || 'Unknown user'} · Created {date(project.createdAt)}</p></div>
            <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] ${project.status === 'FAILED' ? 'bg-red-50 text-red-700' : project.status === 'EXPORT_READY' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#f3f4f6] text-[#555555]'}`}>{label(project.status)}</span><a href={project.website.startsWith('http') ? project.website : `https://${project.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#dddddd] bg-white px-4 py-2 text-sm font-semibold transition hover:border-[#111111]">Open site <ExternalLink size={14} /></a></div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <section className={shell}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Pipeline timeline</p><div className="mt-5 space-y-3">{project.jobs.map((job) => <div key={job.id} className="flex gap-4 rounded-2xl border border-[#ededed] p-4"><div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${job.status === 'FAILED' ? 'bg-red-50 text-red-600' : job.status === 'COMPLETED' ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#f3f4f6] text-[#555555]'}`}>{job.status === 'FAILED' ? <TriangleAlert size={15} /> : job.status === 'COMPLETED' ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold tracking-[-0.02em]">{label(job.type)}</p><span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777777]">{job.status}</span></div><p className="mt-1 text-xs text-[#777777]">{job.progressMessage || 'No progress message'} · {date(job.updatedAt)}</p>{job.errorMessage ? <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-700">{job.errorMessage}</p> : null}</div></div>)}{project.jobs.length === 0 ? <p className="text-sm text-[#888888]">No pipeline jobs recorded.</p> : null}</div></section>
            <section className="space-y-5"><div className={shell}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Website analysis</p>{project.websiteAnalysis ? <dl className="mt-5 space-y-4 text-sm"><div><dt className="text-xs text-[#888888]">Root domain</dt><dd className="mt-1 font-semibold">{project.websiteAnalysis.rootDomain}</dd></div><div><dt className="text-xs text-[#888888]">Source URL</dt><dd className="mt-1 break-all">{project.websiteAnalysis.sourceUrl}</dd></div><div><dt className="text-xs text-[#888888]">Last analyzed</dt><dd className="mt-1">{date(project.websiteAnalysis.updatedAt)}</dd></div></dl> : <p className="mt-5 text-sm text-[#888888]">Analysis has not completed.</p>}</div><div className={shell}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Production footprint</p><div className="mt-5 grid grid-cols-2 gap-5 text-center sm:grid-cols-4"><div><p className="text-2xl font-bold tracking-[-0.05em]">{project.concepts.length}</p><p className="mt-1 text-xs text-[#777777]">Hooks</p></div><div><p className="text-2xl font-bold tracking-[-0.05em]">{brandDemos.length}</p><p className="mt-1 text-xs text-[#777777]">Brand demos</p></div><div><p className="text-2xl font-bold tracking-[-0.05em]">{reelCount}</p><p className="mt-1 text-xs text-[#777777]">Reels</p></div><div><p className="text-2xl font-bold tracking-[-0.05em]">{project.jobs.length}</p><p className="mt-1 text-xs text-[#777777]">Jobs</p></div></div></div></section>
          </div>

          <section className={`${shell} mt-5`}>
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Media review</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Uploaded demos and generated reels</h2></div><span className="text-sm text-[#777777]">Read-only preview</span></div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Video size={17} /><h3 className="font-bold tracking-[-0.02em]">Brand demos</h3></div><span className="text-xs text-[#888888]">{brandDemos.length} uploaded</span></div>
              {brandDemos.length ? <div className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{brandDemos.map((demo) => <article key={demo.id} className="min-w-0 rounded-[22px] border border-[#e8e8e8] bg-[#fafafa] p-2"><div className="relative"><InspectableVideo src={demo.url} label={`Brand demo: ${brandDemoName(demo)}`} />{demo.id === project.defaultBrandDemoAssetId ? <span className="pointer-events-none absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#15803d] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white shadow-sm"><Star size={10} fill="currentColor" />Default</span> : null}</div><div className="px-1 pb-1 pt-3"><p className="truncate text-sm font-semibold" title={brandDemoName(demo)}>{brandDemoName(demo)}</p><p className="mt-1 text-[11px] text-[#888888]">Uploaded {date(demo.createdAt)}</p></div></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#d8d8d8] bg-[#fafafa] px-5 py-10 text-center"><Video size={22} className="mx-auto text-[#aaaaaa]" /><p className="mt-3 text-sm font-semibold">No brand demos uploaded</p><p className="mt-1 text-xs text-[#888888]">This project has no product demo videos to preview.</p></div>}
            </div>

            <div className="my-7 border-t border-[#e8e8e8]" />

            <div>
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Film size={17} /><h3 className="font-bold tracking-[-0.02em]">Generated reels</h3></div><span className="text-xs text-[#888888]">{reelCount} across {project.renderBatches.length} {project.renderBatches.length === 1 ? 'batch' : 'batches'}</span></div>
              {project.renderBatches.length ? <div className="mt-4 space-y-7">{project.renderBatches.map((batch, batchIndex) => <section key={batch.id} aria-labelledby={`render-batch-${batch.id}`}><div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-[#ededed] pb-3"><h4 id={`render-batch-${batch.id}`} className="text-sm font-bold">Render batch {project.renderBatches.length - batchIndex}</h4><p className="text-[11px] text-[#888888]">Completed {date(batch.completedAt)} · {batch.reels.length} {batch.reels.length === 1 ? 'reel' : 'reels'}</p></div><div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">{batch.reels.map((reel, reelIndex) => {
                const concept = conceptById.get(reel.conceptId);
                const reelLabel = concept?.hookText || `Reel ${reelIndex + 1}`;
                return <article key={`${batch.id}-${reel.conceptId}-${reelIndex}`} className="min-w-0 rounded-[22px] border border-[#242424] bg-[#151515] p-2 text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)]"><InspectableVideo src={reel.url} label={`Generated reel: ${reelLabel}`} /><div className="px-1 pb-1 pt-3"><p className="line-clamp-2 text-sm font-semibold leading-5" title={reelLabel}>{reelLabel}</p><p className="mt-2 truncate text-[11px] text-white/60">Creator: {reel.creatorName}</p><p className="mt-1 truncate text-[11px] text-white/60">Demo: {reel.demoName}</p></div></article>;
              })}</div></section>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-[#d8d8d8] bg-[#fafafa] px-5 py-10 text-center"><Film size={22} className="mx-auto text-[#aaaaaa]" /><p className="mt-3 text-sm font-semibold">No completed reels</p><p className="mt-1 text-xs text-[#888888]">Completed render batches will appear here.</p></div>}
            </div>
          </section>

          <section className={`${shell} mt-5`}><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#999999]">Generated concepts</p><h2 className="mt-1 text-xl font-bold tracking-[-0.04em]">Hook inventory</h2></div><span className="text-sm text-[#777777]">{project.concepts.length} concepts</span></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{project.concepts.map((concept) => <article key={concept.id} className="rounded-2xl border border-[#ededed] p-4 transition hover:border-[#111111]"><div className="flex justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#666666]">#{concept.sortOrder + 1} · {concept.scoreLabel}</span><span className="text-sm font-semibold">{concept.score}</span></div><p className="mt-3 text-sm font-semibold leading-6">{concept.hookText}</p><p className="mt-2 text-xs text-[#777777]">{concept.angle}</p>{concept.reviewDecision ? <span className="mt-3 inline-block rounded-full bg-[#f3f4f6] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#555555]">{concept.reviewDecision}</span> : null}</article>)}</div></section>
        </>}
      </div>
    </main>
  );
}
