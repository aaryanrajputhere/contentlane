import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  Circle,
  Globe,
  Loader2,
  Play,
  Sparkles,
  Upload,
  Star,
  Target,
  Wand2,
  Zap,
} from 'lucide-react';
import { api, post } from '../lib/api';
import { creatorToCharacter } from '../lib/creatorLibrary';
import { creatorCharacters } from '../data/creatorCharacters';
import type { BrandProfile, CreatorCharacter, CreatorClipRecord, CreatorRecord, GenerationJob, MediaAsset, ProjectResponse, ProjectSnapshot } from '../types/domain';

type InsightCard = {
  title: string;
  icon: typeof Circle;
  value: string;
  detail: string;
};

type WorkflowStage = 1 | 2 | 3 | 4 | 5;
type HookSort = 'Top score' | 'Latest' | 'Saved first';
type HookTone = 'All' | 'Direct' | 'Confident' | 'Practical';
type HookStyle = 'All' | 'Problem / Solution' | 'Contrarian' | 'Insight' | 'Benefit Driven';
type HookLength = 'All' | 'Short' | 'Medium' | 'Long';
type ConceptCard = ProjectSnapshot['concepts'][number];
type BrandDemoMetadata = {
  kind?: string;
  originalName?: string;
  uploadedAt?: string;
};

type ProjectPageMode = 'workflow' | 'brand-demo' | 'hooks' | 'creator' | 'export';

type ProjectPageProps = {
  page?: ProjectPageMode;
};

const workflowSteps = [
  { index: 1, label: 'Analysis', key: 'analysis' },
  { index: 2, label: 'Brand Demo', key: 'brand-demo' },
  { index: 3, label: 'Hooks', key: 'hooks' },
  { index: 4, label: 'Creator', key: 'creator' },
  { index: 5, label: 'Export', key: 'export' },
] as const;

const toneOptions: HookTone[] = ['All', 'Direct', 'Confident', 'Practical'];
const styleOptions: HookStyle[] = ['All', 'Problem / Solution', 'Contrarian', 'Insight', 'Benefit Driven'];
const lengthOptions: HookLength[] = ['All', 'Short', 'Medium', 'Long'];
const sortOptions: HookSort[] = ['Top score', 'Latest', 'Saved first'];

const pageShellClass = 'mx-auto w-full max-w-[1440px] px-6 sm:px-8 lg:px-12';
const panelClass = 'rounded-[32px] border border-black/8 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.04)]';
const blackButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white transition duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] disabled:cursor-not-allowed disabled:opacity-50';
const whiteButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-black/20 hover:bg-[#fcfcfa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50';

function latestJob(project?: ProjectSnapshot | null, type?: GenerationJob['type']) {
  if (!project) return null;
  const jobs = type ? project.jobs.filter((job) => job.type === type) : project.jobs;
  return jobs[0] ?? null;
}

function splitPhrases(value: string) {
  return value
    .split(/[,;/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function listPreview(items: string[], fallback: string) {
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items[0]}, ${items[1]}, and ${items.length - 2} more`;
}

function brandToneChips(profile: BrandProfile) {
  const tokens = splitPhrases(profile.voice).slice(0, 3);
  return tokens.length > 0 ? tokens : splitPhrases(profile.summary).slice(0, 3);
}

function scoreAccent(score: number) {
  if (score >= 94) return 'bg-[#111111] text-white';
  if (score >= 90) return 'bg-[#ede9fe] text-[#6d28d9]';
  if (score >= 86) return 'bg-[#e0f2fe] text-[#0369a1]';
  return 'bg-[#dcfce7] text-[#15803d]';
}

function isBrandDemoAsset(asset: MediaAsset) {
  if (asset.conceptId !== null || asset.type !== 'VIDEO' || !asset.metadata || typeof asset.metadata !== 'object') {
    return false;
  }
  return (asset.metadata as BrandDemoMetadata).kind === 'brand-demo';
}

function sortConcepts(concepts: ConceptCard[], mode: HookSort, savedIds: Set<string>) {
  const items = concepts.slice();
  if (mode === 'Top score') {
    items.sort((a, b) => b.score - a.score || a.sortOrder - b.sortOrder);
    return items;
  }
  if (mode === 'Latest') {
    items.sort((a, b) => b.sortOrder - a.sortOrder);
    return items;
  }
  items.sort((a, b) => {
    const aSaved = savedIds.has(a.id) ? 1 : 0;
    const bSaved = savedIds.has(b.id) ? 1 : 0;
    if (aSaved !== bSaved) return bSaved - aSaved;
    return b.score - a.score || a.sortOrder - b.sortOrder;
  });
  return items;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 py-3 pr-10 text-sm text-[#111111] outline-none transition placeholder:text-[#999999] hover:border-black/20 focus:border-black/25 focus:ring-2 focus:ring-black/5"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c8c8c]" />
      </div>
    </label>
  );
}

export default function ProjectPage({ page = 'workflow' }: ProjectPageProps) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toneFilter, setToneFilter] = useState<HookTone>('All');
  const [styleFilter, setStyleFilter] = useState<HookStyle>('All');
  const [lengthFilter, setLengthFilter] = useState<HookLength>('All');
  const [sortMode, setSortMode] = useState<HookSort>('Top score');
  const [savedConceptIds, setSavedConceptIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const [creatorLibrary, setCreatorLibrary] = useState<CreatorRecord[]>([]);
  const [creatorLibraryLoading, setCreatorLibraryLoading] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [clipLoadFailures, setClipLoadFailures] = useState<Record<string, boolean>>({});
  const [brandDemoFile, setBrandDemoFile] = useState<File | null>(null);
  const [brandDemoDragActive, setBrandDemoDragActive] = useState(false);

  const load = useCallback(async () => {
    const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}`);
    setProject(response.project);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setError('');
    void load()
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Unable to load project'))
      .finally(() => setLoading(false));
  }, [load]);

  const brandProfile = project?.brandProfile ?? null;
  const displayStage: WorkflowStage = page === 'brand-demo' ? 2 : page === 'hooks' ? 3 : page === 'creator' ? 4 : page === 'export' ? 5 : 1;
  const currentJob = useMemo(() => latestJob(project) ?? latestJob(project, 'ANALYZE_WEBSITE'), [project]);
  const selectedConcept = useMemo(() => project?.concepts.find((concept) => concept.id === project.selectedConceptId) ?? null, [project]);
  const selectedCharacter = useMemo(() => project?.selectedCharacter ?? null, [project]);
  const selectedImage = useMemo(
    () => project?.mediaAssets.find((asset) => asset.conceptId === selectedConcept?.id && asset.type === 'IMAGE') ?? null,
    [project, selectedConcept],
  );
  const selectedVideo = useMemo(
    () => project?.mediaAssets.find((asset) => asset.conceptId === selectedConcept?.id && asset.type === 'VIDEO') ?? null,
    [project, selectedConcept],
  );
  const brandDemoAsset = useMemo(() => project?.mediaAssets.find(isBrandDemoAsset) ?? null, [project]);
  const savedConceptSet = useMemo(() => new Set(savedConceptIds), [savedConceptIds]);
  const availableCreators = useMemo<CreatorCharacter[]>(
    () => (creatorLibrary.length > 0 ? creatorLibrary.map((creator) => creator.character) : (creatorCharacters as CreatorCharacter[])),
    [creatorLibrary],
  );
  const selectedCreatorRecord = useMemo(
    () => creatorLibrary.find((creator) => creator.id === selectedCharacter?.id) ?? null,
    [creatorLibrary, selectedCharacter?.id],
  );
  const selectedCreatorClips = useMemo<CreatorClipRecord[]>(
    () => selectedCreatorRecord?.clips ?? [],
    [selectedCreatorRecord],
  );
  const displayConcepts = useMemo(() => {
    if (!project) return [] as ConceptCard[];
    const sorted = sortConcepts(project.concepts, sortMode, savedConceptSet);
    return savedOnly ? sorted.filter((concept) => savedConceptSet.has(concept.id)) : sorted;
  }, [project, savedOnly, savedConceptSet, sortMode]);

  useEffect(() => {
    let active = true;
    setCreatorLibraryLoading(true);
    void api<{ creators: CreatorRecord[] }>('/creators')
      .then((response) => {
        if (active) {
          setCreatorLibrary(response.creators.map((creator) => ({ ...creator, character: creatorToCharacter(creator) })));
        }
      })
      .catch(() => {
        if (active) {
          setCreatorLibrary([]);
        }
      })
      .finally(() => {
        if (active) {
          setCreatorLibraryLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCreatorRecord) {
      setSelectedClipId(null);
      return;
    }
    if (selectedCreatorRecord.clips.length === 0) {
      setSelectedClipId(null);
      return;
    }
    if (!selectedCreatorRecord.clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(selectedCreatorRecord.clips[0].id);
    }
  }, [selectedCreatorRecord, selectedClipId]);

  useEffect(() => {
    setClipLoadFailures({});
  }, [selectedCreatorRecord?.id]);

  const analysisCards = useMemo(() => {
    if (!brandProfile) return [] satisfies InsightCard[];
    return [
      {
        title: 'About',
        icon: Sparkles,
        value: brandProfile.brandName,
        detail: brandProfile.summary,
      },
      {
        title: 'Audience',
        icon: Target,
        value: splitPhrases(brandProfile.audience)[0] ?? brandProfile.audience,
        detail: listPreview(splitPhrases(brandProfile.audience).slice(1), 'Audience details captured from the site.'),
      },
      {
        title: 'Core problem',
        icon: Zap,
        value: brandProfile.painPoints[0] ?? 'Pain points identified',
        detail: listPreview(brandProfile.painPoints.slice(1), 'We found the main friction points on the homepage.'),
      },
      {
        title: 'Unique value',
        icon: Star,
        value: brandProfile.benefits[0] ?? brandProfile.offer,
        detail: listPreview(brandProfile.benefits.slice(1), 'This is the strongest conversion angle from the analysis.'),
      },
      {
        title: 'Brand tone',
        icon: Wand2,
        value: brandProfile.voice,
        detail: brandToneChips(brandProfile).join(' · '),
      },
    ];
  }, [brandProfile]);

  const analysisHighlights = useMemo(() => {
    if (!brandProfile) return [] as Array<{ title: string; value: string }>;
    return [
      { title: 'Main offer', value: brandProfile.offer },
      { title: 'Target audience', value: splitPhrases(brandProfile.audience)[0] ?? brandProfile.audience },
      { title: 'Pain points', value: listPreview(brandProfile.painPoints, 'Pain points captured from the website.') },
      { title: 'Key benefits', value: listPreview(brandProfile.benefits, 'Benefits extracted from the analysis.') },
      { title: 'Messaging pillars', value: listPreview(brandProfile.angles, 'Content angles are ready for hooks.') },
      { title: 'CTA', value: brandProfile.cta },
    ];
  }, [brandProfile]);

  const selectCharacter = async (character: CreatorCharacter | null) => {
    if (!project || busy) return;
    setBusy(character ? 'Selecting character' : 'Clearing character');
    setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/character`, {
        method: 'PATCH',
        body: JSON.stringify({ character }),
      });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update character');
    } finally {
      setBusy(null);
    }
  };

  const uploadBrandDemo = async () => {
    if (!project || busy || !brandDemoFile) return;
    setBusy('Uploading brand demo');
    setError('');
    try {
      const formData = new FormData();
      formData.append('demo', brandDemoFile);
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/brand-demo`, {
        method: 'POST',
        body: formData,
      });
      setProject(response.project);
      setBrandDemoFile(null);
      setBrandDemoDragActive(false);
      navigate(`/projects/${id}/demo`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload brand demo');
    } finally {
      setBusy(null);
    }
  };

  const selectBrandDemoFile = (file: File | null) => {
    if (!file) {
      setBrandDemoFile(null);
      return;
    }
    if (!file.type.startsWith('video/')) {
      setError('Upload a video file for the brand demo');
      return;
    }
    setError('');
    setBrandDemoFile(file);
  };

  const generateConcepts = async () => {
    if (!project || busy) return;
    setBusy('Generating hooks');
    setError('');
    try {
      const response = await post<ProjectResponse>(`/projects/${id}/concepts`, { count: 8, forceRegenerate: true });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate concepts');
    } finally {
      setBusy(null);
    }
  };

  const selectConcept = async (conceptId: string) => {
    if (!project || busy) return;
    setBusy('Selecting concept');
    setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/concepts/selection`, {
        method: 'PATCH',
        body: JSON.stringify({ conceptId }),
      });
      setProject(response.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to select concept');
    } finally {
      setBusy(null);
    }
  };

  const saveExport = async (nextPath?: string) => {
    if (!project || busy || !selectedConcept) return;
    setBusy('Saving export');
    setError('');
    try {
      const response = await api<{ project: ProjectSnapshot }>(`/projects/${id}/export`, {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            selectedConceptId: selectedConcept.id,
            selectedCharacterId: selectedCharacter?.id ?? null,
            selectedCharacterName: selectedCharacter?.name ?? null,
            selectedCharacterSource: selectedCharacter?.source ?? null,
            selectedCreatorClipId: selectedClipId,
            selectedImageId: selectedImage?.id ?? null,
            selectedVideoId: selectedVideo?.id ?? null,
            overlayText: selectedConcept.hookText,
            notes: selectedConcept.rationale,
          },
        }),
      });
      setProject(response.project);
      if (nextPath) {
        navigate(nextPath);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save export state');
    } finally {
      setBusy(null);
    }
  };

  const toggleSaved = (conceptId: string) => {
    setSavedConceptIds((current) =>
      current.includes(conceptId) ? current.filter((item) => item !== conceptId) : [...current, conceptId],
    );
  };

  if (loading && !project) {
    return <div className="grid min-h-screen place-items-center bg-[#fafaf8] text-[#111111]">Loading project…</div>;
  }

  if (!project) {
    return <div className="min-h-screen bg-[#fafaf8] p-8 text-[#111111]">{error || 'Project not found.'}</div>;
  }

  const websiteLabel = project.website.replace(/^https?:\/\//, '');
  const selectedImageUrl = selectedImage?.url ?? selectedConcept?.generatedImageUrl ?? '';
  const selectedVideoUrl = selectedVideo?.url ?? selectedConcept?.generatedVideoUrl ?? '';
  const hasImage = Boolean(selectedImageUrl);
  const hasVideo = Boolean(selectedVideoUrl);
  const statusMessage = error || currentJob?.progressMessage || busy || '';

  const renderHeader = () => (
    <header className="border-b border-black/6 bg-white/95 backdrop-blur-xl">
      <div className={`${pageShellClass} flex items-center justify-between gap-4 py-4`}>
        <div>
          <p className="text-[13px] font-normal uppercase tracking-[0.34em] text-[#111111]">ContentLane</p>
        </div>

        <nav className="hidden items-center gap-3 text-sm font-medium text-[#8f8f8f] md:flex">
          {workflowSteps.map((step) => {
            const active = displayStage === step.index;
            const done = displayStage > step.index;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold transition ${
                      active ? 'bg-[#111111] text-white' : done ? 'bg-[#dcfce7] text-[#15803d]' : 'border border-black/10 bg-white text-[#8f8f8f]'
                    }`}
                  >
                    {done ? <Check size={12} /> : step.index}
                  </span>
                  <span className={active ? 'text-[#111111]' : ''}>{step.label}</span>
                </div>
                {step.index < workflowSteps.length && <span className="h-px w-6 bg-black/10" />}
              </div>
            );
          })}
        </nav>

        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#111111] px-4 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          <ArrowLeft size={16} />
          Back to landing
        </button>
      </div>
    </header>
  );

  const renderAnalysisStage = () => (
    <section className={`${pageShellClass} pb-16 pt-12 lg:pb-20 lg:pt-14`}>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
          Step 1 of 5
        </div>
        <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
          We analyzed your website
        </h1>
        <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">Here&apos;s what ContentLane learned about your brand.</p>

        <div className="mx-auto mt-8 flex max-w-[430px] items-center justify-between gap-4 rounded-[24px] border border-black/8 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <div className="flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f3f3f0] text-[#111111]">
              <Globe size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Website</p>
              <p className="truncate text-sm font-semibold text-[#111111]">{websiteLabel}</p>
            </div>
          </div>
          <div className="rounded-full bg-[#dcfce7] px-4 py-2 text-sm font-medium text-[#15803d]">Analyzed</div>
        </div>
      </div>

      <div className={`${panelClass} mt-12 p-5 lg:p-6`}>
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">Brand Summary</h2>
          <p className="text-sm text-[#666666]">Key insights extracted from your website.</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {analysisCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title} className="rounded-[22px] border border-black/8 bg-[#fcfcfb] p-4 shadow-[0_8px_18px_rgba(0,0,0,0.02)]">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#f3eefc] text-[#7c3aed]">
                  <Icon size={15} />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[#111111]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#444444]">{card.value}</p>
                <p className="mt-3 text-sm leading-6 text-[#777777]">{card.detail}</p>
              </article>
            );
          })}
        </div>
      </div>

      <div className={`${panelClass} mt-4 p-5 lg:p-6`}>
        <div className="flex flex-col gap-2">
          <h2 className="text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">What ContentLane understood</h2>
          <p className="text-sm text-[#666666]">We break down your website into actionable insights to build high-converting hooks.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {analysisHighlights.map((item) => (
            <div key={item.title} className="rounded-[20px] border border-black/8 bg-[#fcfcfb] p-4">
              <div className="flex items-center gap-2 text-[#15803d]">
                <Check size={14} />
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#7a7a7a]">{item.title}</p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#444444]">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panelClass} mt-4 p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#f3eefc] text-[#8b5cf6]">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#111111]">Ready for the brand demo</p>
              <p className="mt-1 text-sm leading-6 text-[#666666]">The analysis is done. Upload a brand demo in the next step to unlock hooks.</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate(`/projects/${id}/demo`)} disabled={!brandProfile} className={blackButtonClass}>
            <ArrowRight size={16} />
            Brand demo next
          </button>
        </div>
      </div>
    </section>
  );


  const renderBrandDemoStage = () => (
    <section className={`${pageShellClass} pb-16 pt-12 lg:pb-20 lg:pt-14`}>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
          Step 2 of 5
        </div>
        <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
          Upload your brand demo
        </h1>
        <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">
          Add a short vertical demo so hook generation has a real brand reference before the next step.
        </p>
      </div>

      <div className={`${panelClass} mt-10 p-5 lg:p-6`}>
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[24px] border border-black/8 bg-[#fcfcfb] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Why it matters</p>
            <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">This upload unlocks hooks</h2>
            <p className="mt-3 text-sm leading-6 text-[#666666]">
              Use a short brand demo that shows the product, offer, or proof in motion. When you upload a new file, the project resets downstream hooks so the next ideas are built from the latest demo.
            </p>

            <div className="mt-5 space-y-3 text-sm leading-6 text-[#444444]">
              <div className="flex items-start gap-3">
                <Check size={16} className="mt-1 shrink-0 text-[#15803d]" />
                <p>Vertical video works best for the next stage.</p>
              </div>
              <div className="flex items-start gap-3">
                <Check size={16} className="mt-1 shrink-0 text-[#15803d]" />
                <p>Uploading a replacement clears old hooks, media, and export state.</p>
              </div>
              <div className="flex items-start gap-3">
                <Check size={16} className="mt-1 shrink-0 text-[#15803d]" />
                <p>After upload, the hooks stage unlocks automatically.</p>
              </div>
            </div>
          </div>

          <div
            onDragEnter={() => setBrandDemoDragActive(true)}
            onDragOver={(event) => {
              event.preventDefault();
              setBrandDemoDragActive(true);
            }}
            onDragLeave={() => setBrandDemoDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setBrandDemoDragActive(false);
              selectBrandDemoFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={`rounded-[28px] border-2 border-dashed p-5 transition ${brandDemoDragActive ? 'border-[#111111] bg-white' : 'border-black/10 bg-white'}`}
          >
            <input
              id="brand-demo-upload"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(event) => selectBrandDemoFile(event.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="brand-demo-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-black/8 bg-[#fafaf8] px-6 py-10 text-center transition hover:border-black/15 hover:bg-white"
            >
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#111111] text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)]">
                <Upload size={18} />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-[#111111]">
                {brandDemoFile ? brandDemoFile.name : 'Drop your brand demo here or choose a file'}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">
                Accepts vertical video files like MP4, MOV, or WebM, up to 50 MB.
              </p>
            </label>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setBrandDemoFile(null)}
                disabled={!brandDemoFile || !!busy}
                className={whiteButtonClass}
              >
                Clear file
              </button>
              <button
                type="button"
                onClick={() => void uploadBrandDemo()}
                disabled={!brandDemoFile || !!busy}
                className={`${blackButtonClass} flex-1`}
              >
                {busy === 'Uploading brand demo' ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={16} />}
                Upload and unlock hooks
              </button>
            </div>
          </div>
        </div>
      </div>

      {brandDemoAsset ? (
        <div className={`${panelClass} mt-4 p-5 lg:p-6`}>
          <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div className="overflow-hidden rounded-[24px] border border-black/8 bg-[#111111] shadow-[0_16px_34px_rgba(0,0,0,0.12)]">
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                src={brandDemoAsset.url}
                className="aspect-[9/16] w-full object-cover"
              />
            </div>
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Uploaded brand demo</p>
              <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">
                {typeof brandDemoAsset.metadata === "object" && brandDemoAsset.metadata && !Array.isArray(brandDemoAsset.metadata) && typeof (brandDemoAsset.metadata as BrandDemoMetadata).originalName === "string"
                  ? (brandDemoAsset.metadata as BrandDemoMetadata).originalName
                  : "Uploaded brand demo"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#666666]">
                This clip is the reference for hook generation. Use this page to review or replace it; open hooks on the next page when the demo is correct.
              </p>
              <button type="button" onClick={() => navigate(`/projects/${id}/hooks`)} className={`${blackButtonClass} mt-5`}>
                <ArrowRight size={16} />
                Open hooks page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${panelClass} mt-4 p-4 sm:p-5`}>
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#f3eefc] text-[#8b5cf6]">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-[#111111]">Next up: hooks</p>
            <p className="mt-1 text-sm leading-6 text-[#666666]">
              Once the upload succeeds, the hooks stage will appear with this demo as the reference point.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  const renderHooksStage = () => (
    <section className={`${pageShellClass} pb-16 pt-12 lg:pb-20 lg:pt-14`}>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
          Step 3 of 5
        </div>
        <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
          Generate hooks that grab attention
        </h1>
        <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">We&apos;ll create high-converting hook ideas based on your brand.</p>
      </div>

      <div className={`${panelClass} mt-10 p-4 sm:p-5`}>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))_auto] lg:items-end">
          <div className="rounded-[24px] border border-black/8 bg-[#fcfcfb] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f3eefc] text-[#8b5cf6]">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111111]">Generate new hooks</p>
                <p className="mt-1 text-sm leading-6 text-[#666666]">Get fresh hook ideas</p>
              </div>
            </div>
          </div>

          <SelectField label="Tone" value={toneFilter} options={toneOptions} onChange={(value) => setToneFilter(value as HookTone)} />
          <SelectField label="Style" value={styleFilter} options={styleOptions} onChange={(value) => setStyleFilter(value as HookStyle)} />
          <SelectField label="Length" value={lengthFilter} options={lengthOptions} onChange={(value) => setLengthFilter(value as HookLength)} />

          <button onClick={() => void generateConcepts()} disabled={!brandDemoAsset || !!busy} className={blackButtonClass}>
            {busy === 'Generating hooks' ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
            Generate
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 text-sm text-[#666666]">
        <p className="font-medium text-[#111111]">{displayConcepts.length} hooks generated</p>
        <div className="flex items-center gap-3">
          <label className="hidden items-center gap-2 text-[#666666] sm:flex">
            <span>Sort by</span>
            <div className="relative">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as HookSort)}
                className="appearance-none rounded-full border border-black/8 bg-white px-3.5 py-2 pr-9 text-sm text-[#111111] outline-none transition hover:border-black/15 focus:border-black/20"
              >
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c8c8c]" />
            </div>
          </label>
          <button
            type="button"
            onClick={() => setSavedOnly((current) => !current)}
            className={`${whiteButtonClass} ${savedOnly ? 'border-[#111111] bg-[#111111] text-white hover:border-[#111111] hover:bg-[#111111]' : ''}`}
          >
            <Bookmark size={15} fill={savedOnly ? 'currentColor' : 'none'} />
            Saved
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {displayConcepts.map((concept) => {
          const selected = project.selectedConceptId === concept.id;
          const saved = savedConceptSet.has(concept.id);
          return (
            <div
              key={concept.id}
              role="button"
              tabIndex={0}
              onClick={() => void selectConcept(concept.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  void selectConcept(concept.id);
                }
              }}
              className={`group flex min-h-[19rem] cursor-pointer flex-col rounded-[24px] border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] ${
                selected
                  ? 'border-[#111111] bg-white shadow-[0_16px_38px_rgba(0,0,0,0.08)]'
                  : 'border-black/8 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_18px_36px_rgba(0,0,0,0.06)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${scoreAccent(concept.score)}`}>
                  {concept.score}
                  <span className="font-medium opacity-70">{concept.scoreLabel}</span>
                </span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleSaved(concept.id);
                  }}
                  className="text-[#8c8c8c] transition hover:text-[#111111]"
                  aria-label={saved ? 'Remove from saved concepts' : 'Save concept'}
                >
                  <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>

              <p className="mt-4 text-[1.04rem] font-semibold leading-[1.16] tracking-[-0.04em] text-[#111111]">
                {concept.hookText}
              </p>

              <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[#9a9a9a]">{concept.angle}</p>

              <div className="mt-auto pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void selectConcept(concept.id);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 font-medium text-[#111111] transition hover:border-black/20 hover:bg-[#fcfcfa]"
                  >
                    <Play size={13} />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSaved(concept.id);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 font-medium text-[#111111] transition hover:border-black/20 hover:bg-[#fcfcfa]"
                  >
                    <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
                    Save
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[#8f8f8f]">
                  <span>{concept.targetDurationLabel}</span>
                  <span>{selected ? 'Selected' : 'Tap to select'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!displayConcepts.length && (
        <div className="mt-4 rounded-[24px] border border-dashed border-black/10 bg-white p-5 text-sm leading-6 text-[#666666]">
          Generate hooks to populate the grid. Each concept can be selected, saved, and carried into media generation.
        </div>
      )}

      <div className={`${panelClass} mt-8 p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-[#f3eefc] text-[#8b5cf6]">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-[#111111]">Looks good?</p>
              <p className="mt-1 text-sm leading-6 text-[#666666]">Pick the hook, then move into creator selection and media generation.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/projects/${id}/creator`)}
            disabled={!project.selectedConceptId}
            className={blackButtonClass}
          >
            <ArrowRight size={16} />
            Continue to creator selection
          </button>
        </div>
      </div>
    </section>
  );

  const renderMediaStage = () => {
    const activeCreatorClips = selectedCreatorClips;

    return (
      <section className={`${pageShellClass} pb-16 pt-12 lg:pb-20 lg:pt-14`}>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
            Step 4 of 5
          </div>
          <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
            Choose a creator
          </h1>
          <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">Pick a creator for the project, then choose one of that creator&apos;s clips.</p>
        </div>

        <div className={`${panelClass} mt-10 p-5 lg:p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Creator library</p>
              <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">
                {creatorLibraryLoading ? 'Loading creators' : `${availableCreators.length} creators available`}
              </h2>
            </div>
            <div className="rounded-full bg-[#111111] px-3 py-1.5 text-sm font-medium text-white">
              {selectedCharacter ? 'Selected' : 'Choose one'}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableCreators.map((character) => {
              const active = selectedCharacter?.id === character.id;
              return (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => void selectCharacter(character)}
                  disabled={!!busy}
                  className={`rounded-[24px] border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] ${
                    active
                      ? 'border-[#111111] bg-white shadow-[0_16px_38px_rgba(0,0,0,0.08)]'
                      : 'border-black/8 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_18px_36px_rgba(0,0,0,0.06)]'
                  }`}
                >
                  {/* Full image card */}
                  <div className="relative aspect-[2/3] bg-[#f3f3f0] overflow-hidden">
                    {character.baseImageUrl ? (
                      <img src={character.baseImageUrl} alt={character.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-[#999]">
                        <Sparkles size={24} />
                      </div>
                    )}
                    
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#000000]/80 via-[#000000]/40 to-transparent" />
                    
                    {/* Text overlay with blur background */}
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-[13px] font-bold text-white">{character.name}</h3>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/80">Creator</p>
                      
                      {character.clipTags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {character.clipTags.slice(0, 2).map((tag) => (
                            <span key={tag} className="rounded-full bg-white/20 backdrop-blur-sm px-2 py-0.5 text-[8px] font-medium text-white">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    
                    {/* Selected badge */}
                    {active && (
                      <div className="absolute top-3 right-3 rounded-full bg-[#111111]/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white">
                        ✓ Selected
                      </div>
                    )}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded-[24px] border border-dashed border-black/12 bg-[#fcfcfb] p-4 text-left opacity-80 shadow-[0_10px_24px_rgba(0,0,0,0.02)]"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-black/10 bg-white text-[#111111]">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[#111111]">Add your own character</p>
                      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#9a9a9a]">Not wired up yet</p>
                    </div>
                    <span className="rounded-full bg-[#f3f3f0] px-2.5 py-1 text-[11px] font-semibold text-[#666666]">Coming soon</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#444444]">This slot is visible now so the flow can point to a custom creator path later.</p>
                  <p className="mt-3 text-sm leading-6 text-[#666666]">For now, it does nothing when clicked.</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {selectedCreatorRecord ? (
          <div className={`${panelClass} mt-5 p-5 lg:p-6`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Selected creator</p>
                <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">{selectedCreatorRecord.name}</h2>
                <p className="mt-2 text-sm leading-6 text-[#666666]">{selectedCreatorRecord.description ?? 'Creator library profile.'}</p>
              </div>
              <div className="rounded-full bg-[#dcfce7] px-3 py-2 text-sm font-medium text-[#15803d]">
                {activeCreatorClips.length} clips available
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-black/8 bg-[#fcfcfb] p-4 lg:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Clip picker</p>
                  <h3 className="mt-2 text-[1.15rem] font-bold tracking-[-0.03em] text-[#111111]">Portrait clips play inline in each card</h3>
                  <p className="mt-2 text-sm leading-6 text-[#666666]">Every clip autoplay loops silently inside its own card. The selected card stays highlighted for reference.</p>
                </div>
                <div className="rounded-full bg-[#111111] px-3 py-1.5 text-sm font-medium text-white">
                  {activeCreatorClips.length} clips available
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {activeCreatorClips.length > 0 ? (
                  activeCreatorClips.map((clip) => {
                    const active = selectedClipId === clip.id;
                    const title = clip.title?.trim() || 'Untitled clip';
                    const tagPreview = clip.tags.slice(0, 3);
                    const clipFailed = clipLoadFailures[clip.id] ?? false;
                    return (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => setSelectedClipId(clip.id)}
                        className={`group overflow-hidden rounded-[24px] border text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf8] ${
                          active
                            ? 'border-[#111111] bg-white shadow-[0_16px_38px_rgba(0,0,0,0.08)]'
                            : 'border-black/8 bg-white shadow-[0_10px_24px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 hover:border-black/15 hover:shadow-[0_18px_36px_rgba(0,0,0,0.06)]'
                        }`}
                      >
                        <div className="relative bg-[#111111]">
                          {clipFailed ? (
                            <div className="grid aspect-[9/16] place-items-center px-5 text-center">
                              <div>
                                <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Preview unavailable</p>
                                <p className="mt-2 text-sm font-medium text-white">This clip could not be loaded.</p>
                              </div>
                            </div>
                          ) : (
                            <video
                              autoPlay
                              muted
                              loop
                              playsInline
                              preload="metadata"
                              src={clip.url}
                              className="pointer-events-none aspect-[9/16] w-full object-cover"
                              onError={() => setClipLoadFailures((current) => ({ ...current, [clip.id]: true }))}
                            />
                          )}
                          <div className="pointer-events-none absolute left-3 top-3">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${active ? 'bg-[#111111] text-white' : 'bg-white/90 text-[#111111]'}`}>
                              {active ? 'Selected' : 'Preview'}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#111111]">{title}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#9a9a9a]">{clip.provider}</p>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-[#666666]">{clip.mimeType ?? 'Portrait media clip'}</p>
                          {tagPreview.length ? (
                            <div className="flex flex-wrap gap-2">
                              {tagPreview.map((tag) => (
                                <span key={tag} className="rounded-full bg-[#f4efe7] px-2.5 py-1 text-[11px] font-medium text-[#7a4d20]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[20px] border border-dashed border-black/10 bg-white p-4 text-sm leading-6 text-[#666666] sm:col-span-2 xl:col-span-3">
                    This creator does not have any clips yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div className={`${panelClass} mt-5 p-4 sm:p-5`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-[#dcfce7] text-[#15803d]">
                <Check size={18} />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#111111]">Ready to render</p>
                <p className="mt-1 text-sm leading-6 text-[#666666]">The selected creator clip will render first with text, then the uploaded brand demo will render second with its own text.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveExport(`/projects/${id}/render`)}
              disabled={!project.selectedConceptId || !selectedCharacter || !selectedClipId || !!busy}
              className={blackButtonClass}
            >
              <ArrowRight size={16} />
              Continue to render
            </button>
          </div>
        </div>
      </section>
    );
  };

  const renderExportStage = () => (
    <section className={`${pageShellClass} pb-16 pt-12 lg:pb-20 lg:pt-14`}>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#111111]" />
          Step 5 of 5
        </div>
        <h1 className="mx-auto mt-7 max-w-[14ch] text-[clamp(3rem,6vw,5.2rem)] font-black leading-[0.94] tracking-[-0.07em] text-[#111111]">
          Export
        </h1>
        <p className="mt-4 text-[1.05rem] text-[#666666] sm:text-[1.12rem]">Minimal, focused, and ready to download.</p>
      </div>

      <div className={`${panelClass} mt-10 p-5 lg:p-6`}>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#8c8c8c]">Export</p>
        <h2 className="mt-2 text-[1.35rem] font-bold tracking-[-0.04em] text-[#111111]">Save the selected concept and assets</h2>
        <p className="mt-2 text-sm leading-6 text-[#666666]">This final step stores the concept id plus the generated image and video references in the project snapshot.</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[24px] border border-black/8 bg-[#fcfcfb] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#a39a90]">Selected concept</p>
            <p className="mt-2 text-sm font-semibold text-[#111111]">{selectedConcept?.hookText ?? 'No concept selected yet'}</p>
            <p className="mt-2 text-sm leading-6 text-[#666666]">{selectedConcept?.rationale ?? 'Select a concept to unlock media generation and export.'}</p>
          </div>
          <div className="rounded-[24px] border border-black/8 bg-[#fcfcfb] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#a39a90]">Selected creator</p>
            <p className="mt-2 text-sm font-semibold text-[#111111]">{selectedCharacter?.name ?? 'No creator selected yet'}</p>
            <p className="mt-2 text-sm leading-6 text-[#666666]">{selectedCharacter?.persona ?? 'Pick a creator before generating preview media.'}</p>
          </div>
          <div className="rounded-[24px] border border-black/8 bg-[#fcfcfb] p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#a39a90]">Asset references</p>
            <div className="mt-2 space-y-2 text-sm text-[#666666]">
              <p>Image: {hasImage ? 'available' : 'pending'}</p>
              <p>Video: {hasVideo ? 'available' : 'pending'}</p>
            </div>
          </div>
        </div>

        <button onClick={() => void saveExport()} disabled={!selectedConcept || !!busy} className={`${blackButtonClass} mt-5 w-full`}>
          {busy === 'Saving export' ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={16} />}
          Save export state
        </button>
      </div>
    </section>
  );

  return (
    <main className="min-h-screen bg-[#fafaf8] text-[#111111]">
      {renderHeader()}
      {page === 'brand-demo'
        ? renderBrandDemoStage()
        : page === 'hooks'
          ? renderHooksStage()
          : page === 'creator'
            ? renderMediaStage()
            : page === 'export'
              ? renderExportStage()
              : renderAnalysisStage()}
      {statusMessage ? (
        <div className={`${pageShellClass} pb-10`}>
          <div className="rounded-[24px] border border-black/8 bg-white px-4 py-3 text-sm text-[#666666] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <span className="font-medium text-[#111111]">Status:</span> {statusMessage}
          </div>
        </div>
      ) : null}
    </main>
  );
}
