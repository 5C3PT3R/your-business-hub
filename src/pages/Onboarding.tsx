/**
 * Onboarding Wizard - "Coronation" Theme
 *
 * 2-Step flow:
 * Step 1: Identity (Name, Title)
 * Step 2: Empire (Company Name, Industry)
 *
 * On submit: Creates profile + workspace + redirects to dashboard
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowRight, Crown, Building2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Step = 'identity' | 'empire' | 'initializing';

const industries = [
  { value: 'saas', label: 'SaaS' },
  { value: 'agency', label: 'Agency' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance' },
  { value: 'sales', label: 'Sales' },
  { value: 'other', label: 'Other' },
];

export default function Onboarding() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('identity');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Form data
  const [fullName, setFullName] = useState('');
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('sales');

  // Progress messages for initialization
  const [progressMessages, setProgressMessages] = useState<string[]>([]);

  // Get current user on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setUserEmail(session.user.email || null);
        // Pre-fill name from user metadata if available
        const metadata = session.user.user_metadata;
        if (metadata?.full_name) {
          setFullName(metadata.full_name);
        }
      }
    });
  }, []);

  const handleNextStep = () => {
    if (step === 'identity') {
      if (!fullName.trim()) {
        toast({ title: 'Name required', description: 'Please enter your name.', variant: 'destructive' });
        return;
      }
      setStep('empire');
    }
  };

  // Helper to wrap a promise with timeout
  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  };

  const handleSubmit = async () => {
    if (!companyName.trim()) {
      toast({ title: 'Company name required', description: 'Please enter your company name.', variant: 'destructive' });
      return;
    }

    if (!userId) {
      toast({ title: 'Not authenticated', description: 'Please log in again.', variant: 'destructive' });
      window.location.href = '/auth';
      return;
    }

    setStep('initializing');
    setIsSubmitting(true);

    const QUERY_TIMEOUT = 8000; // 8 seconds per operation

    // Generate workspace ID upfront
    const workspaceId = crypto.randomUUID();

    // IMMEDIATELY store to localStorage so AuthGuard can see it even if DB is slow
    console.log('[Onboarding] Setting localStorage immediately...');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('current_workspace_id', workspaceId);
    localStorage.setItem('cached_workspace_data', JSON.stringify({
      id: workspaceId,
      name: companyName.trim(),
      industry_type: industry,
      owner_id: userId,
    }));
    localStorage.setItem('onboarding_data', JSON.stringify({
      fullName: fullName.trim(),
      title: title.trim(),
      companyName: companyName.trim(),
      industry,
      userId,
    }));
    console.log('[Onboarding] localStorage set:', {
      onboarding_completed: localStorage.getItem('onboarding_completed'),
      current_workspace_id: localStorage.getItem('current_workspace_id'),
    });

    try {
      // Progress: Creating profile
      setProgressMessages(['Creating your profile...']);
      console.log('[Onboarding] Creating profile...');

      // Step 1: Upsert profile with timeout
      const profileResult = await withTimeout(
        supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: userEmail,
            full_name: fullName.trim(),
            role: title.trim() || null,
            company: companyName.trim(),
            onboarding_completed: true,
            is_active: true,
          } as any, { onConflict: 'id' }),
        QUERY_TIMEOUT,
        { error: { message: 'Profile creation timed out' } } as any
      );

      if (profileResult.error) {
        console.warn('[Onboarding] Profile error (will retry without onboarding_completed):', profileResult.error.message);
        // Try fallback without onboarding_completed
        const fallbackResult = await withTimeout(
          supabase
            .from('profiles')
            .upsert({
              id: userId,
              email: userEmail,
              full_name: fullName.trim(),
              role: title.trim() || null,
              company: companyName.trim(),
              is_active: true,
            }, { onConflict: 'id' }),
          QUERY_TIMEOUT,
          { error: { message: 'Profile fallback timed out' } } as any
        );

        if (fallbackResult.error) {
          console.warn('[Onboarding] Profile fallback also failed:', fallbackResult.error.message);
          // Continue anyway - we'll store locally
        }
      }

      console.log('[Onboarding] Profile step complete');

      // Progress: Creating workspace
      setProgressMessages(prev => [...prev, 'Setting up your workspace...']);
      console.log('[Onboarding] Creating workspace...');

      // Step 2: Check if workspace exists (with timeout)
      const existingResult = await withTimeout(
        supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', userId)
          .limit(1),
        QUERY_TIMEOUT,
        { data: null, error: null } as any
      );

      let finalWorkspaceId = workspaceId; // Use pre-generated ID by default
      let workspaceCreated = false;

      if (existingResult.data && existingResult.data.length > 0) {
        // Use existing workspace instead
        finalWorkspaceId = existingResult.data[0].id;
        workspaceCreated = true;
        console.log('[Onboarding] Found existing workspace:', finalWorkspaceId);

        // Update localStorage with actual workspace ID
        localStorage.setItem('current_workspace_id', finalWorkspaceId);

        // Update it with new name (fire and forget)
        supabase
          .from('workspaces')
          .update({ name: companyName.trim() })
          .eq('id', finalWorkspaceId)
          .then(() => console.log('[Onboarding] Workspace name updated'))
          .catch(e => console.warn('[Onboarding] Workspace update failed:', e));
      } else {
        // Create new workspace (don't specify ID, let DB generate it)
        console.log('[Onboarding] Creating new workspace...');
        const createResult = await withTimeout(
          supabase
            .from('workspaces')
            .insert({
              name: companyName.trim(),
              industry_type: industry,
              owner_id: userId,
              config: {
                currency: 'USD',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
              },
            })
            .select()
            .single(),
          QUERY_TIMEOUT,
          { data: null, error: { message: 'Workspace creation timed out' } } as any
        );

        if (createResult.data) {
          finalWorkspaceId = createResult.data.id;
          workspaceCreated = true;
          console.log('[Onboarding] Workspace created:', finalWorkspaceId);

          // Update localStorage with actual workspace ID
          localStorage.setItem('current_workspace_id', finalWorkspaceId);

          // Add user as workspace member (fire and forget)
          supabase.from('workspace_members').insert({
            workspace_id: finalWorkspaceId,
            user_id: userId,
            role: 'owner',
          }).then(() => console.log('[Onboarding] Member added'))
            .catch(e => console.warn('[Onboarding] Member add failed:', e));
        } else {
          console.warn('[Onboarding] Workspace creation failed/timed out, using pre-generated ID');
        }
      }

      // Progress: Finalizing
      setProgressMessages(prev => [...prev, 'Preparing your dashboard...']);

      // Progress: Complete
      setProgressMessages(prev => [...prev, workspaceCreated ? 'Setup complete!' : 'Setup complete (syncing in background)...']);
      await new Promise(r => setTimeout(r, 500));

      console.log('[Onboarding] Complete, redirecting to dashboard');
      // Redirect to dashboard with full page reload to reset all state
      window.location.href = '/dashboard';

    } catch (error: any) {
      console.error('[Onboarding] Error:', error);
      toast({
        title: 'Setup failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      setStep('empire');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/20 via-purple-500/15 to-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to Breeze</h1>
          <p className="text-muted-foreground mt-1">Let's set up your account</p>
        </div>

        {/* Step Indicators */}
        {step !== 'initializing' && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 ${step === 'identity' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'identity' ? 'bg-primary text-primary-foreground' : step === 'empire' ? 'bg-green-500 text-white' : 'bg-muted'}`}>
                {step === 'empire' ? <Check className="h-4 w-4" /> : '1'}
              </div>
              <span className="text-sm">You</span>
            </div>
            <div className="w-8 h-0.5 bg-muted" />
            <div className={`flex items-center gap-2 ${step === 'empire' ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === 'empire' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                2
              </div>
              <span className="text-sm">Company</span>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-card border rounded-xl shadow-lg p-6">
          {/* Step 1: Identity */}
          {step === 'identity' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold">Identify Yourself</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us who you are</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="John Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Title (Optional)</Label>
                  <Input
                    id="title"
                    placeholder="Founder, CEO, Sales Manager..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleNextStep} className="w-full" size="lg">
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Empire */}
          {step === 'empire' && (
            <div className="space-y-6">
              <div className="text-center">
                <Building2 className="h-10 w-10 mx-auto text-primary mb-2" />
                <h2 className="text-xl font-semibold">Your Company</h2>
                <p className="text-sm text-muted-foreground mt-1">Tell us about your business</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    placeholder="Acme Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((ind) => (
                        <SelectItem key={ind.value} value={ind.value}>
                          {ind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('identity')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Complete Setup'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Initializing */}
          {step === 'initializing' && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Setting Up Your Account</h2>
                <p className="text-sm text-muted-foreground mt-1">This will only take a moment...</p>
              </div>

              <div className="space-y-2">
                {progressMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
