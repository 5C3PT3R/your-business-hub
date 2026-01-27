import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: ReactNode;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasProfile: boolean;
  hasWorkspace: boolean;
  userId: string | null;
}

/**
 * AuthGuard - Simple authentication and onboarding guard
 *
 * Logic:
 * 1. Check if user is authenticated
 * 2. Check if user has a profile (onboarding_completed)
 * 3. Check if user has a workspace
 *
 * Redirects:
 * - No auth -> /auth
 * - No profile/workspace -> /onboarding
 * - Has everything -> render children
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const location = useLocation();
  const loadingCompleteRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    hasProfile: false,
    hasWorkspace: false,
    userId: null,
  });

  useEffect(() => {
    let isMounted = true;
    loadingCompleteRef.current = false;

    // Safety timeout - prevent infinite loading (15 seconds for slow connections)
    const safetyTimeout = setTimeout(() => {
      if (isMounted && !loadingCompleteRef.current) {
        console.warn('[AuthGuard] Safety timeout (15s) - forcing load complete');
        loadingCompleteRef.current = true;
        setState(prev => ({ ...prev, isLoading: false }));
      }
    }, 15000);

    async function checkAuth() {
      try {
        console.log('[AuthGuard] Checking auth...');
        const startTime = Date.now();

        // Step 1: Check authentication with timeout
        console.log('[AuthGuard] Getting session...');

        // Wrap getSession in a timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((_, reject) => {
          setTimeout(() => reject(new Error('Session fetch timeout')), 3000);
        });

        let session = null;
        let sessionError = null;

        try {
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          session = result.data.session;
          sessionError = result.error;
        } catch (e: any) {
          console.warn('[AuthGuard] getSession timed out, checking localStorage...');
          // Try to get session from localStorage directly
          const storedSession = localStorage.getItem('sb-' + import.meta.env.VITE_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token');
          if (storedSession) {
            try {
              const parsed = JSON.parse(storedSession);
              if (parsed?.user?.id) {
                session = parsed;
                console.log('[AuthGuard] Found session in localStorage');
              }
            } catch {
              console.warn('[AuthGuard] Failed to parse localStorage session');
            }
          }
        }

        console.log('[AuthGuard] Session:', session ? 'exists' : 'none', `(${Date.now() - startTime}ms)`, sessionError ? `Error: ${sessionError.message}` : '');

        // Get user from session (handles both Supabase response and localStorage fallback)
        const user = session?.user;

        if (!user?.id) {
          clearTimeout(safetyTimeout);
          loadingCompleteRef.current = true;
          if (isMounted) {
            setState({
              isLoading: false,
              isAuthenticated: false,
              hasProfile: false,
              hasWorkspace: false,
              userId: null,
            });
          }
          return;
        }

        const userId = user.id;
        console.log('[AuthGuard] User ID:', userId);

        // Set authenticated immediately so safety timeout doesn't redirect to /auth
        // We'll update hasProfile/hasWorkspace after checking
        if (isMounted) {
          isAuthenticatedRef.current = true;
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            userId,
          }));
        }

        // Step 2 & 3: Check profile and workspace in PARALLEL (with timeout)
        console.log('[AuthGuard] Checking profile and workspace in parallel...');

        const queryTimeout = 10000; // 10 seconds for parallel queries (slow connections)

        // Create promises for both queries (wrap in Promise.resolve for proper Promise type)
        const profilePromise = Promise.resolve(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()
        ).then(r => ({ type: 'profile' as const, data: r.data, error: r.error }));

        const workspacePromise = Promise.resolve(
          supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', userId)
            .limit(1)
        ).then(r => ({ type: 'workspace' as const, data: r.data, error: r.error }));

        // Race both against a timeout
        const queryTimeoutPromise = new Promise<'timeout'>((resolve) =>
          setTimeout(() => resolve('timeout'), queryTimeout)
        );

        let profile: any = null;
        let workspaces: any[] | null = null;

        try {
          // Wait for all to settle or timeout
          const results = await Promise.race([
            Promise.all([profilePromise, workspacePromise]),
            queryTimeoutPromise
          ]);

          if (results === 'timeout') {
            console.warn('[AuthGuard] Profile/workspace queries timed out');
          } else {
            const [profileResult, workspaceResult] = results;
            profile = profileResult.data;
            workspaces = workspaceResult.data;
            console.log('[AuthGuard] Profile result:', { profile, error: profileResult.error?.message });
            console.log('[AuthGuard] Workspace result:', { count: workspaces?.length, error: workspaceResult.error?.message });
          }
        } catch (e) {
          console.warn('[AuthGuard] Error in parallel queries:', e);
        }

        console.log('[AuthGuard] Queries completed:', `(${Date.now() - startTime}ms)`);

        const hasWorkspaceInDb = (workspaces?.length || 0) > 0;

        // Cast profile to handle column that may not exist in types yet
        const profileData = profile as Record<string, unknown> | null;
        const onboardingCompletedInDb = profileData?.onboarding_completed;

        // Also check localStorage for onboarding completion (handles slow DB scenarios)
        // But verify the localStorage data belongs to this user
        const localOnboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
        const localWorkspaceId = localStorage.getItem('current_workspace_id');
        const localOnboardingData = localStorage.getItem('onboarding_data');

        // Verify localStorage belongs to current user
        let localDataValid = false;
        if (localOnboardingCompleted && localOnboardingData) {
          try {
            const parsed = JSON.parse(localOnboardingData);
            localDataValid = parsed.userId === userId;
            if (!localDataValid) {
              console.warn('[AuthGuard] localStorage data belongs to different user, ignoring');
            }
          } catch {
            console.warn('[AuthGuard] Failed to parse onboarding_data');
          }
        }

        console.log('[AuthGuard] localStorage check:', {
          localOnboardingCompleted,
          localWorkspaceId: !!localWorkspaceId,
          localDataValid
        });

        // Profile is complete if:
        // 1. onboarding_completed === true in DB, OR
        // 2. Profile exists AND workspace exists in DB, OR
        // 3. Onboarding was completed locally FOR THIS USER, OR
        // 4. DB queries timed out but we have localStorage data (graceful degradation)
        const dbTimedOut = profile === null && workspaces === null;
        const hasLocalData = localOnboardingCompleted || !!localWorkspaceId;

        const hasProfile = onboardingCompletedInDb === true ||
                          (profileData !== null && hasWorkspaceInDb) ||
                          (localOnboardingCompleted && localDataValid) ||
                          (dbTimedOut && hasLocalData); // Graceful degradation when DB is unreachable
        const hasWorkspace = hasWorkspaceInDb ||
                            (!!localWorkspaceId && localDataValid) ||
                            (dbTimedOut && !!localWorkspaceId); // Trust localStorage when DB times out

        console.log('[AuthGuard] dbTimedOut:', dbTimedOut, 'hasLocalData:', hasLocalData);

        console.log('[AuthGuard] hasProfile:', hasProfile, '(dbOnboarding:', onboardingCompletedInDb, ', localValid:', localDataValid, ')');
        console.log('[AuthGuard] hasWorkspace:', hasWorkspace, '(dbWorkspace:', hasWorkspaceInDb, ', localValid:', localDataValid, ')');

        // Cache successful DB results to localStorage for faster future loads
        if (hasProfile && hasWorkspace && profileData && hasWorkspaceInDb) {
          console.log('[AuthGuard] Caching successful auth to localStorage');
          localStorage.setItem('onboarding_completed', 'true');
          if (workspaces && workspaces[0]?.id) {
            localStorage.setItem('current_workspace_id', workspaces[0].id);
          }
          localStorage.setItem('onboarding_data', JSON.stringify({
            userId,
            fullName: profileData.full_name || '',
            company: profileData.company || '',
          }));
        }

        clearTimeout(safetyTimeout);
        loadingCompleteRef.current = true;
        isAuthenticatedRef.current = true;

        if (isMounted) {
          console.log('[AuthGuard] Setting state:', { isAuthenticated: true, hasProfile, hasWorkspace });
          setState({
            isLoading: false,
            isAuthenticated: true,
            hasProfile,
            hasWorkspace,
            userId,
          });
        }
      } catch (error) {
        console.error('[AuthGuard] Error checking auth:', error);
        clearTimeout(safetyTimeout);
        loadingCompleteRef.current = true;
        if (isMounted) {
          setState({
            isLoading: false,
            isAuthenticated: false,
            hasProfile: false,
            hasWorkspace: false,
            userId: null,
          });
        }
      }
    }

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      console.log('[AuthGuard] Auth state changed:', event);

      // Only re-check on sign out or if not already authenticated
      // Skip re-check for SIGNED_IN/TOKEN_REFRESHED if we're already authenticated
      // This prevents infinite loops from Supabase internal token refreshes
      if (event === 'SIGNED_OUT') {
        isAuthenticatedRef.current = false;
        loadingCompleteRef.current = false;
        setState(prev => ({ ...prev, isLoading: true }));
        checkAuth();
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !isAuthenticatedRef.current) {
        // Only re-check if we weren't already authenticated
        loadingCompleteRef.current = false;
        setState(prev => ({ ...prev, isLoading: true }));
        checkAuth();
      }
      // If already authenticated and got SIGNED_IN/TOKEN_REFRESHED, ignore it
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated -> redirect to auth
  if (!state.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // On onboarding page - allow access regardless of profile/workspace status
  if (location.pathname === '/onboarding') {
    // But if they already completed onboarding, send them to dashboard
    if (state.hasProfile && state.hasWorkspace) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // Authenticated but missing profile or workspace -> redirect to onboarding
  if (!state.hasProfile || !state.hasWorkspace) {
    return <Navigate to="/onboarding" replace />;
  }

  // All good - render children
  return <>{children}</>;
}

/**
 * PublicRoute - For pages that don't require authentication (landing, auth, etc.)
 */
export function PublicRoute({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
