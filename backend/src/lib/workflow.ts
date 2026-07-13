import { type Project, Prisma } from "@prisma/client";
import OpenAI from "openai";
import prisma from "./prisma";
import type {
  BrandProfile,
  ConceptCard,
  CreatorCharacter,
  ExportState,
  MediaAsset,
  ProjectSnapshot,
  WebsiteAnalysis,
  WebsiteAnalysisHomepage,
} from "../domain/schemas";

export type ConceptBlueprint = Pick<
  ConceptCard,
  | "angle"
  | "hookText"
  | "hookImagePrompt"
  | "demoOverlayText"
  | "videoDirection"
  | "targetDurationLabel"
  | "targetDurationSeconds"
  | "score"
  | "scoreLabel"
  | "rationale"
  | "generatedImageUrl"
  | "generatedVideoUrl"
  | "sortOrder"
>;

export const projectSnapshotInclude = {
  brandProfile: true,
  websiteAnalysis: true,
  concepts: { orderBy: { sortOrder: "asc" } },
  mediaAssets: { orderBy: { createdAt: "asc" } },
  exportState: true,
  jobs: { orderBy: { createdAt: "desc" }, take: 20 },
} satisfies Prisma.ProjectInclude;

const videoSources = [
  "/assets/landing/demo1.mp4",
  "/assets/landing/demo2.mp4",
  "/assets/landing/demo3.mp4",
  "/assets/landing/demovid.mp4",
];

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const titleCase = (value: string) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const stripScheme = (value: string) =>
  value.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function readTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toHomepageEvidence(
  value: unknown,
  sourceUrl: string,
  rootDomain: string,
): WebsiteAnalysisHomepage {
  const record =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const fallbackText = `Homepage for ${rootDomain}`;
  const visibleTextSnippet =
    readTrimmedString(record.visibleTextSnippet) ?? fallbackText;
  return {
    url: readTrimmedString(record.url) ?? sourceUrl,
    title: readTrimmedString(record.title),
    metaDescription: readTrimmedString(record.metaDescription),
    visibleTextSnippet,
    extractedTextSnippet: readTrimmedString(record.extractedTextSnippet),
    canonicalUrl: readTrimmedString(record.canonicalUrl),
    extractionStatus:
      record.extractionStatus === "success" ||
      record.extractionStatus === "failed"
        ? record.extractionStatus
        : undefined,
    extractionSource:
      record.extractionSource === "firecrawl" ||
      record.extractionSource === "fallback"
        ? record.extractionSource
        : undefined,
    extractionError: readTrimmedString(record.extractionError),
  };
}

function normalizeWebsiteAnalysisRecord(
  value: unknown,
): WebsiteAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sourceUrl = readTrimmedString(record.sourceUrl) ?? null;
  const rootDomain =
    readTrimmedString(record.rootDomain) ??
    (sourceUrl ? new URL(sourceUrl).host.replace(/^www\./i, "") : "unknown");
  const homepageSource = (() => {
    const homepage = record.homepage;
    if (homepage && typeof homepage === "object") return homepage;
    const selectedPages = Array.isArray(record.selectedPages)
      ? record.selectedPages
      : null;
    if (
      selectedPages &&
      selectedPages.length > 0 &&
      typeof selectedPages[0] === "object" &&
      selectedPages[0] !== null
    )
      return selectedPages[0];
    const rankedPages = Array.isArray(record.rankedPages)
      ? record.rankedPages
      : null;
    if (
      rankedPages &&
      rankedPages.length > 0 &&
      typeof rankedPages[0] === "object" &&
      rankedPages[0] !== null
    )
      return rankedPages[0];
    return record;
  })();
  const normalizedSourceUrl = sourceUrl ?? `https://${rootDomain}`;
  return {
    id: typeof record.id === "string" ? record.id : "",
    projectId: typeof record.projectId === "string" ? record.projectId : "",
    sourceUrl: normalizedSourceUrl,
    rootDomain,
    homepage: toHomepageEvidence(
      homepageSource,
      normalizedSourceUrl,
      rootDomain,
    ),
    createdAt:
      record.createdAt instanceof Date
        ? record.createdAt
        : new Date(String(record.createdAt ?? Date.now())),
    updatedAt:
      record.updatedAt instanceof Date
        ? record.updatedAt
        : new Date(String(record.updatedAt ?? Date.now())),
  };
}

export function buildWebsiteAnalysisStorageData(
  analysis: Pick<WebsiteAnalysis, "sourceUrl" | "rootDomain" | "homepage"> & { sourceContentFingerprint?: string },
) {
  const homepage = {
    url: analysis.homepage.url,
    title: analysis.homepage.title ?? null,
    metaDescription: analysis.homepage.metaDescription ?? null,
    visibleTextSnippet: analysis.homepage.visibleTextSnippet,
    pageTypeHint: "homepage",
    crawlDepth: 0,
    canonicalUrl: analysis.homepage.canonicalUrl ?? null,
    score: 100,
    scoreReason: "Homepage is the only evidence source",
    ...(analysis.homepage.extractionStatus
      ? { extractionStatus: analysis.homepage.extractionStatus }
      : {}),
    ...(analysis.homepage.extractionSource
      ? { extractionSource: analysis.homepage.extractionSource }
      : {}),
    ...(analysis.homepage.extractionError
      ? { extractionError: analysis.homepage.extractionError }
      : {}),
    ...(analysis.homepage.extractedTextSnippet
      ? { extractedTextSnippet: analysis.homepage.extractedTextSnippet }
      : {}),
  };
  return {
    sourceUrl: analysis.sourceUrl,
    rootDomain: analysis.rootDomain,
    discoveredUrls: [analysis.homepage.url],
    rankedPages: [homepage],
    selectedPages: [homepage],
    crawlSummary: {
      rootUrl: analysis.sourceUrl,
      rootDomain: analysis.rootDomain,
      discoveredCount: 1,
      rankedCount: 1,
      selectedCount: 1,
      extractedCount: analysis.homepage.extractionStatus === "failed" ? 0 : 1,
      failedCount: analysis.homepage.extractionStatus === "failed" ? 1 : 0,
      lowSignalFilteredCount: 0,
      ...(analysis.sourceContentFingerprint
        ? { sourceContentFingerprint: analysis.sourceContentFingerprint }
        : {}),
    },
  };
}

function scoreLabel(score: number) {
  if (score >= 94) return "Top rank";
  if (score >= 90) return "High rank";
  if (score >= 86) return "Strong rank";
  return "Solid rank";
}

function clampScore(index: number) {
  return Math.max(82, 97 - index * 2);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function conceptDescriptor(profile: BrandProfile, index: number) {
  const angle =
    profile.conversationStarters[index % profile.conversationStarters.length] ?? `Angle ${index + 1}`;
  const painPoint =
    profile.realThoughts[index % profile.realThoughts.length] ??
    profile.realThoughts[0] ??
    "the main problem";
  const benefit =
    profile.proofPoints[index % profile.proofPoints.length] ??
    profile.proofPoints[0] ??
    "the key benefit";
  return { angle, painPoint, benefit };
}

function isBrandDemoAsset(asset: {
  conceptId: string | null;
  type: string;
  metadata: Prisma.JsonValue | null;
}) {
  if (
    asset.conceptId !== null ||
    asset.type !== "VIDEO" ||
    !asset.metadata ||
    typeof asset.metadata !== "object"
  ) {
    return false;
  }
  return (asset.metadata as Record<string, unknown>).kind === "brand-demo";
}

function describeCharacter(
  character?: Pick<
    CreatorCharacter,
    | "id"
    | "source"
    | "name"
    | "persona"
    | "appearance"
    | "voice"
    | "prompt"
    | "baseImageUrl"
    | "clipCount"
    | "clipTags"
  > | null,
) {
  if (!character) {
    return "Character: a premium creator with a clean camera-ready presence.";
  }
  const parts = [
    `Character: ${character.name}.`,
    `Persona: ${character.persona}.`,
    `Appearance: ${character.appearance}.`,
    `Voice: ${character.voice}.`,
    `Prompt note: ${character.prompt}.`,
    character.baseImageUrl ? `Base image: ${character.baseImageUrl}.` : null,
    character.clipTags?.length
      ? `Clip tags: ${character.clipTags.slice(0, 6).join(", ")}.`
      : null,
    typeof character.clipCount === "number"
      ? `Clip count: ${character.clipCount}.`
      : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export function normalizeWebsiteInput(website: string) {
  const trimmed = website.trim();
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const parsed = new URL(candidate);
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.protocol}//${parsed.host}${normalizedPath === "/" ? "" : normalizedPath}`.toLowerCase();
}

export function buildBrandProfile(
  website: string,
): Omit<BrandProfile, "id" | "projectId" | "createdAt" | "updatedAt"> {
  const normalized = normalizeWebsiteInput(website);
  const host = stripScheme(normalized).split("/")[0];
  const base = titleCase(host.replace(/^www\./, "").split(".")[0] || "brand");
  const brandName = base || "Brand";
  const audience = `${brandName} visitors who want a faster way to understand the offer`;
  return {
    brandName,
    product: brandName,
    audience,
    audienceIdentity: "Founders and Marketers",
    audienceStage: "Problem aware",
    emotionalDrivers: ["Need for speed", "Desire for high conversion"],
    fears: ["Wasting time on bad creatives", "Spending money on ads that don't convert"],
    realThoughts: ["I spend too much time editing videos", "Why isn't this automated yet?"],
    dailyMoments: ["Staring at a blank Premiere Pro timeline", "Trying to think of a good hook"],
    dreamOutcomes: ["Publishing high quality ads without effort", "Getting back hours of time"],
    misconceptions: ["AI video looks fake", "It's too hard to use"],
    objections: ["AI video looks fake", "Too expensive"],
    proofPoints: ["Generates in seconds"],
    socialProofMoments: ["When they see the final ad quality", "When they realize it took 10 seconds"],
    transformation: "From blank page to ready-to-publish UGC ad",
    uniqueMechanism: "URL-to-video AI pipeline",
    conversationStarters: [
      `I used to hate making ads for ${brandName}...`,
      `Here's how ${brandName} is changing the game.`,
      `Stop wasting time on generic content.`,
      `I finally found a way to automate my hooks.`
    ],
    viralTriggers: ["Speed", "Automation"],
    emotionalLanguage: ["shocked", "effortless", "instant"],
    forbiddenClaims: ["Guaranteed virality"],
    ugcScenarios: ["Reacting to generation speed", "Showing before and after"],
    testimonials: ["This saved me 10 hours a week."],
    cta: "Generate the next ad",
    summary: `${brandName} positions the website as the source of truth and turns it into a content pipeline without a separate admin layer.`,
  };
}

function buildHookImagePrompt(
  profile: BrandProfile,
  hookText: string,
  angle: string,
  benefit: string,
  painPoint: string,
) {
  return [
    `Create a cinematic vertical 9:16 marketing image for ${profile.brandName}.`,
    `The image should support the hook: "${hookText}".`,
    `Visual direction: ${angle}.`,
    `Show the benefit: ${benefit}.`,
    `Avoid generic stock-photo energy. Make it crisp, brand-specific, and scroll-stopping.`,
    `Reference the pain point: ${painPoint}.`,
    `No watermark, no mock social UI, no extra logos.`,
  ].join(" ");
}

function buildDemoOverlayText(
  profile: BrandProfile,
  benefit: string,
  index: number,
) {
  const overlays = [
    `${profile.brandName} in 4 seconds`,
    benefit,
    `Watch the ${profile.brandName} difference`,
    `From site to ad, fast`,
    `Proof that actually ships`,
    `Built for the next scroll`,
  ];
  return overlays[index % overlays.length];
}

function buildVideoDirection(
  profile: BrandProfile,
  hookText: string,
  overlayText: string,
  angle: string,
) {
  return [
    `Create a 4-5 second demo video for ${profile.brandName}.`,
    `Open with the hook overlay: ${hookText}.`,
    `Transition into a product demo that feels immediate and tangible.`,
    `Use the overlay text: ${overlayText}.`,
    `Keep the motion minimal, clean, and premium.`,
    `The visual angle is ${angle}.`,
  ].join(" ");
}

function brandOrProductName(profile: BrandProfile) {
  return profile.brandName.trim() || profile.product.trim();
}

export function buildConceptCards(
  profile: BrandProfile,
  count: number,
): Array<ConceptBlueprint> {
  return Array.from({ length: count }, (_, index) => {
    const { angle, painPoint, benefit } = conceptDescriptor(profile, index);
    const brandName = brandOrProductName(profile);
    const productCategory = profile.product.toLowerCase();
    const hookText = [
      `how to actually use ${brandName} without overthinking it`,
      `they kept this ${productCategory} SECRET from us 💀`,
      `i didn't know ${brandName} could fix this in minutes`,
      `wait... ${brandName} does the hard part??`,
      `i wasted way too long before trying ${brandName}`,
      `this ${productCategory} shortcut is actually unfair`,
      `the ${brandName} workflow i wish i found sooner`,
      `${brandName} made ${benefit.toLowerCase()} way less painful`,
    ][index % 8];
    const score = clampScore(index);
    const demoOverlayText = buildDemoOverlayText(profile, benefit, index);
    const hookImagePrompt = buildHookImagePrompt(
      profile,
      hookText,
      angle,
      benefit,
      painPoint,
    );
    const videoDirection = buildVideoDirection(
      profile,
      hookText,
      demoOverlayText,
      angle,
    );
    return {
      angle,
      hookText,
      hookImagePrompt,
      demoOverlayText,
      videoDirection,
      targetDurationLabel: "4-5s",
      targetDurationSeconds: 5,
      score,
      scoreLabel: scoreLabel(score),
      rationale: `Angle: ${angle}. Benefit: ${benefit}.`,
      generatedImageUrl: null,
      generatedVideoUrl: null,
      sortOrder: index,
    };
  });
}

export function buildConceptImagePrompt(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    "hookText" | "hookImagePrompt" | "demoOverlayText"
  >,
) {
  return [
    `Brand: ${profile.brandName}`,
    `Hook: ${concept.hookText}`,
    `Overlay: ${concept.demoOverlayText}`,
    `Prompt: ${concept.hookImagePrompt}`,
  ].join("\n");
}

export function buildConceptVideoPrompt(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    | "hookText"
    | "demoOverlayText"
    | "videoDirection"
    | "targetDurationLabel"
    | "targetDurationSeconds"
  >,
) {
  return {
    prompt: [
      `Brand: ${profile.brandName}`,
      `Hook: ${concept.hookText}`,
      `Overlay: ${concept.demoOverlayText}`,
      `Direction: ${concept.videoDirection}`,
      `Duration target: ${concept.targetDurationLabel} (${concept.targetDurationSeconds} seconds)`,
    ].join("\n"),
    durationSeconds: concept.targetDurationSeconds,
  };
}

function renderConceptPosterDataUrl(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    "hookText" | "demoOverlayText" | "scoreLabel" | "score"
  >,
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#08111f" />
          <stop offset="55%" stop-color="#0f1727" />
          <stop offset="100%" stop-color="#f97316" stop-opacity="0.92" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="32%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" rx="72" />
      <circle cx="980" cy="220" r="180" fill="white" fill-opacity="0.08" />
      <circle cx="260" cy="1320" r="240" fill="white" fill-opacity="0.06" />
      <rect x="90" y="110" width="260" height="48" rx="24" fill="white" fill-opacity="0.12" />
      <text x="114" y="144" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">${escapeXml(profile.brandName)}</text>
      <text x="96" y="260" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" letter-spacing="0.14em">${escapeXml(concept.scoreLabel)}</text>
      <text x="96" y="400" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="800">${escapeXml(concept.hookText)}</text>
      <text x="96" y="550" fill="white" fill-opacity="0.84" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="500">${escapeXml(concept.demoOverlayText)}</text>
      <rect x="96" y="670" width="500" height="10" rx="5" fill="white" fill-opacity="0.85" />
      <text x="96" y="790" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Concept score ${concept.score}</text>
      <text x="96" y="850" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Hook image prompt</text>
      <text x="96" y="910" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Demo overlay text</text>
      <text x="96" y="970" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">4-5 second demo</text>
      <rect x="840" y="1140" width="260" height="260" rx="34" fill="url(#glow)" />
    </svg>
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function generateConceptImage(
  profile: BrandProfile,
  concept: ConceptCard,
) {
  const prompt = buildConceptImagePrompt(profile, concept);
  if (openai) {
    try {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1536",
      });
      const image = response.data?.[0];
      if (image?.b64_json) {
        return {
          provider: "openai",
          providerId: null,
          url: `data:image/png;base64,${image.b64_json}`,
          mimeType: "image/png",
        };
      }
    } catch {
      // Fall back to a deterministic local composition when the provider is unavailable.
    }
  }
  return {
    provider: "svg-composition",
    providerId: null,
    url: renderConceptPosterDataUrl(profile, concept),
    mimeType: "image/svg+xml",
  };
}

async function generateConceptVideo(
  profile: BrandProfile,
  concept: ConceptCard,
  index: number,
) {
  const prompt = buildConceptVideoPrompt(profile, concept);
  if (process.env.CONCEPT_VIDEO_SERVICE_URL) {
    try {
      const response = await fetch(process.env.CONCEPT_VIDEO_SERVICE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.prompt,
          durationSeconds: prompt.durationSeconds,
          conceptId: concept.id,
          brandName: profile.brandName,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          url?: string;
          videoUrl?: string;
          secureUrl?: string;
          providerId?: string;
        };
        const url = data.url ?? data.videoUrl ?? data.secureUrl;
        if (url) {
          return {
            provider: "concept-video-service",
            providerId: data.providerId ?? null,
            url,
            mimeType: "video/mp4",
          };
        }
      }
    } catch {
      // Fall back to the curated local demo asset.
    }
  }
  const videoUrl = videoSources[index % videoSources.length];
  return {
    provider: "demo-asset",
    providerId: videoUrl,
    url: videoUrl,
    mimeType: "video/mp4",
  };
}

function buildImageAsset(
  project: Pick<Project, "id">,
  concept: ConceptCard,
  image: Awaited<ReturnType<typeof generateConceptImage>>,
) {
  return {
    projectId: project.id,
    conceptId: concept.id,
    type: "IMAGE" as const,
    provider: image.provider,
    providerId: image.providerId,
    url: image.url,
    mimeType: image.mimeType,
    metadata: { hookText: concept.hookText, prompt: concept.hookImagePrompt },
  };
}

function buildVideoAsset(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  video: Awaited<ReturnType<typeof generateConceptVideo>>,
) {
  return {
    projectId: project.id,
    conceptId: concept.id,
    type: "VIDEO" as const,
    provider: video.provider,
    providerId: video.providerId,
    url: video.url,
    mimeType: video.mimeType,
    metadata: {
      hookText: concept.hookText,
      direction: concept.videoDirection,
      durationSeconds: concept.targetDurationSeconds,
      prompt: promptSummary(profile, concept),
    },
  };
}

export async function generateImageAssetForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
) {
  const image = await generateConceptImage(profile, concept);
  return buildImageAsset(project, concept, image);
}

export async function generateVideoAssetForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  index = 0,
) {
  const video = await generateConceptVideo(profile, concept, index);
  return buildVideoAsset(project, profile, concept, video);
}

export function buildMediaAssets(
  project: Pick<Project, "id">,
  concepts: ConceptCard[],
): Array<Omit<MediaAsset, "id" | "createdAt">> {
  return concepts.flatMap((concept, index) => {
    const imageUrl =
      concept.generatedImageUrl ??
      renderConceptPosterDataUrl(
        {
          brandName: "ContentLane",
          product: "",
          audience: "",
          audienceIdentity: "",
          audienceStage: "",
          emotionalDrivers: [""],
          fears: [""],
          realThoughts: [""],
          dailyMoments: [""],
          dreamOutcomes: [""],
          misconceptions: [""],
          objections: [""],
          proofPoints: [""],
          socialProofMoments: [""],
          transformation: "",
          uniqueMechanism: "",
          conversationStarters: [""],
          viralTriggers: [""],
          emotionalLanguage: [""],
          forbiddenClaims: [""],
          ugcScenarios: [""],
          testimonials: [""],
          cta: "",
          summary: "",
        } as BrandProfile,
        concept,
      );
    const videoUrl =
      concept.generatedVideoUrl ?? videoSources[index % videoSources.length];
    return [
      {
        projectId: project.id,
        conceptId: concept.id,
        type: "IMAGE",
        provider: concept.generatedImageUrl ? "persisted" : "svg-composition",
        providerId: null,
        url: imageUrl,
        mimeType: imageUrl.startsWith("data:image/png")
          ? "image/png"
          : "image/svg+xml",
        metadata: {
          hookText: concept.hookText,
          prompt: concept.hookImagePrompt,
        },
      },
      {
        projectId: project.id,
        conceptId: concept.id,
        type: "VIDEO",
        provider: concept.generatedVideoUrl ? "persisted" : "demo-asset",
        providerId: videoUrl,
        url: videoUrl,
        mimeType: "video/mp4",
        metadata: {
          hookText: concept.hookText,
          direction: concept.videoDirection,
          durationSeconds: concept.targetDurationSeconds,
        },
      },
    ];
  });
}

export async function generateMediaForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  index = 0,
) {
  const image = await generateConceptImage(profile, concept);
  const video = await generateConceptVideo(profile, concept, index);
  return [
    {
      projectId: project.id,
      conceptId: concept.id,
      type: "IMAGE",
      provider: image.provider,
      providerId: image.providerId,
      url: image.url,
      mimeType: image.mimeType,
      metadata: { hookText: concept.hookText, prompt: concept.hookImagePrompt },
    },
    {
      projectId: project.id,
      conceptId: concept.id,
      type: "VIDEO",
      provider: video.provider,
      providerId: video.providerId,
      url: video.url,
      mimeType: video.mimeType,
      metadata: {
        hookText: concept.hookText,
        direction: concept.videoDirection,
        durationSeconds: concept.targetDurationSeconds,
        prompt: promptSummary(profile, concept),
      },
    },
  ] as const;
}

function promptSummary(profile: BrandProfile, concept: ConceptCard) {
  return buildConceptVideoPrompt(profile, concept).prompt;
}

export function buildExportState(
  project: Project,
  concept?: Pick<ConceptCard, "id" | "hookText" | "demoOverlayText"> | null,
  character?: Pick<CreatorCharacter, "id" | "source" | "name"> | null,
  selectedImageId?: string | null,
  selectedVideoId?: string | null,
): ExportState {
  return {
    selectedConceptId: concept?.id ?? null,
    selectedCharacterId: character?.id ?? null,
    selectedCharacterName: character?.name ?? null,
    selectedCharacterSource: character?.source ?? null,
    selectedCreatorClipId: null,
    selectedImageId: selectedImageId ?? null,
    selectedVideoId: selectedVideoId ?? null,
    creatorOverlayText: concept?.hookText ?? "",
    brandDemoOverlayText: concept?.demoOverlayText ?? "",
    overlayText: concept?.hookText ?? `Publish ${project.website}`,
    notes: concept
      ? `Lean export preset for ${concept.hookText}`
      : `Lean export preset for ${project.website}`,
  };
}

export async function loadProjectSnapshot(projectId: string, userId?: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...(userId ? { userId } : {}) },
    include: projectSnapshotInclude,
  });
  if (!project) return null;
  return {
    ...project,
    websiteAnalysis: normalizeWebsiteAnalysisRecord(project.websiteAnalysis),
  };
}

export async function clearGeneratedContent(projectId: string) {
  const project = await loadProjectSnapshot(projectId);
  const preserveIds =
    project?.mediaAssets.filter(isBrandDemoAsset).map((asset) => asset.id) ??
    [];
  const mediaDelete =
    preserveIds.length > 0
      ? prisma.mediaAsset.deleteMany({
          where: { projectId, NOT: { id: { in: preserveIds } } },
        })
      : prisma.mediaAsset.deleteMany({ where: { projectId } });
  await prisma.$transaction([
    mediaDelete,
    prisma.hookConcept.deleteMany({ where: { projectId } }),
    prisma.projectExport.deleteMany({ where: { projectId } }),
    prisma.websiteAnalysis.deleteMany({ where: { projectId } }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        selectedConceptId: null,
        selectedCharacterId: null,
        selectedCharacter: Prisma.JsonNull,
      },
    }),
  ]);
}

export function buildCharacterImagePrompt(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    "hookText" | "hookImagePrompt" | "demoOverlayText" | "videoDirection"
  >,
  character: Pick<
    CreatorCharacter,
    | "id"
    | "source"
    | "name"
    | "persona"
    | "appearance"
    | "voice"
    | "prompt"
    | "baseImageUrl"
    | "clipCount"
    | "clipTags"
  >,
) {
  return [
    `Brand: ${profile.brandName}`,
    `Hook: ${concept.hookText}`,
    `Overlay: ${concept.demoOverlayText}`,
    `Character: ${describeCharacter(character)}`,
    `Hook image prompt: ${concept.hookImagePrompt}`,
    `Keep the composition editorial, polished, and creator-led.`,
  ].join(" ");
}

export function buildCharacterVideoPrompt(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    | "hookText"
    | "demoOverlayText"
    | "videoDirection"
    | "targetDurationLabel"
    | "targetDurationSeconds"
  >,
  character: Pick<
    CreatorCharacter,
    | "id"
    | "source"
    | "name"
    | "persona"
    | "appearance"
    | "voice"
    | "prompt"
    | "baseImageUrl"
    | "clipCount"
    | "clipTags"
  >,
) {
  return {
    prompt: [
      `Brand: ${profile.brandName}`,
      `Hook: ${concept.hookText}`,
      `Overlay: ${concept.demoOverlayText}`,
      `Direction: ${concept.videoDirection}`,
      `Character: ${describeCharacter(character)}`,
      `Duration target: ${concept.targetDurationLabel} (${concept.targetDurationSeconds} seconds)`,
    ].join("\n"),
    durationSeconds: concept.targetDurationSeconds,
  };
}

function renderCharacterPosterDataUrl(
  profile: BrandProfile,
  concept: Pick<
    ConceptCard,
    "hookText" | "demoOverlayText" | "scoreLabel" | "score"
  >,
  character: Pick<CreatorCharacter, "name" | "persona" | "appearance">,
) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#08111f" />
          <stop offset="55%" stop-color="#0f1727" />
          <stop offset="100%" stop-color="#f97316" stop-opacity="0.92" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="32%" r="60%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="1600" fill="url(#bg)" rx="72" />
      <circle cx="980" cy="220" r="180" fill="white" fill-opacity="0.08" />
      <circle cx="260" cy="1320" r="240" fill="white" fill-opacity="0.06" />
      <rect x="90" y="110" width="260" height="48" rx="24" fill="white" fill-opacity="0.12" />
      <text x="114" y="144" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700">${escapeXml(profile.brandName)}</text>
      <text x="96" y="260" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" letter-spacing="0.14em">${escapeXml(concept.scoreLabel)}</text>
      <text x="96" y="360" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700">${escapeXml(character.name)}</text>
      <text x="96" y="420" fill="white" fill-opacity="0.78" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="500">${escapeXml(character.persona)}</text>
      <text x="96" y="480" fill="white" fill-opacity="0.72" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="500">${escapeXml(character.appearance)}</text>
      <text x="96" y="620" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="800">${escapeXml(concept.hookText)}</text>
      <text x="96" y="770" fill="white" fill-opacity="0.84" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="500">${escapeXml(concept.demoOverlayText)}</text>
      <rect x="96" y="890" width="500" height="10" rx="5" fill="white" fill-opacity="0.85" />
      <text x="96" y="1010" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Concept score ${concept.score}</text>
      <text x="96" y="1070" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Hook image prompt</text>
      <text x="96" y="1130" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">Demo overlay text</text>
      <text x="96" y="1190" fill="white" fill-opacity="0.82" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="500">4-5 second demo</text>
      <rect x="840" y="1140" width="260" height="260" rx="34" fill="url(#glow)" />
    </svg>
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function generateCharacterImage(
  profile: BrandProfile,
  concept: ConceptCard,
  character: Pick<
    CreatorCharacter,
    | "id"
    | "source"
    | "name"
    | "persona"
    | "appearance"
    | "voice"
    | "prompt"
    | "baseImageUrl"
    | "clipCount"
    | "clipTags"
  >,
) {
  const prompt = buildCharacterImagePrompt(profile, concept, character);
  if (openai) {
    try {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt,
        size: "1024x1536",
      });
      const image = response.data?.[0];
      if (image?.b64_json) {
        return {
          provider: "openai",
          providerId: null,
          url: `data:image/png;base64,${image.b64_json}`,
          mimeType: "image/png",
        };
      }
    } catch {
      // Fall back to a deterministic local composition when the provider is unavailable.
    }
  }
  return {
    provider: "svg-composition",
    providerId: null,
    url: renderCharacterPosterDataUrl(profile, concept, character),
    mimeType: "image/svg+xml",
  };
}

async function generateCharacterVideo(
  profile: BrandProfile,
  concept: ConceptCard,
  character: Pick<
    CreatorCharacter,
    | "id"
    | "source"
    | "name"
    | "persona"
    | "appearance"
    | "voice"
    | "prompt"
    | "baseImageUrl"
    | "clipCount"
    | "clipTags"
  >,
  index: number,
) {
  const prompt = buildCharacterVideoPrompt(profile, concept, character);
  if (process.env.CONCEPT_VIDEO_SERVICE_URL) {
    try {
      const response = await fetch(process.env.CONCEPT_VIDEO_SERVICE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.prompt,
          durationSeconds: prompt.durationSeconds,
          conceptId: concept.id,
          brandName: profile.brandName,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          url?: string;
          videoUrl?: string;
          secureUrl?: string;
          providerId?: string;
        };
        const url = data.url ?? data.videoUrl ?? data.secureUrl;
        if (url) {
          return {
            provider: "concept-video-service",
            providerId: data.providerId ?? null,
            url,
            mimeType: "video/mp4",
          };
        }
      }
    } catch {
      // Fall back to the curated local demo asset.
    }
  }
  const videoUrl = videoSources[index % videoSources.length];
  return {
    provider: "demo-asset",
    providerId: videoUrl,
    url: videoUrl,
    mimeType: "video/mp4",
  };
}

export async function generateCharacterImageAssetForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  character: Pick<
    CreatorCharacter,
    "id" | "source" | "name" | "persona" | "appearance" | "voice" | "prompt"
  >,
) {
  const image = await generateCharacterImage(profile, concept, character);
  return {
    projectId: project.id,
    conceptId: concept.id,
    type: "IMAGE" as const,
    provider: image.provider,
    providerId: image.providerId,
    url: image.url,
    mimeType: image.mimeType,
    metadata: {
      hookText: concept.hookText,
      prompt: concept.hookImagePrompt,
      characterId: character.id,
      characterName: character.name,
      characterSource: character.source,
    },
  };
}

export async function generateCharacterVideoAssetForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  character: Pick<
    CreatorCharacter,
    "id" | "source" | "name" | "persona" | "appearance" | "voice" | "prompt"
  >,
  index = 0,
) {
  const video = await generateCharacterVideo(
    profile,
    concept,
    character,
    index,
  );
  return {
    projectId: project.id,
    conceptId: concept.id,
    type: "VIDEO" as const,
    provider: video.provider,
    providerId: video.providerId,
    url: video.url,
    mimeType: video.mimeType,
    metadata: {
      hookText: concept.hookText,
      direction: concept.videoDirection,
      durationSeconds: concept.targetDurationSeconds,
      prompt: buildCharacterVideoPrompt(profile, concept, character).prompt,
      characterId: character.id,
      characterName: character.name,
      characterSource: character.source,
    },
  };
}

export async function generateCharacterMediaForConcept(
  project: Pick<Project, "id">,
  profile: BrandProfile,
  concept: ConceptCard,
  character: Pick<
    CreatorCharacter,
    "id" | "source" | "name" | "persona" | "appearance" | "voice" | "prompt"
  >,
  index = 0,
) {
  const image = await generateCharacterImage(profile, concept, character);
  const video = await generateCharacterVideo(
    profile,
    concept,
    character,
    index,
  );
  return [
    {
      projectId: project.id,
      conceptId: concept.id,
      type: "IMAGE" as const,
      provider: image.provider,
      providerId: image.providerId,
      url: image.url,
      mimeType: image.mimeType,
      metadata: {
        hookText: concept.hookText,
        prompt: concept.hookImagePrompt,
        characterId: character.id,
        characterName: character.name,
        characterSource: character.source,
      },
    },
    {
      projectId: project.id,
      conceptId: concept.id,
      type: "VIDEO" as const,
      provider: video.provider,
      providerId: video.providerId,
      url: video.url,
      mimeType: video.mimeType,
      metadata: {
        hookText: concept.hookText,
        direction: concept.videoDirection,
        durationSeconds: concept.targetDurationSeconds,
        prompt: buildCharacterVideoPrompt(profile, concept, character).prompt,
        characterId: character.id,
        characterName: character.name,
        characterSource: character.source,
      },
    },
  ] as const;
}
