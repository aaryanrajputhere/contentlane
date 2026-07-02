import { useState, type FormEvent } from 'react';
import { post } from '../lib/api';

interface Props { onAuthSuccess: () => void; onBack: () => void }
export default function AuthPage({ onAuthSuccess, onBack }: Props) {
  const [isLogin, setIsLogin] = useState(true); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); setLoading(true); setError(''); try { await post(`/auth/${isLogin ? 'login' : 'signup'}`, isLogin ? { email, password } : { email, password, name }); onAuthSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Authentication failed'); } finally { setLoading(false); } };
  return <main className="min-h-screen bg-[#020202] text-white flex items-center justify-center p-6">
    <section className="w-full max-w-md bg-[#080808] border border-zinc-800 rounded-3xl p-8">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white mb-8">← Back</button>
      <h1 className="text-3xl font-black mb-2">{isLogin ? 'Sign in' : 'Private beta signup'}</h1>
      <p className="text-zinc-400 text-sm mb-8">{isLogin ? 'Use your ReelSwarm account.' : 'Your email must be allowlisted by an administrator.'}</p>
      <form onSubmit={submit} className="space-y-5">
        {!isLogin && <label className="block text-sm">Name<input className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3" value={name} onChange={event => setName(event.target.value)} required /></label>}
        <label className="block text-sm">Email<input type="email" autoComplete="email" className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3" value={email} onChange={event => setEmail(event.target.value)} required /></label>
        <label className="block text-sm">Password<input type="password" minLength={12} autoComplete={isLogin ? 'current-password' : 'new-password'} className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3" value={password} onChange={event => setPassword(event.target.value)} required /><span className="block mt-1 text-xs text-zinc-500">Minimum 12 characters</span></label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="w-full bg-white text-black rounded-xl p-3 font-bold disabled:opacity-50">{loading ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}</button>
      </form>
      <button onClick={() => { setIsLogin(value => !value); setError(''); }} className="mt-6 text-sm text-blue-400">{isLogin ? 'Need an account?' : 'Already registered?'}</button>
    </section>
  </main>;
}
