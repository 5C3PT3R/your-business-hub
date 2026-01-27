import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  company: string | null;
  role: string | null;
  is_active: boolean;
  subscription_tier: string;
  subscription_expires_at: string | null;
  onboarding_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isSubscribed: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile data from profiles table with timeout
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const PROFILE_TIMEOUT = 5000; // 5 seconds

    try {
      console.log('[useAuth] Fetching profile for:', userId);

      // Race against timeout
      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'Profile fetch timeout' } }), PROFILE_TIMEOUT);
      });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn('[useAuth] Profile fetch error/timeout:', error.message);

        // Try to get cached profile from localStorage
        const cachedOnboardingData = localStorage.getItem('onboarding_data');
        if (cachedOnboardingData) {
          try {
            const parsed = JSON.parse(cachedOnboardingData);
            if (parsed.userId === userId) {
              console.log('[useAuth] Using cached profile from localStorage');
              return {
                id: userId,
                full_name: parsed.fullName || null,
                email: null,
                avatar_url: null,
                company: parsed.companyName || null,
                role: parsed.title || null,
                is_active: true,
                subscription_tier: 'free',
                subscription_expires_at: null,
                onboarding_completed: true,
              };
            }
          } catch {
            // Ignore parse errors
          }
        }
        return null;
      }

      console.log('[useAuth] Profile fetched successfully');

      return {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        avatar_url: data.avatar_url,
        company: data.company,
        role: data.role,
        is_active: data.is_active ?? true,
        subscription_tier: data.subscription_tier ?? 'free',
        subscription_expires_at: data.subscription_expires_at,
        // Handle missing column - assume true if column doesn't exist (backward compatibility)
        onboarding_completed: data.onboarding_completed ?? (data.id ? true : false),
      };
    } catch (error) {
      console.error('[useAuth] Profile fetch error:', error);
      return null;
    }
  };

  // Refresh profile data
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Initialize auth state with timeout
    const initAuth = async () => {
      const SESSION_TIMEOUT = 3000; // 3 seconds

      try {
        console.log('[useAuth] Initializing auth...');

        // Race getSession against timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) => {
          setTimeout(() => {
            console.warn('[useAuth] getSession timed out, checking localStorage');
            resolve({ data: { session: null }, error: null });
          }, SESSION_TIMEOUT);
        });

        let session = null;
        try {
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          session = result.data.session;
        } catch (e) {
          console.warn('[useAuth] getSession failed:', e);
        }

        // If session is null but we have localStorage data, try to construct user from it
        if (!session) {
          const storedAuth = localStorage.getItem(`sb-${import.meta.env.VITE_SUPABASE_PROJECT_ID}-auth-token`);
          if (storedAuth) {
            try {
              const parsed = JSON.parse(storedAuth);
              if (parsed?.user?.id) {
                console.log('[useAuth] Found session in localStorage');
                session = parsed;
              }
            } catch {
              console.warn('[useAuth] Failed to parse localStorage session');
            }
          }
        }

        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const profileData = await fetchProfile(session.user.id);
          if (isMounted) setProfile(profileData);
        }

        console.log('[useAuth] Init complete, user:', session?.user?.id || 'none');
      } catch (error) {
        console.error('[useAuth] Init error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const profileData = await fetchProfile(session.user.id);
        if (isMounted) setProfile(profileData);
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    // Clear cached data
    localStorage.removeItem('current_workspace_id');
    localStorage.removeItem('cached_workspace_data');
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      console.error('Error signing in with Google:', error.message);
      throw error;
    }
  };

  // Compute subscription status
  const isSubscribed = Boolean(
    profile?.is_active &&
    (!profile?.subscription_expires_at ||
      new Date(profile.subscription_expires_at) > new Date())
  );

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      isSubscribed,
      signOut,
      signInWithGoogle,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
