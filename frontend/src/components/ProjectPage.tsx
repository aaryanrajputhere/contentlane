import { useCallback, useEffect, useState } from 'react';
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
import { calculateTfIdfCosineSimilarity } from '../lib/similarity';
import type { ProjectSnapshot, CreatorRecord, ProjectResponse } from '../types/domain';

const AI_STEPS = [
  'Reading homepage...',
  'Understanding audience',
  'Finding competitors',
  'Detecting strongest pain point',
  'Choosing creator',
  'Generating viral hooks',
  'Creating Reel #1',
  'Creating Reel #2',
  'Creating Reel #3'
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

function conceptTagsFromDirection(value: string) {
  return value
    .split(/[,.]/g)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function selectMatchedClips(concepts: ProjectSnapshot["concepts"], clips: CreatorRecord["clips"]) {
  const usedClipIds = new Set<string>();

  return concepts.map((concept, index) => {
    if (clips.length === 0) return null;

    const queryTags = conceptTagsFromDirection(concept.videoDirection);
    const scores = calculateTfIdfCosineSimilarity(queryTags, clips.map((clip) => clip.tags));

    let bestIndex = -1;
    let bestScore = 0;

    scores.forEach((score, clipIndex) => {
      const clip = clips[clipIndex];
      if (!clip || usedClipIds.has(clip.id)) return;
      if (bestIndex === -1 || score > bestScore) {
        bestIndex = clipIndex;
        bestScore = score;
      }
    });

    if (bestIndex === -1 || bestScore === 0) {
      bestIndex = clips.findIndex((clip, offset) => !usedClipIds.has(clip.id) && offset >= index % clips.length);
      if (bestIndex === -1) bestIndex = clips.findIndex((clip) => !usedClipIds.has(clip.id));
      if (bestIndex === -1) bestIndex = index % clips.length;
    }

    const matchedClip = clips[bestIndex] ?? clips[index % clips.length];
    if (matchedClip) usedClipIds.add(matchedClip.id);
    return matchedClip ?? null;
  });
}

function ReelPreviewCard({ concept, creator, clip }: { concept: any; creator: any; clip: any }) {
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

      <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 text-center">
        <p className="text-white text-[1.35rem] font-bold leading-[1.15] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
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
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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
    const hasPendingJobs = project.jobs.some(j => ['PENDING', 'RUNNING'].includes(j.status));
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

  const generateHooks = async () => {
    if (busy) return;
    setBusy('Generating hooks');
    try {
      const response = await post<ProjectResponse>(`/projects/${id}/concepts`, { count: 8, forceRegenerate: false });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate hooks');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (project && !project.concepts?.length && !busy && !error) {
      const analyzeJob = project.jobs.find(j => j.type === 'ANALYZE_WEBSITE' && ['PENDING', 'RUNNING'].includes(j.status));
      if (!analyzeJob) {
        generateHooks();
      }
    }
  }, [project, busy, error]);
  
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

  const isAnalyzing = project.jobs.some(j => j.type === 'ANALYZE_WEBSITE' && ['PENDING', 'RUNNING'].includes(j.status));
  const isGeneratingHooks = busy === 'Generating hooks' || project.jobs.some(j => j.type === 'GENERATE_CONCEPTS' && ['PENDING', 'RUNNING'].includes(j.status));
  
  if (!generationComplete) {
    return (
      <main className="min-h-screen bg-[#fafaf8] text-[#111111] flex flex-col">
        <header className="px-8 py-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[#111111]">ContentLane</p>
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

  const selectedCreatorRecord = creatorLibrary.find(c => c.id === project.selectedCharacter?.id) || creatorLibrary[0];
  const displayConcepts = project.concepts?.length ? project.concepts.slice(0, 3) : [];
  const brandDemoAsset = project.mediaAssets.find(a => a.type === 'VIDEO' && typeof a.metadata === 'object' && (a.metadata as any)?.kind === 'brand-demo');
  const matchedPreviewClips = selectMatchedClips(displayConcepts, selectedCreatorRecord?.clips ?? []);

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
      <header className="px-6 sm:px-12 py-6 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-50 border-b border-black/5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[#111111]">ContentLane</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-[#f3f3f3] transition"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      </header>

      <section className="mx-auto w-full max-w-[1200px] px-6 sm:px-12 pt-16 pb-24">
        <div className="max-w-2xl mb-12">
          <h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold leading-[1.05] tracking-[-0.05em] text-[#111111] mb-4">
            Your viral Reels are ready.
          </h1>
          <p className="text-[1.15rem] leading-[1.6] text-[#666666]">
            We chose <span className="font-semibold text-[#111111]">{selectedCreatorRecord?.name || 'a creator'}</span> because they match your audience perfectly. Here are 3 concepts ready to go.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {displayConcepts.map((concept, index) => (
            <ReelPreviewCard
              key={concept.id}
              concept={concept}
              creator={selectedCreatorRecord}
              clip={matchedPreviewClips[index]}
            />
          ))}
        </div>

        <div className="bg-[#111111] rounded-[40px] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="grid md:grid-cols-[1fr_0.8fr] gap-12 items-center relative z-10">
            <div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold mb-5 leading-[1.1] tracking-[-0.04em]">Make it yours.</h2>
              <p className="text-white/70 mb-10 text-[1.1rem] leading-[1.6] max-w-md">
                Upload your product demo, and we'll automatically replace the placeholder sections in the Reels above. Rendering happens in the background.
              </p>
              
              <label className={`cursor-pointer inline-flex items-center gap-2 px-8 py-4 rounded-full font-bold transition hover:scale-[1.02] shadow-xl ${busy === 'Uploading demo' ? 'bg-white/20 text-white cursor-wait' : 'bg-white text-[#111111] hover:bg-[#f3f3f3]'}`}>
                 {busy === 'Uploading demo' ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                 {busy === 'Uploading demo' ? 'Uploading...' : 'Upload your demo'}
                 <input type="file" className="hidden" accept="video/*" onChange={e => uploadBrandDemo(e.target.files?.[0])} disabled={busy === 'Uploading demo'} />
              </label>
              
              {brandDemoAsset && (
                <div className="mt-6 flex items-center gap-2 text-[#dcfce7]">
                  <Check size={16} />
                  <span className="text-sm font-medium">Demo uploaded successfully. Campaign finalizing.</span>
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
