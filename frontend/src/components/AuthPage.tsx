import { SignIn, SignUp } from '@clerk/react';

type AuthMode = 'login' | 'signup';

export default function AuthPage({ mode }: { mode: AuthMode }) {
  return (
    <main className="grid min-h-screen place-items-center overflow-hidden bg-[#f7f6f2] px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)]" />
      <div className="relative">
        {mode === 'signup' ? (
          <SignUp routing="path" path="/signup" signInUrl="/login" fallbackRedirectUrl="/" />
        ) : (
          <SignIn routing="path" path="/login" signUpUrl="/signup" fallbackRedirectUrl="/" />
        )}
      </div>
    </main>
  );
}
