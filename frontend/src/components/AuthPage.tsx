import React, { useState } from 'react';

interface Props {
  onAuthSuccess: (user: any) => void;
  onBack: () => void;
}

const AuthPage: React.FC<Props> = ({ onAuthSuccess, onBack }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const body = isLogin ? { email, password } : { email, password, name };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      // Persist JWT and user info so the session survives a page refresh
      localStorage.setItem('reelswarm-jwt', data.token);
      localStorage.setItem('reelswarm-user', JSON.stringify(data.user));

      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020202] text-white flex items-center justify-center p-6 selection:bg-dodgerblue/30 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-dodgerblue/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <button 
          onClick={onBack}
          className="mb-8 flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> Back to Landing
        </button>

        <div className="bg-[#050505] border border-zinc-900 rounded-[32px] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <div className="w-12 h-12 bg-dodgerblue rounded-2xl flex items-center justify-center font-black text-black text-xs shadow-lg shadow-dodgerblue/20 mx-auto mb-6">B</div>
            <h2 className="text-3xl font-black tracking-tighter mb-2">{isLogin ? 'WELCOME BACK' : 'JOIN THE CHAOS'}</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">
              {isLogin ? 'Enter your credentials to continue' : 'Create your account to start generating'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 px-1">Full Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white placeholder:text-zinc-700 outline-none focus:border-dodgerblue transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 px-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white placeholder:text-zinc-700 outline-none focus:border-dodgerblue transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2 px-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-5 py-4 text-white placeholder:text-zinc-700 outline-none focus:border-dodgerblue transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest p-4 rounded-xl text-center">
                ⚠ {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-dodgerblue text-black font-black uppercase tracking-widest text-xs rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-dodgerblue/20 disabled:opacity-50 disabled:scale-100 mt-4"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin mx-auto" />
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-zinc-500 hover:text-dodgerblue transition-colors text-[10px] font-black uppercase tracking-widest"
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
