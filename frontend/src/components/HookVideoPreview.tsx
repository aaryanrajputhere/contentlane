import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { getCaptionStyle } from '../lib/captionStyle';
import type { ConceptCard, CreatorClipRecord, CreatorRecord } from '../types/domain';

export type HookVideoPreviewProps = {
  concept: ConceptCard;
  creator?: CreatorRecord;
  clip: CreatorClipRecord | null;
  videoSourceOverride?: string;
  compact?: boolean;
  className?: string;
  bottomMetadata?: ReactNode;
  bottomAction?: ReactNode;
};

export default function HookVideoPreview({
  concept,
  creator,
  clip,
  videoSourceOverride,
  compact = false,
  className = '',
  bottomMetadata,
  bottomAction,
}: HookVideoPreviewProps) {
  const videoSource = videoSourceOverride ?? concept.generatedVideoUrl ?? clip?.url;
  const usesSnapchatCaptions = getCaptionStyle(concept.sortOrder) === 'SNAPCHAT';

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#111] text-white ${compact ? 'rounded-[22px]' : 'rounded-[28px]'} ${className}`}>
      {videoSource ? (
        <video
          src={videoSource}
          className="absolute inset-0 h-full w-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-[#252525] px-6 text-center text-sm font-semibold text-white/60">
          Creator preview unavailable
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

      <div className={`absolute z-10 flex items-start justify-between ${compact ? 'inset-x-3 top-3 gap-1.5' : 'inset-x-5 top-5 gap-3'}`}>
        <div className={`flex min-w-0 items-center bg-black/60 font-bold text-white shadow-sm backdrop-blur ${compact ? 'gap-1.5 rounded-full px-2 py-1 text-[10px]' : 'gap-2 rounded-full px-3 py-2 text-xs'}`}>
          {creator?.baseImageUrl ? (
            <img src={creator.baseImageUrl} alt="" className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 rounded-full object-cover`} />
          ) : (
            <span className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 rounded-full bg-white/20`} />
          )}
          <span className="truncate">{creator?.name ?? 'Creator'}</span>
        </div>
        <div className={`flex shrink-0 items-center bg-[#dcfce7] font-black text-[#15803d] shadow-sm ${compact ? 'gap-1 rounded-full px-2 py-1 text-[10px]' : 'gap-1.5 rounded-full px-3 py-2 text-xs'}`}>
          <Sparkles size={compact ? 10 : 12} />
          {concept.score} Score
        </div>
      </div>

      <div className={`absolute top-1/2 z-10 w-full -translate-y-1/2 text-center ${usesSnapchatCaptions ? `inset-x-0 bg-black/60 ${compact ? 'px-3 py-1.5' : 'px-5 py-1.5'}` : compact ? 'inset-x-0 px-3' : 'inset-x-0 px-6'}`}>
        <p className={`break-words text-white ${usesSnapchatCaptions ? `${compact ? 'text-[0.7rem]' : 'text-[0.875rem]'} font-medium leading-[1.25]` : `${compact ? 'text-[0.78rem] sm:text-sm' : 'text-base'} font-extrabold leading-[1.12] [paint-order:stroke_fill] [-webkit-text-stroke:2px_rgba(0,0,0,0.92)] drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]`}`}>
          {concept.hookText}
        </p>
      </div>

      {bottomMetadata || bottomAction ? (
        <div className={`absolute z-20 flex items-end justify-between gap-3 ${compact ? 'inset-x-3 bottom-3' : 'inset-x-4 bottom-4'}`}>
          <div className="min-w-0 flex-1">{bottomMetadata}</div>
          {bottomAction}
        </div>
      ) : null}
    </div>
  );
}
