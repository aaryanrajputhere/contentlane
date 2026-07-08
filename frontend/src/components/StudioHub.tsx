import React from 'react';
import type { VideoStyle } from '../types';
import { Sparkles, BookOpen, Swords, Newspaper, GraduationCap, Lock, ChevronRight } from 'lucide-react';
import { Header } from './Header';

interface StyleOption {
  id: VideoStyle;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor: string;
  live: boolean;
  videoSrc?: string;
}

const STYLES: StyleOption[] = [
  {
    id: 'product-hook',
    title: 'Product Hook',
    description: 'Two characters break down topics with AI scripts, split-screen layouts, and dynamic subtitles.',
    icon: <Sparkles size={28} strokeWidth={2.5} />,
    gradient: 'from-blue-500 to-cyan-400',
    glowColor: 'rgba(59, 130, 246, 0.5)',
    live: true,
    videoSrc: '/assets/landing/demo2.mp4',
  },
  {
    id: 'storytime',
    title: 'Story Time',
    description: 'Solo narrator over atmospheric backgrounds with cinematic text reveals and immersive audio.',
    icon: <BookOpen size={28} strokeWidth={2.5} />,
    gradient: 'from-purple-500 to-pink-400',
    glowColor: 'rgba(168, 85, 247, 0.5)',
    live: false,
    videoSrc: '/assets/landing/demo1.mp4',
  },
  {
    id: 'debate',
    title: 'Debate',
    description: 'Two opposing characters go head-to-head with aggressive layouts and VS split-screen energy.',
    icon: <Swords size={28} strokeWidth={2.5} />,
    gradient: 'from-red-500 to-orange-400',
    glowColor: 'rgba(239, 68, 68, 0.5)',
    live: false,
    videoSrc: '/assets/landing/demo3.mp4',
  },
  {
    id: 'newsflash',
    title: 'News Flash',
    description: 'Breaking-news format with ticker overlays, single anchor character, and urgent pacing.',
    icon: <Newspaper size={28} strokeWidth={2.5} />,
    gradient: 'from-amber-500 to-yellow-400',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    live: false,
  },
  {
    id: 'lecture',
    title: 'Lecture',
    description: 'Content format with visual hooks, character commentary, and structured lesson flow.',
    icon: <GraduationCap size={28} strokeWidth={2.5} />,
    gradient: 'from-emerald-500 to-teal-400',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    live: false,
  },
];

interface Props {
  user: { id: string; name?: string; email: string };
  onSelectStyle?: (style: VideoStyle) => void;
  onCreateProject?: (styleId: string) => void;
  onLogout: () => void;
  onGoToLanding: () => void;
  onGoToProjects?: () => void;
}

const StudioHub: React.FC<Props> = ({ user, onCreateProject, onLogout, onGoToLanding, onGoToProjects }) => {
  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
      {/* ── Nav ── */}
      <Header 
        type="hub"
        user={user}
        onGoToLanding={onGoToLanding}
        onGoToProjects={onGoToProjects}
        onLogout={onLogout}
      />

      {/* ── Main Content ── */}
      <main className="pt-14 pb-20 px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center mt-4 relative mb-16">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="relative px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 mb-4 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            <span className="text-[10px] font-semibold tracking-[0.15em] text-zinc-300 uppercase">CHOOSE YOUR FORMAT</span>
          </div>
          <h2 className="relative text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4">
            What are we <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-400">creating</span> today?
          </h2>
          <p className="relative text-zinc-400 text-base md:text-lg max-w-xl mx-auto leading-relaxed font-medium">
            Pick a video style to get started. Each format has its own editor, layouts, and rendering pipeline.
          </p>
        </div>

        {/* Style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => style.live && onCreateProject && onCreateProject(style.id)}
              disabled={!style.live}
              className={`group relative text-left bg-[#0A0A0A] border rounded-2xl p-7 transition-all duration-300 overflow-hidden flex flex-col min-h-[380px] ${
                style.live
                  ? 'border-zinc-800/80 hover:border-zinc-600 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'border-zinc-900/50 cursor-not-allowed opacity-50 grayscale'
              }`}
              style={style.live ? {
                boxShadow: `0 0 0 0px transparent`,
              } : {}}
              onMouseEnter={(e) => {
                if (style.live) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 20px 60px -15px ${style.glowColor}`;
                }
              }}
              onMouseLeave={(e) => {
                if (style.live) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0px transparent`;
                }
              }}
            >
              {/* Gradient accent line at top */}
              <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30`} />

              {/* Background Video */}
              {style.videoSrc && (
                <>
                  <video 
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    src={style.videoSrc} 
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-0 ${style.live ? 'opacity-40 group-hover:opacity-60' : 'opacity-20 group-hover:opacity-30'}`} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/90 to-transparent z-10 pointer-events-none" />
                </>
              )}

              {/* Badge */}
              <div className="relative z-20 flex items-center justify-between mb-24">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]`}>
                  {style.icon}
                </div>
                {style.live ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full backdrop-blur-md">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[8px] uppercase tracking-widest font-black text-emerald-400">Live</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800/50 border border-zinc-700/30 rounded-full backdrop-blur-md">
                    <Lock size={8} className="text-zinc-500" />
                    <span className="text-[8px] uppercase tracking-widest font-black text-zinc-500">Coming Soon</span>
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="relative z-20 mt-auto">
                <h3 className={`text-xl font-black tracking-tight mb-2 transition-colors duration-300 ${
                  style.live ? 'text-white' : 'text-zinc-400'
                }`}>
                  {style.title}
                </h3>
                <p className={`text-sm leading-relaxed mb-5 transition-colors duration-300 ${
                  style.live ? 'text-zinc-300 group-hover:text-zinc-200' : 'text-zinc-500'
                }`}>
                  {style.description}
                </p>

                {/* CTA */}
                {style.live && (
                  <div className="flex items-center gap-2 text-[9px] uppercase tracking-widest font-black text-dodgerblue opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-1">
                    Create Project
                    <ChevronRight size={12} className="transition-transform group-hover:translate-x-1" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <div className="text-center mt-16">
          <p className="text-zinc-700 text-[10px] uppercase tracking-widest font-black">
            More formats dropping soon — Stay tuned for updates
          </p>
        </div>
      </main>
    </div>
  );
};

export default StudioHub;
