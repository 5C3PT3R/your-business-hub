import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signInWithGoogle } = useAuth();

  // Only auto-login if "Keep me logged in" was selected
  useEffect(() => {
    const persist = localStorage.getItem('regent_keep_logged_in') === 'true';

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        navigate('/deals');
      } else if (session && persist) {
        navigate('/deals');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && persist) {
        navigate('/deals');
      } else if (session && !persist) {
        supabase.auth.signOut();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    localStorage.setItem('regent_keep_logged_in', keepLoggedIn ? 'true' : 'false');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've been logged in successfully.",
      });
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    localStorage.setItem('regent_keep_logged_in', keepLoggedIn ? 'true' : 'false');
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast({
        title: "Google sign-in failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative antialiased"
      style={{
        backgroundColor: "#FDFBF7",
        color: "#1C1917",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Grain Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Subtle background glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#CC5500]/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-stone-400/5 rounded-full blur-[100px]" />

      {/* Top nav bar */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-md border-b" style={{ backgroundColor: "rgba(253,251,247,0.9)", borderColor: "#E7E5E4" }}>
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
            <div className="relative w-8 h-8 flex items-center justify-center bg-stone-900 text-white rounded-sm overflow-hidden transition-transform duration-300 group-hover:rotate-180">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 5H9L12 2Z" fill="currentColor" />
                <path d="M16 6H8V8H16V6Z" fill="currentColor" />
                <path d="M7 9H17L18 12H6L7 9Z" fill="currentColor" />
                <path d="M6 13H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V13Z" fill="currentColor" fillOpacity="0.8" />
              </svg>
            </div>
            <span className="text-2xl tracking-tight font-medium" style={{ fontFamily: "'Instrument Serif', serif" }}>
              Regent
            </span>
          </div>
        </div>
      </nav>

      {/* Login Card */}
      <div className="w-full max-w-md mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#CC5500] animate-pulse" />
            <span
              className="text-xs uppercase tracking-widest text-[#CC5500] font-semibold"
              style={{ fontFamily: "'Space Grotesk', monospace" }}
            >
              Secure Access
            </span>
          </div>
          <h1
            className="text-5xl md:text-6xl tracking-tight mb-4"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Welcome <span className="italic text-[#CC5500]">back.</span>
          </h1>
          <p className="text-stone-500 text-lg font-light">
            Sign in to your command center
          </p>
        </div>

        {/* Form Card */}
        <div
          className="bg-white border rounded-2xl p-8 shadow-sm"
          style={{ borderColor: "#E7E5E4" }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="login-email"
                className="text-xs uppercase tracking-widest text-stone-500 font-semibold"
                style={{ fontFamily: "'Space Grotesk', monospace" }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#FDFBF7] border rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#CC5500]/20 focus:border-[#CC5500] transition-all"
                style={{ borderColor: "#E7E5E4", fontFamily: "'Inter', sans-serif" }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="login-password"
                className="text-xs uppercase tracking-widest text-stone-500 font-semibold"
                style={{ fontFamily: "'Space Grotesk', monospace" }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#FDFBF7] border rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#CC5500]/20 focus:border-[#CC5500] transition-all"
                style={{ borderColor: "#E7E5E4", fontFamily: "'Inter', sans-serif" }}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="keep-logged-in"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 cursor-pointer accent-[#CC5500]"
              />
              <label
                htmlFor="keep-logged-in"
                className="text-sm text-stone-500 cursor-pointer select-none"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Keep me logged in
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-stone-900 text-white rounded-lg font-medium hover:bg-[#CC5500] transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: "0.05em" }}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" style={{ borderColor: "#E7E5E4" }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="bg-white px-4 text-xs uppercase tracking-widest text-stone-400"
                style={{ fontFamily: "'Space Grotesk', monospace" }}
              >
                or
              </span>
            </div>
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3.5 bg-[#FDFBF7] border rounded-lg font-medium text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            style={{ borderColor: "#E7E5E4", fontFamily: "'Space Grotesk', monospace", letterSpacing: "0.05em" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            {googleLoading ? "Connecting..." : "Continue with Google"}
          </button>
        </div>

        {/* Back to home link */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-stone-400 hover:text-[#CC5500] transition-colors"
            style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: "0.05em" }}
          >
            &larr; Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
