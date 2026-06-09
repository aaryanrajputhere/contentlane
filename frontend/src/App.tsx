import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import StepCharacters from './components/StepCharacters';
import StepScript from './components/StepScript';
import StepRender from './components/StepRender';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import ProjectsPage from './components/ProjectsPage';
import StudioHub from './components/StudioHub';
import { Player } from '@remotion/player';
import { PlayerComposition } from './components/PlayerComposition';
import type { Script, VoiceoverResult, Character, Project, VideoStyle } from './types';
import BrandProfile from './components/BrandProfile';
import HookStrategy from './components/HookStrategy';
import ScriptReview from './components/ScriptReview';
import { ChevronLeft } from 'lucide-react';
import { Header } from './components/Header';

const FPS = 24;

// ── Memoized Sub-Components for Performance ──

const EditorSections = memo(({ 
  characters, selectedCharacterIds, toggleCharacter, 
  script, setScript, setVoiceoverResult, 
  voiceoverResult, videoUrl, setVideoUrl,
  styles, sessionId
}: any) => (
  <div className="max-w-4xl mx-auto px-8 py-12 space-y-16">
    <StepCharacters
      characters={characters}
      selectedIds={selectedCharacterIds}
      onToggle={toggleCharacter}
      onNext={() => {}}
    />

    {selectedCharacterIds.length >= 1 && (
      <StepScript
        selectedCharacters={characters.filter((c: any) => selectedCharacterIds.includes(c.id))}
        script={script}
        onScriptGenerated={(s: any) => { setScript(s); setVoiceoverResult(null); }}
        onDialogueUpdate={(d: any) => script && setScript({ ...script, dialogue: d })}
        voiceoverResult={voiceoverResult}
        onVoiceoverResultUpdate={setVoiceoverResult}
        sessionId={sessionId}
        onNext={() => {}} 
        onBack={() => {}}
      />
    )}

    {script && (
      voiceoverResult ? (
        <StepRender
            voiceoverResult={voiceoverResult}
            videoUrl={videoUrl}
            onVideoRendered={setVideoUrl}
            onClearRender={() => setVideoUrl(null)}
            onBack={() => {}}
            styles={styles}
            characters={selectedCharacterIds.map((id: string) => characters.find((c: any) => c.id === id)).filter(Boolean)}
            customLayoutStyles={styles.customLayoutStyles}
        />
      ) : (
        <div className="bg-[#050505] border border-zinc-900 border-dashed rounded-3xl p-12 text-center opacity-50 grayscale transition-all">
           <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-600">🔒</div>
           <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-2">Export Locked</h3>
           <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-bold">Generate all voiceovers in the script section to unlock export</p>
        </div>
      )
    )}
    <div className="h-20" />
  </div>
));

// ── Helper: get JWT ──
const getToken = () => localStorage.getItem('reelswarm-jwt') || localStorage.getItem('brainrot-jwt') || '';

// Helpers for base positions
const getBaseX = (layoutMode: string, index: number) => {
  if (layoutMode === 'solo') return 10;
  if (layoutMode === 'split') return index === 0 ? 5 : 50;
  if (layoutMode === 'stacked') return 25;
  if (layoutMode === 'pip') return index === 0 ? 10 : 65;
  if (layoutMode === 'debate') return index === 0 ? -10 : 40;
  return 5;
};
const getBaseY = (layoutMode: string, index: number) => {
  if (layoutMode === 'solo') return 0;
  if (layoutMode === 'split') return 30;
  if (layoutMode === 'stacked') return index === 0 ? 50 : 5;
  if (layoutMode === 'pip') return index === 0 ? 5 : 70;
  if (layoutMode === 'debate') return -5;
  return 2;
};
const getBaseScale = (layoutMode: string, index: number) => {
  if (layoutMode === 'solo') return 80;
  if (layoutMode === 'split') return 45;
  if (layoutMode === 'stacked') return 45;
  if (layoutMode === 'pip') return index === 0 ? 75 : 25;
  if (layoutMode === 'debate') return 60;
  return 40;
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/editor');

  const [user, setUser] = useState<any>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeStyle, setActiveStyle] = useState<VideoStyle>('product-hook');

  // ── Restore session from localStorage on mount ──
  useEffect(() => {
    let token = localStorage.getItem('reelswarm-jwt');
    let storedUser = localStorage.getItem('reelswarm-user');
    
    if (!token && !storedUser) {
      token = localStorage.getItem('brainrot-jwt');
      storedUser = localStorage.getItem('brainrot-user');
      if (token && storedUser) {
        localStorage.setItem('reelswarm-jwt', token);
        localStorage.setItem('reelswarm-user', storedUser);
      }
    }

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        const currentPath = window.location.pathname;
        if (currentPath === '/auth') {
          navigate('/hub', { replace: true });
        }
      } catch { /* ignore corrupt data */ }
    }
  }, [navigate]);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [script, setScript] = useState<Script | null>(null);
  const [voiceoverResult, setVoiceoverResult] = useState<VoiceoverResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => Date.now().toString());

  const [subtitleFontSize, setSubtitleFontSize] = useState(90);
  const [subtitleX, setSubtitleX] = useState(50);
  const [subtitleY, setSubtitleY] = useState(50);
  const [activeColor, setActiveColor] = useState('#FFDE00');
  const [inactiveColor, setInactiveColor] = useState('#FFFFFF');
  const [characterX, setCharacterX] = useState(5);
  const [characterY, setCharacterY] = useState(2);
  const [characterScale, setCharacterScale] = useState(40);
  const [bgVideoUrl, setBgVideoUrl] = useState<string>('/public/assets/subway_surfer.mp4');
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'classic' | 'split' | 'stacked' | 'pip' | 'debate' | 'solo'>('classic');
  const [customLayoutStyles, setCustomLayoutStyles] = useState<Record<string, {x: number, y: number, scale: number}>>({});

  const previewRef = useRef<HTMLDivElement>(null);
  const actorGhostRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const subtitleGhostRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const requestRef = useRef<number | null>(null);
  const dragTarget = useRef<string>('subtitles');

  // ── Load characters once ──
  useEffect(() => {
    fetch('/api/characters')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setCharacters(data))
      .catch((e) => console.error('Failed to load characters:', e));
  }, []);

  // ── Load project state into editor ──
  const loadProjectState = useCallback((project: Project) => {
    setActiveProject(project);
    const s = project.state as any || {};
    setSelectedCharacterIds(s.selectedCharacterIds || []);
    setScript(s.script || null);
    setVoiceoverResult(s.voiceoverResult || null);
    setVideoUrl(null); // blob URLs don't persist
    setSessionId(s.sessionId || Date.now().toString());
    setSubtitleFontSize(s.subtitleFontSize ?? 90);
    setSubtitleX(s.subtitleX ?? 50);
    setSubtitleY(s.subtitleY ?? 50);
    setActiveColor(s.activeColor ?? '#FFDE00');
    setInactiveColor(s.inactiveColor ?? '#FFFFFF');
    setCharacterX(s.characterX ?? 5);
    setCharacterY(s.characterY ?? 2);
    setCharacterScale(s.characterScale ?? 40);
    setBgVideoUrl(s.bgVideoUrl ?? '/public/assets/subway_surfer.mp4');
    setVideoSpeed(s.videoSpeed ?? 1);
    setLayoutMode(s.layoutMode ?? 'classic');
    setCustomLayoutStyles(s.customLayoutStyles || {});
    navigate('/editor');
  }, [navigate]);

  // ── Auto-save project state to backend (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeProject || !isEditor) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      const state = {
        selectedCharacterIds, script, voiceoverResult, sessionId,
        subtitleFontSize, subtitleX, subtitleY, activeColor, inactiveColor,
        characterX, characterY, characterScale, bgVideoUrl, videoSpeed, layoutMode, customLayoutStyles
      };

      try {
        await fetch(`/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ state }),
        });
      } catch (e) {
        console.error('Auto-save failed:', e);
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    activeProject, isEditor,
    selectedCharacterIds, script, voiceoverResult, sessionId,
    subtitleFontSize, subtitleX, subtitleY, activeColor, inactiveColor,
    characterX, characterY, characterScale, bgVideoUrl, videoSpeed, layoutMode, customLayoutStyles
  ]);

  const toggleCharacter = useCallback((id: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('reelswarm-jwt');
    localStorage.removeItem('reelswarm-user');
    localStorage.removeItem('brainrot-jwt');
    localStorage.removeItem('brainrot-user');
    setUser(null);
    setActiveProject(null);
    navigate('/');
  }, [navigate]);

  const handleBackToProjects = useCallback(() => {
    setActiveProject(null);
    setVideoUrl(null);
    navigate('/projects');
  }, [navigate]);

  // ── Refs to mirror state for stable drag handler (no re-creation during drag) ──
  const layoutModeRef = useRef(layoutMode);
  layoutModeRef.current = layoutMode;
  const customLayoutStylesRef = useRef(customLayoutStyles);
  customLayoutStylesRef.current = customLayoutStyles;
  const selectedCharacterIdsRef = useRef(selectedCharacterIds);
  selectedCharacterIdsRef.current = selectedCharacterIds;
  const characterYRef = useRef(characterY);
  characterYRef.current = characterY;
  const subtitleYRef = useRef(subtitleY);
  subtitleYRef.current = subtitleY;

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInteraction = useCallback((e: any) => {
    if (!previewRef.current) return;
    e.preventDefault();

    const rect = previewRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * 100;
    const yTop = ((clientY - rect.top) / rect.height) * 100;
    const yBottom = 100 - yTop;

    // Read from refs (always fresh, no stale closures)
    const lm = layoutModeRef.current;
    const cls = customLayoutStylesRef.current;
    const charIds = selectedCharacterIdsRef.current;

    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    requestRef.current = requestAnimationFrame(() => {
        if (dragTarget.current === 'subtitles') {
            const newX = Math.max(0, Math.min(100, x - dragOffset.current.x));
            const newY = Math.max(0, Math.min(100, yTop - dragOffset.current.y));
            // Move ghost box instantly via DOM
            if (subtitleGhostRef.current) {
                subtitleGhostRef.current.style.left = `${newX}%`;
                subtitleGhostRef.current.style.top = `${newY}%`;
            }
            setSubtitleX(newX);
            setSubtitleY(newY);
        } else if (dragTarget.current.startsWith('characters:')) {
            const charId = dragTarget.current.split(':')[1];
            const i = charIds.indexOf(charId);
            const newX = Math.max(-50, Math.min(150, x - dragOffset.current.x));
            const newY = Math.max(-50, Math.min(150, yBottom - dragOffset.current.y));
            
            // Move ghost box instantly via DOM
            const ghostNode = actorGhostRefs.current[charId];
            if (ghostNode) {
                ghostNode.style.left = `${newX}%`;
                ghostNode.style.bottom = `${newY}%`;
            }
            if (lm === 'classic') {
                setCharacterX(newX);
                setCharacterY(newY);
            } else {
                setCustomLayoutStyles(prev => {
                    const current = prev[charId] || { x: getBaseX(lm, i), y: getBaseY(lm, i), scale: getBaseScale(lm, i) };
                    return { ...prev, [charId]: { ...current, x: newX, y: newY } };
                });
            }
        } else if (dragTarget.current.startsWith('scale:')) {
            const charId = dragTarget.current.split(':')[1];
            const i = charIds.indexOf(charId);
            let yPos = characterYRef.current;
            if (lm === 'solo') { yPos = 0; }
            else if (lm === 'split') { yPos = 30; }
            else if (lm === 'stacked') { yPos = i === 0 ? 50 : 5; }
            else if (lm === 'pip') { yPos = i === 0 ? 5 : 70; }
            else if (lm === 'debate') { yPos = -5; }
            if (cls[charId]) { yPos = cls[charId].y; }

            const newScale = Math.max(10, Math.min(100, 100 - yTop - yPos));
            // Move ghost box instantly via DOM
            const ghostNode = actorGhostRefs.current[charId];
            if (ghostNode) {
                ghostNode.style.height = `${newScale}%`;
            }
            if (lm === 'classic') {
                setCharacterScale(newScale);
            } else {
                setCustomLayoutStyles(prev => {
                    const current = prev[charId] || { x: getBaseX(lm, i), y: yPos, scale: getBaseScale(lm, i) };
                    return { ...prev, [charId]: { ...current, scale: newScale } };
                });
            }
        } else if (dragTarget.current === 'subtitle-scale') {
            const newFontSize = Math.abs(subtitleYRef.current - yTop) * 12.8;
            setSubtitleFontSize(Math.max(40, Math.min(160, Math.round(newFontSize))));
        }
    });
  }, []); // ← Empty deps! Handler is 100% stable, reads from refs

  // ── Global Drag Listeners ──
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleInteraction);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleInteraction, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleInteraction);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleInteraction);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleInteraction, handleMouseUp]);

  const durationInFrames = voiceoverResult ? Math.max(1, Math.ceil((voiceoverResult.totalDuration / videoSpeed) * FPS)) : 100;
  const inputProps = voiceoverResult ? {
    sessionId: voiceoverResult.sessionId,
    totalDuration: voiceoverResult.totalDuration,
    scenes: voiceoverResult.scenes,
    bgVideoUrl: bgVideoUrl || voiceoverResult.bgVideoUrl,
    subtitleFontSize, subtitleY, subtitleX,
    subtitleActiveColor: activeColor, subtitleInactiveColor: inactiveColor,
    characterX, characterY, characterScale, bgObjectFit: 'cover' as const,
    videoSpeed,
    layout: layoutMode,
    characters: selectedCharacterIds.map(id => characters.find(c => c.id === id)).filter(Boolean) as Character[],
    customLayoutStyles,
    isEditorPreview: true
  } : null;

  const editorView = (
    <div className="h-screen bg-black text-white selection:bg-dodgerblue/30 font-sans flex flex-col overflow-hidden">
      <Header 
        type="editor"
        user={user}
        activeProject={activeProject}
        onGoToLanding={() => navigate('/')}
        onGoToProjects={handleBackToProjects}
        setActiveProject={setActiveProject as any}
        onSaveProjectName={async (name: string) => {
          try {
            await fetch(`/api/projects/${activeProject.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${getToken()}`,
              },
              body: JSON.stringify({ name }),
            });
          } catch (e) {
            console.error('Failed to rename project:', e);
          }
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#020202]">
          <EditorSections 
            characters={characters}
            selectedCharacterIds={selectedCharacterIds}
            toggleCharacter={toggleCharacter}
            script={script}
            setScript={setScript}
            setVoiceoverResult={setVoiceoverResult}
            voiceoverResult={voiceoverResult}
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            sessionId={sessionId}
            styles={{
                subtitleFontSize, setSubtitleFontSize,
                subtitleX, setSubtitleX,
                subtitleY, setSubtitleY,
                activeColor, setActiveColor,
                inactiveColor, setInactiveColor,
                characterX, setCharacterX,
                characterY, setCharacterY,
                characterScale, setCharacterScale,
                bgVideoUrl, setBgVideoUrl,
                videoSpeed, setVideoSpeed,
                layoutMode, setLayoutMode: (m: string) => { setLayoutMode(m as any); setCustomLayoutStyles({}); },
                customLayoutStyles,
            }}
          />
        </div>

        {/* ── Fixed Studio Monitor ── */}
        <div className="w-[520px] border-l border-zinc-900 bg-[#050505] shrink-0 hidden lg:flex flex-col p-10 items-center gap-10">
            <div className="w-full flex justify-between items-center">
                 <div className="text-[10px] uppercase tracking-widest font-black text-dodgerblue flex items-center gap-3">
                   <span className="w-2.5 h-2.5 bg-dodgerblue rounded-full animate-pulse shadow-[0_0_15px_rgba(48,128,255,0.6)]" />
                   Monitor
                 </div>
                 <div className="text-[8px] font-black uppercase tracking-widest text-zinc-600">
                   Drag text/actor to reposition, use corner handle to scale
                 </div>
            </div>
              
            <div 
              ref={previewRef}
              className="relative w-full aspect-[9/16] bg-black border-4 border-zinc-800 shadow-2xl ring-1 ring-zinc-700 overflow-hidden"
            >
              {videoUrl ? (
                 <video src={videoUrl} controls className="w-full h-full object-cover" />
              ) : inputProps ? (
                <>
                  <Player
                    component={PlayerComposition as any}
                    inputProps={inputProps}
                    durationInFrames={durationInFrames}
                    compositionWidth={720}
                    compositionHeight={1280}
                    fps={FPS}
                    style={{ width: '100%', height: '100%', pointerEvents: 'none', willChange: 'transform' }}
                    controls={false}
                    autoPlay={false}
                    loop={false}
                  />
                  
                  {/* Ghost Overlays — both always fully active */}
                  <div className="absolute pointer-events-none inset-0">
                     {/* Text crosshair */}
                     <div 
                        className="absolute left-0 right-0 border-t border-dashed border-dodgerblue/80 pointer-events-none" 
                        style={{ top: `${subtitleY}%`, willChange: 'top' }}
                     >
                        <div 
                           className="absolute left-0 right-0 top-[-1000px] bottom-[-1000px] border-l border-dashed border-dodgerblue/80" 
                           style={{ left: `${subtitleX}%`, willChange: 'left' }} 
                        />
                     </div>

                     {/* Text ghost bounding box */}
                     <div 
                        ref={subtitleGhostRef}
                        className="absolute rounded-xl border-2 border-dashed border-dodgerblue/50 bg-dodgerblue/5 pointer-events-auto cursor-move group flex items-center justify-center" 
                        style={{ 
                          top: `${subtitleY}%`, 
                          left: `${subtitleX}%`, 
                          transform: 'translate(-50%, -50%)',
                          width: `min(88%, ${(subtitleFontSize * 6.5 / 720) * 100}%)`,
                          height: `${(subtitleFontSize * 2 / 1280) * 100}%`,
                          willChange: 'top, left, width, height',
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                           e.stopPropagation();
                           setIsDragging(true);
                           dragTarget.current = 'subtitles';
                           
                           const rect = previewRef.current!.getBoundingClientRect();
                           const x = ((e.clientX - rect.left) / rect.width) * 100;
                           const yTop = ((e.clientY - rect.top) / rect.height) * 100;
                           dragOffset.current = { x: x - subtitleX, y: yTop - subtitleY };
                        }}
                        onTouchStart={(e) => {
                           e.stopPropagation();
                           setIsDragging(true);
                           dragTarget.current = 'subtitles';
                           
                           const rect = previewRef.current!.getBoundingClientRect();
                           const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                           const yTop = ((e.touches[0].clientY - rect.top) / rect.height) * 100;
                           dragOffset.current = { x: x - subtitleX, y: yTop - subtitleY };
                        }}
                     >
                        {/* Subtitle Scale Handle */}
                        <div 
                           className="absolute -top-3 -right-3 w-6 h-6 bg-white border-4 border-dodgerblue rounded-full cursor-ne-resize pointer-events-auto shadow-lg hover:scale-125 transition-transform"
                           onMouseDown={(e) => {
                             e.stopPropagation();
                             setIsDragging(true);
                             dragTarget.current = 'subtitle-scale';
                           }}
                           onTouchStart={(e) => {
                             e.stopPropagation();
                             setIsDragging(true);
                             dragTarget.current = 'subtitle-scale';
                           }}
                           title="Drag to scale text"
                        />
                     </div>

                     {/* Actor ghosts for all visible characters */}
                     {(() => {
                         const visibleChars = (layoutMode === 'classic' || layoutMode === 'solo')
                             ? selectedCharacterIds.slice(0, 1)
                             : selectedCharacterIds.slice(0, 2);

                         return visibleChars.map((charId, i) => {
                             let xPos = characterX;
                             let yPos = characterY;
                             let scale = characterScale;

                             if (layoutMode === 'solo') { xPos = 10; yPos = 0; scale = 80; }
                             else if (layoutMode === 'split') { xPos = i === 0 ? 5 : 50; yPos = 30; scale = 45; }
                             else if (layoutMode === 'stacked') { xPos = 25; yPos = i === 0 ? 50 : 5; scale = 45; }
                             else if (layoutMode === 'pip') { xPos = i === 0 ? 10 : 65; yPos = i === 0 ? 5 : 70; scale = i === 0 ? 75 : 25; }
                             else if (layoutMode === 'debate') { xPos = i === 0 ? -10 : 40; yPos = -5; scale = 60; }

                             if (customLayoutStyles[charId]) {
                                 xPos = customLayoutStyles[charId].x;
                                 yPos = customLayoutStyles[charId].y;
                                 scale = customLayoutStyles[charId].scale;
                             }
                             
                             const charData = characters.find(c => c.id === charId);

                             return (
                               <div 
                                  ref={(el) => { actorGhostRefs.current[charId] = el; }}
                                  key={charId}
                                  className="absolute rounded-xl border-2 border-dashed border-dodgerblue shadow-[0_0_30px_rgba(48,128,255,0.25)] bg-dodgerblue/10 pointer-events-auto cursor-move group" 
                                  style={{ 
                                    bottom: `${yPos}%`, 
                                    left: `${xPos}%`, 
                                    height: `${scale}%`,
                                    willChange: 'bottom, left, height',
                                    zIndex: 10 + i,
                                  }}
                                  onMouseDown={(e) => {
                                      e.stopPropagation();
                                      setIsDragging(true);
                                      dragTarget.current = 'characters:' + charId;
                                      
                                      const rect = previewRef.current!.getBoundingClientRect();
                                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                                      const yBottom = 100 - ((e.clientY - rect.top) / rect.height) * 100;
                                      dragOffset.current = { x: x - xPos, y: yBottom - yPos };
                                  }}
                                  onTouchStart={(e) => {
                                      e.stopPropagation();
                                      setIsDragging(true);
                                      dragTarget.current = 'characters:' + charId;
                                      
                                      const rect = previewRef.current!.getBoundingClientRect();
                                      const x = ((e.touches[0].clientX - rect.left) / rect.width) * 100;
                                      const yBottom = 100 - ((e.touches[0].clientY - rect.top) / rect.height) * 100;
                                      dragOffset.current = { x: x - xPos, y: yBottom - yPos };
                                  }}
                               >
                                  {/* Scale Handle */}
                                  <div 
                                     className="absolute -top-3 -right-3 w-6 h-6 bg-white border-4 border-dodgerblue rounded-full cursor-ne-resize pointer-events-auto shadow-lg hover:scale-125 transition-transform"
                                     onMouseDown={(e) => {
                                       e.stopPropagation();
                                       setIsDragging(true);
                                       dragTarget.current = 'scale:' + charId;
                                     }}
                                     onTouchStart={(e) => {
                                       e.stopPropagation();
                                       setIsDragging(true);
                                       dragTarget.current = 'scale:' + charId;
                                     }}
                                     title="Drag to scale"
                                  />
                                  {charData?.imageUrl ? (
                                     <img 
                                        src={charData.imageUrl} 
                                        style={{ height: '100%', width: 'auto', display: 'block', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))', pointerEvents: 'none' }}
                                        alt="Actor"
                                        draggable={false}
                                     />
                                  ) : (
                                     <div className="h-full px-3 flex items-center text-[8px] font-black text-dodgerblue uppercase tracking-widest">Actor</div>
                                  )}
                               </div>
                             );
                         });
                     })()}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-center p-12 bg-zinc-950/40">
                  <div className="w-20 h-20 bg-zinc-900/50 rounded-full flex items-center justify-center text-4xl grayscale opacity-10">🎬</div>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<LandingPage user={user} onGetStarted={() => { if (user) navigate('/hub'); else navigate('/auth'); }} />} />
      <Route path="/auth" element={<AuthPage onAuthSuccess={(u) => { setUser(u); navigate('/hub'); }} onBack={() => navigate('/')} />} />
      <Route path="/campaign/:id/brand-profile" element={<BrandProfile />} />
      <Route path="/campaign/:id/hooks" element={<HookStrategy />} />
      <Route path="/campaign/:id/scripts" element={<ScriptReview />} />
      <Route path="/hub" element={
        user ? (
          <StudioHub
            user={user}
            onSelectStyle={(style) => { setActiveStyle(style); navigate('/projects'); }}
            onCreateProject={async (styleId) => {
              try {
                const res = await fetch('/api/projects', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`,
                  },
                  body: JSON.stringify({ name: 'Untitled', emoji: '🎬', style: styleId }),
                });
                if (res.ok) {
                  const data = await res.json();
                  loadProjectState({ ...data, state: {} });
                }
              } catch (e) {
                console.error('Failed to create project:', e);
              }
            }}
            onLogout={handleLogout}
            onGoToLanding={() => navigate('/')}
            onGoToProjects={() => navigate('/projects')}
          />
        ) : <Navigate to="/auth" />
      } />
      <Route path="/projects" element={
        user ? (
          <ProjectsPage
            user={user}
            activeStyle={activeStyle}
            onOpenProject={loadProjectState}
            onLogout={handleLogout}
            onGoToLanding={() => navigate('/')}
            onBackToStudio={() => navigate('/hub')}
          />
        ) : <Navigate to="/auth" />
      } />
      <Route path="/editor" element={user && activeProject ? editorView : <Navigate to="/projects" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
