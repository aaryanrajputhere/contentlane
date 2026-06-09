import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  Img,
  spring,
  useVideoConfig,
  useCurrentFrame,
} from 'remotion';
import { Video } from '@remotion/media';
import { Audio } from '@remotion/media';

// ── Types (mirroring video-renderer) ──
interface Scene {
  characterId: string;
  characterName: string;
  text: string;
  audioUrl: string;
  start: number;
  duration: number;
  imageUrl: string;
}

interface ScriptData {
  sessionId: string;
  totalDuration: number;
  scenes: Scene[];
  bgVideoUrl: string;
  subtitleFontSize?: number;
  subtitleY?: number;
  subtitleX?: number;
  subtitleActiveColor?: string;
  subtitleInactiveColor?: string;
  characterX?: number;
  characterY?: number;
  characterScale?: number;
  bgObjectFit?: 'cover' | 'contain';
  videoSpeed?: number;
  isEditorPreview?: boolean;
  layout?: 'classic' | 'split' | 'stacked' | 'pip' | 'debate' | 'solo';
  characters?: { id: string; name: string; imageUrl: string }[];
  customLayoutStyles?: Record<string, { x: number, y: number, scale: number }>;
}

// ── Asset resolver (uses proxy URLs for the Player) ──
const resolveAsset = (url: string): string => {
  if (url.startsWith('http')) return url;
  // URLs like /public/voiceovers/... are proxied to the backend
  return url;
};

// ── Main Composition ──
export const PlayerComposition: React.FC<ScriptData> = ({ 
  scenes, 
  bgVideoUrl, 
  subtitleFontSize = 90,
  subtitleY = 50,
  subtitleX = 50,
  subtitleActiveColor = '#FFDE00',
  subtitleInactiveColor = '#FFFFFF',
  characterX = 5,
  characterY = 2,
  characterScale = 40,
  bgObjectFit = 'cover',
  videoSpeed = 1,
  isEditorPreview = false,
  layout = 'classic',
  characters = [],
  customLayoutStyles = {}
}) => {
  const { fps } = useVideoConfig();

  // Extract unique characters from scenes if not explicitly provided
  const activeCharacters = characters.length > 0 
    ? characters 
    : Array.from(new Map(scenes.map(s => [s.characterId, { id: s.characterId, name: s.characterName, imageUrl: s.imageUrl }])).values());

  return (
    <AbsoluteFill style={{ backgroundColor: 'black' }}>
      {/* Background Video - Looping */}
      <AbsoluteFill>
        {isEditorPreview ? (
          <video
            src={resolveAsset(bgVideoUrl)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: bgObjectFit,
            }}
            loop
            muted
            autoPlay
            playsInline
          />
        ) : (
          <Video
            src={resolveAsset(bgVideoUrl)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: bgObjectFit,
            }}
            loop
            muted
            playbackRate={videoSpeed}
          />
        )}
      </AbsoluteFill>

      {/* Characters Layer */}
      <CharactersLayer 
        scenes={scenes}
        characters={activeCharacters}
        layout={layout}
        charX={characterX}
        charY={characterY}
        charScale={characterScale}
        videoSpeed={videoSpeed}
        fps={fps}
        customLayoutStyles={customLayoutStyles}
        isEditorPreview={isEditorPreview}
      />

      {/* Scenes (Subtitles & Audio) */}
      {scenes.map((scene, index) => {
        const startFrame = Math.round((scene.start / videoSpeed) * fps);
        const durationFrames = Math.round((scene.duration / videoSpeed) * fps);

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <SceneContent 
              scene={scene} 
              fps={fps} 
              fontSize={subtitleFontSize} 
              y={subtitleY}
              x={subtitleX}
              activeColor={subtitleActiveColor}
              inactiveColor={subtitleInactiveColor}
              videoSpeed={videoSpeed}
              isEditorPreview={isEditorPreview}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Characters Layer ──
const CharactersLayer: React.FC<{
  scenes: Scene[];
  characters: { id: string; name: string; imageUrl: string }[];
  layout: string;
  charX: number;
  charY: number;
  charScale: number;
  videoSpeed: number;
  fps: number;
  customLayoutStyles: Record<string, { x: number, y: number, scale: number }>;
  isEditorPreview: boolean;
}> = ({ scenes, characters, layout, charX, charY, charScale, videoSpeed, fps, customLayoutStyles, isEditorPreview }) => {
  const frame = useCurrentFrame();

  // Find active scene
  const activeScene = scenes.find(s => {
    const startFrame = Math.round((s.start / videoSpeed) * fps);
    const durationFrames = Math.round((s.duration / videoSpeed) * fps);
    return frame >= startFrame && frame < startFrame + durationFrames;
  });

  const speakingCharacterId = activeScene?.characterId;
  const activeSceneStartFrame = activeScene ? Math.round((activeScene.start / videoSpeed) * fps) : 0;
  const framesSinceSpeakStart = frame - activeSceneStartFrame;

  // Spring animation for speaking character (small pop)
  const speakSpring = spring({
    frame: framesSinceSpeakStart,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const getLayoutTransform = (index: number, isSpeaking: boolean) => {
    let x = charX;
    let y = charY;
    let scale = charScale;

    if (layout === 'solo') {
      x = 10; y = 0; scale = 80;
    } else if (layout === 'split') {
      x = index === 0 ? 5 : 50; y = 30; scale = 45;
    } else if (layout === 'stacked') {
      x = 25; y = index === 0 ? 50 : 5; scale = 45;
    } else if (layout === 'pip') {
      x = index === 0 ? 10 : 65; y = index === 0 ? 5 : 70; scale = index === 0 ? 75 : 25;
    } else if (layout === 'debate') {
      x = index === 0 ? -10 : 40; y = -5; scale = 60;
    }

    // Apply custom overrides if they exist
    const charId = characters[index]?.id;
    if (charId && customLayoutStyles[charId]) {
      x = customLayoutStyles[charId].x;
      y = customLayoutStyles[charId].y;
      scale = customLayoutStyles[charId].scale;
    }

    // Apply speaking pop animation (1.0 to 1.05 scale) only in actual render
    const animationScale = (isSpeaking && !isEditorPreview) ? 1 + (speakSpring * 0.05) : 1;
    
    // Slight dimming for non-speaking character in multi-speaker layouts
    const opacity = (!isSpeaking && layout !== 'classic' && layout !== 'solo') ? 0.7 : 1;

    return { x, y, scale: scale * animationScale, opacity };
  };

  // In editor preview, characters are rendered by the ghost overlay in App.tsx
  // so we skip rendering here to avoid dual-render desync during dragging
  if (isEditorPreview) return null;

  // For single-speaker layouts, only show the speaking character (or first character if none speaking)
  if (layout === 'classic' || layout === 'solo') {
    const charToRender = characters.find(c => c.id === speakingCharacterId) || characters[0];
    if (!charToRender) return null;

    const transform = getLayoutTransform(0, true);
    return (
      <AbsoluteFill>
        <div 
          style={{
            position: 'absolute',
            bottom: `${transform.y}%`,
            left: `${transform.x}%`,
            height: `${transform.scale}%`,
            opacity: transform.opacity,
            transformOrigin: 'bottom left',
            transition: 'opacity 0.2s',
          }}
        >
          <Img src={resolveAsset(charToRender.imageUrl)} style={{ height: '100%', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }} />
        </div>
      </AbsoluteFill>
    );
  }

  // For multi-speaker layouts, show up to 2 characters simultaneously
  return (
    <AbsoluteFill>
      {characters.slice(0, 2).map((char, index) => {
        const isSpeaking = char.id === speakingCharacterId;
        const transform = getLayoutTransform(index, isSpeaking);
        
        return (
          <div 
            key={char.id}
            style={{
              position: 'absolute',
              bottom: `${transform.y}%`,
              left: `${transform.x}%`,
              height: `${transform.scale}%`,
              opacity: transform.opacity,
              transformOrigin: 'bottom left',
              transition: 'opacity 0.2s',
              zIndex: isSpeaking ? 10 : 1, // Bring speaker to front
            }}
          >
            <Img src={resolveAsset(char.imageUrl)} style={{ height: '100%', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))' }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ── Scene Content ──
const WORDS_PER_CHUNK = 4;

const SceneContent: React.FC<{ 
  scene: Scene; 
  fps: number; 
  fontSize: number;
  y: number;
  x: number;
  activeColor: string;
  inactiveColor: string;
  videoSpeed: number;
  isEditorPreview: boolean;
}> = ({ 
  scene, fps, fontSize, y, x, activeColor, inactiveColor,
  videoSpeed, isEditorPreview
}) => {
  const frame = useCurrentFrame();

  // Strip bracketed text like [excited]
  const cleanedText = scene.text.replace(/\[.*?\]/g, '').trim();
  const words = cleanedText.split(/\s+/).filter(Boolean);
  const totalFrames = (scene.duration / videoSpeed) * fps;

  // Determine which word is currently being spoken
  const activeWordIndex = Math.min(
    Math.floor((frame / totalFrames) * words.length),
    words.length - 1,
  );

  // Build chunks of WORDS_PER_CHUNK words
  const chunks: string[][] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
    chunks.push(words.slice(i, i + WORDS_PER_CHUNK));
  }

  // Which chunk is currently visible
  const activeChunkIndex = Math.floor(activeWordIndex / WORDS_PER_CHUNK);
  const currentChunk = chunks[activeChunkIndex] ?? [];
  const activeIndexInChunk = activeWordIndex - activeChunkIndex * WORDS_PER_CHUNK;

  return (
    <AbsoluteFill>
      {/* Subtitles — Custom X & Y position */}
      <div 
        style={{
          position: 'absolute',
          top: `${y}%`,
          left: `${x}%`,
          transform: 'translate(-50%, -50%)',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          key={activeChunkIndex}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '12px',
            padding: '0 40px',
          }}
        >
          {currentChunk.map((word, i) => {
            const isActive = i === activeIndexInChunk;
            return (
              <span
                key={`${activeChunkIndex}-${i}`}
                style={{
                  color: isActive ? activeColor : inactiveColor,
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.2',
                  fontWeight: '900',
                  textAlign: 'center',
                  textShadow:
                    '4px 4px 0px #000, -2px -2px 0px #000, 2px -2px 0px #000, -2px 2px 0px #000',
                  textTransform: 'uppercase',
                  fontFamily: 'Impact, sans-serif',
                  display: 'inline-block',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {/* Audio */}
      {!isEditorPreview && <Audio src={resolveAsset(scene.audioUrl)} playbackRate={videoSpeed} />}
    </AbsoluteFill>
  );
};
