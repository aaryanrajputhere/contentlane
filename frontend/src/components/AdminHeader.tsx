import { BarChart3, Film, Inbox, LayoutGrid, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../lib/api';

export default function AdminHeader({ newCount }: { newCount?: number }) {
  const [fetchedCount, setFetchedCount] = useState(0);
  useEffect(() => {
    if (newCount !== undefined) return;
    api<{ counts: { NEW: number } }>('/admin/support?pageSize=1')
      .then((result) => setFetchedCount(result.counts.NEW))
      .catch(() => setFetchedCount(0));
  }, [newCount]);
  const unreadCount = newCount ?? fetchedCount;
  const linkClass = ({ isActive }: { isActive: boolean }) => `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-[#111] text-white' : 'text-[#666] hover:bg-[#f2f2f2] hover:text-[#111]'}`;
  return (
    <header className="flex min-h-16 items-center justify-between gap-5 border-b border-[#e8e8e8] bg-white px-5 sm:px-8">
      <NavLink to="/admin" className="text-lg font-extrabold tracking-[-0.05em] text-[#111]">ContentLane <span className="font-medium text-[#999]">admin</span></NavLink>
      <nav className="flex items-center gap-1 rounded-full border border-[#e8e8e8] bg-white p-1">
        <NavLink to="/admin" end className={linkClass}><BarChart3 size={15} />Overview</NavLink>
        <NavLink to="/admin/users" className={linkClass}><Users size={15} />Users</NavLink>
        <NavLink to="/admin/projects" className={linkClass}><LayoutGrid size={15} />Projects</NavLink>
        <NavLink to="/admin/support" className={linkClass}><Inbox size={15} />Support{unreadCount > 0 ? <span className="rounded-full bg-black/10 px-1.5 text-[10px]">{unreadCount}</span> : null}</NavLink>
        <NavLink to="/admin/creators" className={linkClass}><Film size={15} />Creators</NavLink>
      </nav>
    </header>
  );
}
