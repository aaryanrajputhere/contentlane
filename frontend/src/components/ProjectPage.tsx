import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Loader2,
  Play,
  Upload,
  Video,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { api, post } from '../lib/api';
import { creatorToCharacter } from '../lib/creatorLibrary';
import { selectMatchedClips } from '../lib/clipMatching';
import { getCaptionStyle } from '../lib/captionStyle';
import type { ConceptCard, CreatorClipRecord, ProjectSnapshot, CreatorRecord, ProjectResponse } from '../types/domain';

const AI_STEPS = [
  'Reading homepage...',
  'Understanding audience',
  'Finding competitors',
  'Detecting strongest pain point',
  'Choosing creator',
  'Building your brand profile'
];

function GenerationExperience({
  onComplete,
  isAnalyzing,
  isGeneratingHooks,
}: {
  onComplete: () => void;
  isAnalyzing: boolean;
  isGeneratingHooks: boolean;
}) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep >= AI_STEPS.length) {
      if (!isAnalyzing && !isGeneratingHooks) {
        onComplete();
      }
      return;
    }

    const timer = setTimeout(() => {
      // Pause at step 5 if hooks are still generating
      if (currentStep === 5 && isGeneratingHooks) {
        return;
      }
      setCurrentStep((s) => s + 1);
    }, 1800);

    return () => clearTimeout(timer);
  }, [currentStep, isAnalyzing, isGeneratingHooks, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full px-6">
      <div className="w-full space-y-5">
        {AI_STEPS.map((step, index) => {
          const isPast = index < currentStep;
          const isCurrent = index === currentStep;
          const isFuture = index > currentStep;

          if (isFuture) return null;

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center justify-center gap-4 text-lg ${isCurrent ? 'text-[#111111] font-semibold' : 'text-[#8c8c8c]'}`}
            >
              {isPast ? (
                <div className="grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-white">
                  <Check size={14} />
                </div>
              ) : (
                <div className="grid h-6 w-6 place-items-center">
                  <Loader2 size={16} className="animate-spin text-[#111111]" />
                </div>
              )}
              {step}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ReelPreviewCard({
  concept,
  creator,
  clip,
}: {
  concept: ConceptCard;
  creator: CreatorRecord | undefined;
  clip: CreatorClipRecord | null;
}) {
  const captionStyle = getCaptionStyle(concept.sortOrder);
  const usesSnapchatCaptions = captionStyle === 'SNAPCHAT';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.06)] aspect-[9/16] transition hover:-translate-y-1 hover:shadow-[0_30px_60px_rgba(0,0,0,0.1)]"
    >
      {clip && (
        <video
          src={clip.url}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

      <div className="absolute top-5 left-5 right-5 flex justify-between items-start">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-xs font-semibold shadow-sm">
          {creator?.baseImageUrl ? (
            <img src={creator.baseImageUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-white/20" />
          )}
          {creator?.name || 'Creator'}
        </div>
        <div className="flex items-center gap-1.5 bg-[#dcfce7] text-[#15803d] rounded-full px-3 py-1.5 text-xs font-bold shadow-sm">
          <Sparkles size={12} />
          {concept.score} Score
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 hover:bg-white/30 transition">
          <Play size={28} className="ml-1" fill="currentColor" />
        </button>
      </div>

      <div className={`absolute top-1/2 -translate-y-1/2 text-center ${usesSnapchatCaptions ? 'left-0 right-0 bg-black/60 px-5 py-1.5' : 'left-6 right-6'}`}>
        <p className={`text-white ${usesSnapchatCaptions ? 'text-[0.95rem] font-medium leading-[1.25]' : 'text-[1.35rem] font-bold leading-[1.15] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]'}`}>
          {concept.hookText}
        </p>
      </div>
    </motion.div>
  );
}

export default function ProjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [generationComplete, setGenerationComplete] = useState(false);
  const [visibleReelCount, setVisibleReelCount] = useState(3);
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [regenerationMessage, setRegenerationMessage] = useState('');
  const automaticGenerationAttempt = useRef<string | null>(null);

  const handleGenerationComplete = useCallback(() => {
    setGenerationComplete(true);
  }, []);

  const load = useCallback(async () => {
    const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}`);
    setProject(response.project);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load project'))
      .finally(() => setLoading(false));
  }, [load]);

  // Poll project state while jobs are running
  useEffect(() => {
    if (!project) return;
    const hasPendingJobs = project.jobs.some(j => ['QUEUED', 'ACTIVE'].includes(j.status));
    if (!hasPendingJobs) return;

    const interval = setInterval(() => {
      void load();
    }, 2000);
    return () => clearInterval(interval);
  }, [project, load]);

  useEffect(() => {
    let active = true;
    void api<{ creators: CreatorRecord[] }>('/creators')
      .then((response) => {
        if (active) {
          setCreatorLibrary(response.creators.map((c) => ({ ...c, character: creatorToCharacter(c) })));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const generateHooks = useCallback(async (forceRegenerate: boolean) => {
    if (busy) return;
    const hasDependentWork = Boolean(
      project?.exportState
      || project?.mediaAssets.some((asset) => asset.metadata?.kind !== 'brand-demo')
      || project?.concepts.some((concept) => concept.generatedImageUrl || concept.generatedVideoUrl),
    );
    if (forceRegenerate && hasDependentWork && !window.confirm('Regenerating will remove hook media and export settings. Your website analysis, creator, and product demo will stay. Continue?')) {
      return;
    }
    setBusy('Generating hooks');
    setError('');
    setRegenerationMessage('');
    try {
      const response = await post<ProjectResponse>(`/projects/${id}/concepts`, {
        count: 8,
        forceRegenerate,
      });
      setProject(response.project);
      setGenerationComplete(true);
      setRegenerationMessage(
        forceRegenerate && !response.cached
          ? `${response.project.concepts.length} hooks regenerated.`
          : '',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate hooks');
    } finally {
      setBusy(null);
    }
  }, [busy, id, project]);

  useEffect(() => {
    if (
      !project?.brandProfile
      || project.concepts.length > 0
      || busy
      || project.jobs.some((job) => job.type === 'GENERATE_CONCEPTS' && ['QUEUED', 'ACTIVE'].includes(job.status))
      || automaticGenerationAttempt.current === project.id
    ) {
      return;
    }

    automaticGenerationAttempt.current = project.id;
    void generateHooks(false);
  }, [busy, generateHooks, project]);

  // Set selected character if none
  useEffect(() => {
    if (project && !project.selectedCharacter && creatorLibrary.length > 0 && !busy) {
      const defaultCharacter = creatorLibrary[0].character;
      api<{ project: ProjectSnapshot }>(`/projects/${id}/character`, {
        method: 'PATCH',
        body: JSON.stringify({ character: defaultCharacter }),
      }).then(res => setProject(res.project)).catch(() => {});
    }
  }, [project, creatorLibrary, busy, id]);

  const uploadBrandDemo = async (file: File | undefined | null) => {
    if (!project || !file) return;
    setBusy('Uploading demo');
    try {
      const formData = new FormData();
      formData.append('demo', file);
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/brand-demo`, {
        method: 'POST',
        body: formData,
      });
      setProject(response.project);
      navigate(`/projects/${id}/render?count=${visibleReelCount}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload brand demo');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !project) {
    return <div className="grid min-h-screen place-items-center bg-[#fafaf8] text-[#111111]">Loading...</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#fafaf8] p-8 text-[#111111]">{error || 'Project not found.'}</div>;
  }

  const isAnalyzing = project.jobs.some(j => j.type === 'ANALYZE_WEBSITE' && ['QUEUED', 'ACTIVE'].includes(j.status));
  const isGeneratingHooks = busy === 'Generating hooks' || project.jobs.some(j => j.type === 'GENERATE_CONCEPTS' && ['QUEUED', 'ACTIVE'].includes(j.status));
  
  if (isAnalyzing && !generationComplete) {
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111] flex flex-col">
        <header className="mx-auto flex w-full max-w-[1400px] items-center px-6 pt-5 sm:px-8 lg:px-12">
          <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
        </header>
        <div className="flex-1 flex items-center">
          <GenerationExperience 
            onComplete={handleGenerationComplete} 
            isAnalyzing={isAnalyzing} 
            isGeneratingHooks={isGeneratingHooks} 
          />
        </div>
      </main>
    );
  }

  if (!project.concepts.length) {
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111] flex flex-col">
        <header className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 pt-5 sm:px-8 lg:px-12">
          <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
          <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-[#f3f3f3]">
            <ArrowLeft size={16} /> Back
          </button>
        </header>
        {error ? (
          <div className="grid flex-1 place-items-center px-6 py-16">
            <div className="w-full max-w-lg rounded-[28px] border border-black/8 bg-white p-8 text-center shadow-[0_24px_70px_rgba(36,29,77,0.08)]">
              <h1 className="text-3xl font-extrabold tracking-[-0.04em]">We couldn’t generate your hooks.</h1>
              <p role="alert" className="mt-4 text-sm leading-6 text-[#686868]">{error}</p>
              <button type="button" onClick={() => void generateHooks(false)} disabled={isGeneratingHooks} className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-[#111] px-7 py-3.5 text-sm font-bold text-white disabled:opacity-50">
                <Sparkles size={16} /> {isGeneratingHooks ? 'Generating…' : 'Try again'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <GenerationExperience
              onComplete={handleGenerationComplete}
              isAnalyzing={isAnalyzing}
              isGeneratingHooks={isGeneratingHooks || !project.concepts.length}
            />
          </div>
        )}
      </main>
    );
  }

  const selectedCreatorRecord = creatorLibrary.find(c => c.id === project.selectedCharacter?.id) || creatorLibrary[0];
  const availableReelCount = Math.min(project.concepts?.length ?? 0, 8);
  const displayConcepts = project.concepts?.length ? project.concepts.slice(0, visibleReelCount) : [];
  const hasMoreReels = visibleReelCount < availableReelCount;
  const brandDemoAsset = project.mediaAssets.find(
    (asset) => asset.type === 'VIDEO' && asset.metadata?.kind === 'brand-demo',
  );
  const matchedPreviewClips = selectMatchedClips(displayConcepts, selectedCreatorRecord?.clips ?? []);

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-5 sm:px-8 lg:px-12">
          <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] transition hover:bg-[#f3f3f3]"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1200px] px-6 sm:px-12 pt-16 pb-24">
        <div className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[1.05] tracking-[-0.05em] text-[#111111]">
              Your viral Reels are ready.
            </h1>
            <p className="text-[1.15rem] leading-[1.6] text-[#666666]">
              We chose <span className="font-semibold text-[#111111]">{selectedCreatorRecord?.name || 'a creator'}</span> because they match your audience perfectly. Here are {displayConcepts.length} concepts ready to go.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generateHooks(true)}
            disabled={isGeneratingHooks}
            className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-bold text-[#111111] transition hover:border-black/20 hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 sm:self-auto"
          >
            {isGeneratingHooks ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {isGeneratingHooks ? 'Regenerating…' : 'Regenerate hooks'}
          </button>
        </div>
        {(regenerationMessage || error) && (
          <div className="mb-8">
          {regenerationMessage && (
            <p role="status" className="inline-flex items-center gap-2 rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-semibold text-[#15803d]">
              <Check size={15} /> {regenerationMessage}
            </p>
          )}
          {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayConcepts.map((concept, index) => (
            <ReelPreviewCard
              key={concept.id}
              concept={concept}
              creator={selectedCreatorRecord}
              clip={matchedPreviewClips[index]}
            />
          ))}
        </div>

        {hasMoreReels ? (
          <div className="mb-24 mt-10 flex flex-col items-center text-center">
            <p className="mb-4 text-sm text-[#666666]">
              {availableReelCount - visibleReelCount} more hooks are ready for this campaign.
            </p>
            <button
              type="button"
              onClick={() => setVisibleReelCount(availableReelCount)}
              className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2"
            >
              <Sparkles size={17} />
              Generate more
            </button>
          </div>
        ) : (
          <div className="mb-24 mt-10 flex items-center justify-center gap-2 text-sm font-medium text-[#666666]">
            <Check size={16} className="text-[#15803d]" />
            All {availableReelCount} hooks are ready to render
          </div>
        )}

        <div className="bg-[#111111] rounded-[40px] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="grid md:grid-cols-[1fr_0.8fr] gap-12 items-center relative z-10">
            <div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold mb-5 leading-[1.1] tracking-[-0.04em]">Make it yours.</h2>
              <p className="text-white/70 mb-10 text-[1.1rem] leading-[1.6] max-w-md">
                Upload your product demo and we’ll render all {displayConcepts.length} Reels. Each one plays its matched hook first, followed by your full demo.
              </p>
              
              <div className="flex flex-wrap gap-3">
                {brandDemoAsset ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/projects/${id}/render?count=${displayConcepts.length}`)}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-[#111111] shadow-xl transition hover:scale-[1.02] hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
                  >
                    <Play size={20} fill="currentColor" />
                    Render {displayConcepts.length} Reels
                  </button>
                ) : null}
                <label className={`cursor-pointer inline-flex items-center gap-2 rounded-full px-8 py-4 font-bold transition hover:scale-[1.02] ${brandDemoAsset ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10' : 'bg-white text-[#111111] shadow-xl hover:bg-[#f3f3f3]'} ${busy === 'Uploading demo' ? 'cursor-wait opacity-60' : ''}`}>
                  {busy === 'Uploading demo' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  {busy === 'Uploading demo' ? 'Uploading...' : brandDemoAsset ? 'Replace demo' : 'Upload your demo'}
                  <input type="file" className="hidden" accept="video/*" onChange={e => uploadBrandDemo(e.target.files?.[0])} disabled={busy === 'Uploading demo'} />
                </label>
              </div>
              
              {brandDemoAsset && (
                <div className="mt-6 flex items-center gap-2 text-[#dcfce7]">
                  <Check size={16} />
                  <span className="text-sm font-medium">Demo ready. Render your {displayConcepts.length} finished cuts.</span>
                </div>
              )}
              {error && (
                <div className="mt-4 text-red-400 text-sm">{error}</div>
              )}
            </div>
            
            <div className="relative aspect-[9/16] bg-white/5 rounded-[28px] overflow-hidden flex items-center justify-center border border-white/10 backdrop-blur-sm">
               {brandDemoAsset ? (
                 <video src={brandDemoAsset.url} className="w-full h-full object-cover" autoPlay muted loop playsInline />
               ) : (
                 <div className="text-center text-white/40 px-6">
                   <Video size={48} className="mx-auto mb-4 opacity-50" />
                   <p className="font-semibold text-lg mb-1">Placeholder Section</p>
                   <p className="text-sm">Your product goes here</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
