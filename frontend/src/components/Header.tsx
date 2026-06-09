import React from 'react';
import { LogOut, ChevronLeft } from 'lucide-react';
import type { Project } from '../types';

interface HeaderProps {
  type: 'landing' | 'hub' | 'projects' | 'editor';
  user?: any;
  activeProject?: Project;
  onGetStarted?: () => void;
  onGoToLanding?: () => void;
  onGoToProjects?: () => void;
  onBackToStudio?: () => void;
  onLogout?: () => void;
  setActiveProject?: (p: Project) => void;
  onSaveProjectName?: (name: string) => Promise<void>;
}

export const Header: React.FC<HeaderProps> = ({
  type,
  user,
  activeProject,
  onGetStarted,
  onGoToLanding,
  onGoToProjects,
  onBackToStudio,
  onLogout,
  setActiveProject,
  onSaveProjectName
}) => {
  return (
    <nav className="sticky top-0 z-50 px-6 py-4 border-b border-white/[0.05] bg-black/50 backdrop-blur-md shrink-0">
      <div className="w-full flex items-center justify-between">
        
        {/* LEFT SECTION */}
        <div className="flex items-center gap-4">
          <button onClick={onGoToLanding} className="text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity">
            REEL<span className="text-blue-500">SWARM</span>
          </button>
          
          {type === 'editor' && (
            <>
              <div className="w-px h-6 bg-white/10 mx-2" />
              <button 
                onClick={onGoToProjects}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg text-zinc-400 hover:text-white transition-all text-xs font-medium"
              >
                <ChevronLeft size={14} className="text-blue-500" />
                Projects
              </button>

              {activeProject && (
                <div className="flex items-center gap-3 ml-2">
                  <span className="text-zinc-700">/</span>
                  <span className="text-sm font-semibold text-white flex items-center gap-2">
                    <span>{activeProject.emoji}</span>
                    <input
                      type="text"
                      value={activeProject.name}
                      onChange={(e) => setActiveProject && setActiveProject({ ...activeProject, name: e.target.value })}
                      onBlur={async () => {
                        if (!activeProject.name.trim() || !onSaveProjectName) return;
                        await onSaveProjectName(activeProject.name.trim());
                      }}
                      className="bg-transparent border-none outline-none text-sm font-semibold text-white placeholder-zinc-500 w-32 focus:ring-1 focus:ring-white/20 rounded px-1"
                      placeholder="Untitled"
                    />
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* CENTER / NAVIGATION (Landing Only) */}
        {type === 'landing' && (
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400 absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#templates" className="hover:text-white transition-colors">Templates</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
        )}

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-4">
          {type === 'landing' && (
            <>
              {!user && <button onClick={onGetStarted} className="text-sm font-medium text-zinc-300 hover:text-white transition-colors">Log In</button>}
              <button onClick={onGetStarted} className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 text-sm font-semibold rounded-lg transition-colors">
                {user ? 'Dashboard' : 'Start Free'}
              </button>
            </>
          )}

          {(type === 'hub' || type === 'projects') && user && (
            <div className="flex items-center gap-6">
              <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/[0.05]">
                <button 
                  onClick={type === 'projects' ? onBackToStudio : undefined}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${type === 'hub' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Templates</button>
                <button 
                  onClick={type === 'hub' ? onGoToProjects : undefined}
                  className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${type === 'projects' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Projects</button>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-full hidden sm:flex">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-[11px] font-semibold text-zinc-300 px-1">
                  {user.name || user.email}
                </span>
              </div>
              <button
                className="px-4 py-2 bg-transparent hover:bg-white/5 border border-white/10 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
                onClick={onLogout}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}

          {type === 'editor' && user && (
            <>
              {/* Auto-save indicator */}
              <div className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.05]">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                Auto-saving
              </div>
              
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] rounded-full hidden sm:flex">
                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-[11px] font-semibold text-zinc-300 px-1">
                  {user.name || user.email}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
