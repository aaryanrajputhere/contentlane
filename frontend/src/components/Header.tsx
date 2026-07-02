import type { ReactNode } from 'react';

interface HeaderUser {
  email: string;
  name?: string | null;
}

interface HeaderProps {
  type: 'landing';
  user?: HeaderUser | null;
  onGetStarted?: () => void;
  onGoToLanding?: () => void;
  onLogout?: () => void;
  actions?: ReactNode;
}

export function Header({ user, onGetStarted, onGoToLanding, onLogout, actions }: HeaderProps) {
  return (
    <nav className="sticky top-0 z-50 px-6 py-4 border-b border-white/[0.05] bg-black/50 backdrop-blur-md shrink-0">
      <div className="w-full flex items-center justify-between">
        <button
          onClick={onGoToLanding}
          className="text-xl font-bold tracking-tighter hover:opacity-80 transition-opacity"
        >
          REEL<span className="text-blue-500">SWARM</span>
        </button>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400 absolute left-1/2 -translate-x-1/2">
          <a href="/#features" className="hover:text-white transition-colors">Features</a>
          <a href="/#templates" className="hover:text-white transition-colors">Templates</a>
          <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
        </div>

        <div className="flex items-center gap-4">
          {actions}
          {user && onLogout && <button onClick={onLogout} className="text-sm font-medium text-zinc-400 hover:text-white">Log out</button>}
          {onGetStarted && (
            <>
              {!user && (
                <button
                  onClick={onGetStarted}
                  className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  Log In
                </button>
              )}
              <button
                onClick={onGetStarted}
                className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 text-sm font-semibold rounded-lg transition-colors"
              >
                {user ? 'Dashboard' : 'Start Free'}
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
