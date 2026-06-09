import React, { useState, useEffect } from 'react';
import type { Project } from '../types';
import { Plus, Trash2, FolderOpen, Loader2 } from 'lucide-react';
import { Header } from './Header';

// ── Helper to format style names ──
const getStyleName = (styleId: string) => {
  const styles: Record<string, string> = {
    'product-hook': 'Product Hook',
    'explainer': 'Product Hook',
    storytime: 'Story Time',
    debate: 'Debate',
    newsflash: 'News Flash',
    lecture: 'Lecture'
  };
  return styles[styleId] || styleId;
};

interface Props {
  onOpenProject: (project: Project) => void;
  onLogout: () => void;
  user: { id: string; name?: string; email: string };
  activeStyle?: string;
  onGoToLanding?: () => void;
  onBackToStudio?: () => void;
}

const getToken = () => localStorage.getItem('reelswarm-jwt') || localStorage.getItem('brainrot-jwt') || '';

const ProjectsPage: React.FC<Props> = ({ onOpenProject, onLogout, user, activeStyle, onGoToLanding, onBackToStudio }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // ── Fetch projects ──
  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load projects');
      const data = await res.json();
      setProjects(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);



  // ── Delete project ──
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setDeleteId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Open a project (fetch full state) ──
  const handleOpen = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load project');
      const full = await res.json();
      onOpenProject(full);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-blue-500/30 font-sans overflow-x-hidden">
      {/* ── Nav ── */}
      <Header 
        type="projects"
        user={user}
        onGoToLanding={onGoToLanding}
        onBackToStudio={onBackToStudio}
        onLogout={onLogout}
      />

      {/* ── Main content ── */}
      <main className="pt-14 pb-20 px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-tight mb-2">Your Projects</h2>
            <p className="text-zinc-500 text-sm">
              {projects.length} project{projects.length !== 1 ? 's' : ''} · Select one to continue editing
            </p>
          </div>
          <button
            onClick={onBackToStudio}
            className="flex items-center gap-2 px-6 py-3 bg-dodgerblue text-black font-black uppercase tracking-widest text-[10px] rounded-xl transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(48,128,255,0.2)]"
          >
            <Plus size={14} strokeWidth={3} />
            New Project
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-500 text-sm mb-8 flex justify-between items-center">
            <span>⚠ {error}</span>
            <button onClick={() => setError('')} className="text-red-500/60 hover:text-red-500 text-xs font-black">✕</button>
          </div>
        )}



        {/* Delete Confirmation */}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0A0A0A] border border-zinc-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-300">
              <h3 className="text-lg font-black tracking-tight mb-2">Delete Project?</h3>
              <p className="text-zinc-500 text-sm mb-8">This action cannot be undone. All project data will be permanently removed.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-3 bg-zinc-900 text-zinc-400 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-zinc-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteId)}
                  className="flex-1 py-3 bg-red-500/20 text-red-400 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-red-500/30 transition-all border border-red-500/20"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={32} className="animate-spin text-dodgerblue" />
            <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Loading projects…</span>
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 gap-6 text-center">
            <div className="w-24 h-24 bg-zinc-900/50 rounded-3xl flex items-center justify-center text-5xl opacity-40">🎬</div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-zinc-400 mb-2">No projects yet</h3>
              <p className="text-zinc-600 text-sm max-w-sm">Create your first project to start generating brain-melting content.</p>
            </div>
            <button
              onClick={onBackToStudio}
              className="mt-4 flex items-center gap-2 px-8 py-4 bg-dodgerblue text-black font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(48,128,255,0.2)]"
            >
              <Plus size={14} strokeWidth={3} />
              Create First Project
            </button>
          </div>
        ) : (
          /* Project grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 transition-all duration-300 hover:border-zinc-700 hover:shadow-[0_10px_40px_rgba(0,0,0,0.5)] cursor-pointer"
                onClick={() => handleOpen(project)}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(project.id);
                  }}
                  className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 text-zinc-600"
                >
                  <Trash2 size={12} />
                </button>

                {/* Emoji + Name */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center text-2xl shrink-0 border border-zinc-800 group-hover:border-zinc-700 transition-colors group-hover:scale-110 group-hover:shadow-lg duration-300">
                    {project.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black tracking-tight truncate group-hover:text-dodgerblue transition-colors">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 text-[8px] font-bold rounded uppercase tracking-widest border border-zinc-700">
                        {getStyleName(project.style || 'product-hook')}
                      </span>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                        Updated {formatDate(project.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-700">
                    Created {formatDate(project.createdAt)}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-dodgerblue opacity-0 group-hover:opacity-100 transition-opacity">
                    <FolderOpen size={10} />
                    Open
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectsPage;
