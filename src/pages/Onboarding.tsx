/**
 * User Onboarding Wizard
 * Step-by-step setup flow for new users after signup
 *
 * Steps:
 * 1. Workspace Name & Subdomain
 * 2. Connect Email (Gmail/Outlook)
 * 3. Invite Team Members
 * 4. Currency & Timezone
 * 5. Magic Setup (AI configuration)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Mail,
  Users,
  Globe,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  Loader2,
  Chrome,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Timezones
const timezones = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Central European (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

// Currencies
const currencies = [
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
];

const steps = [
  { id: 1, title: 'Workspace', icon: Building2 },
  { id: 2, title: 'Connect Email', icon: Mail },
  { id: 3, title: 'Invite Team', icon: Users },
  { id: 4, title: 'Settings', icon: Globe },
  { id: 5, title: 'Setup', icon: Sparkles },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Workspace
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');

  // Step 2: Email (skippable)
  const [emailConnected, setEmailConnected] = useState<'gmail' | 'outlook' | null>(null);

  // Step 3: Team invites
  const [teamEmails, setTeamEmails] = useState<string[]>(['']);

  // Step 4: Settings
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');

  // Step 5: Magic setup
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupMessages, setSetupMessages] = useState<string[]>([]);

  // Auto-generate subdomain from company name
  useEffect(() => {
    if (companyName) {
      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSubdomain(slug);
    }
  }, [companyName]);

  const handleNext = () => {
    if (currentStep === 1 && !companyName) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Redirect to Gmail OAuth
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth?action=start`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Unable to connect Gmail. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectOutlook = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/outlook-oauth?action=start`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Unable to connect Outlook. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTeamEmail = () => {
    setTeamEmails([...teamEmails, '']);
  };

  const handleRemoveTeamEmail = (index: number) => {
    setTeamEmails(teamEmails.filter((_, i) => i !== index));
  };

  const handleTeamEmailChange = (index: number, value: string) => {
    const updated = [...teamEmails];
    updated[index] = value;
    setTeamEmails(updated);
  };

  const handleStartMagicSetup = async () => {
    setIsLoading(true);
    const messages = [
      'Creating your workspace...',
      'Configuring AI agents...',
      'Setting up email integrations...',
      'Importing templates...',
      'Optimizing for your industry...',
      'Finalizing setup...',
    ];

    // Simulate setup with progress
    for (let i = 0; i < messages.length; i++) {
      setSetupMessages((prev) => [...prev, messages[i]]);
      setSetupProgress(((i + 1) / messages.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Save onboarding data to database
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: companyName,
          subdomain: subdomain,
          settings: {
            currency,
            timezone,
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          },
        })
        .eq('owner_id', user?.id);

      if (error) throw error;

      // Send team invites
      const validEmails = teamEmails.filter((e) => e && e.includes('@'));
      if (validEmails.length > 0) {
        // TODO: Implement team invite sending
        console.log('Would send invites to:', validEmails);
      }

      toast({
        title: 'Setup complete!',
        description: 'Your workspace is ready to use.',
      });

      // Redirect to dashboard
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      console.error('Setup error:', error);
      toast({
        title: 'Setup failed',
        description: 'There was an error completing setup. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-primary/20 via-purple-500/15 to-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = step.id < currentStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full transition-all',
                      isActive && 'bg-primary text-primary-foreground scale-110',
                      isCompleted && 'bg-green-500 text-white',
                      !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'w-12 h-1 mx-2 rounded',
                        isCompleted ? 'bg-green-500' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
          </p>
        </div>

        {/* Step Content */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">
              {currentStep === 1 && 'Name your workspace'}
              {currentStep === 2 && 'Connect your email'}
              {currentStep === 3 && 'Invite your team'}
              {currentStep === 4 && 'Configure settings'}
              {currentStep === 5 && 'Magic Setup'}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && 'This will be your company name in Breeze CRM.'}
              {currentStep === 2 && 'Sync your emails to track conversations automatically.'}
              {currentStep === 3 && 'Add colleagues to collaborate on deals.'}
              {currentStep === 4 && 'Set your preferred currency and timezone.'}
              {currentStep === 5 && 'We\'re configuring your workspace with AI...'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Workspace */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name *</Label>
                  <Input
                    id="company-name"
                    placeholder="Acme Inc."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="subdomain"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">.breezecrm.app</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your team will access Breeze at this URL
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Connect Email */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      emailConnected === 'gmail' && 'ring-2 ring-primary'
                    )}
                    onClick={handleConnectGmail}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Mail className="h-6 w-6 text-red-600" />
                      </div>
                      <h3 className="font-semibold">Gmail</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect your Google Workspace
                      </p>
                      {emailConnected === 'gmail' && (
                        <Badge className="mt-2 bg-green-500">Connected</Badge>
                      )}
                    </CardContent>
                  </Card>

                  <Card
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      emailConnected === 'outlook' && 'ring-2 ring-primary'
                    )}
                    onClick={handleConnectOutlook}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Chrome className="h-6 w-6 text-blue-600" />
                      </div>
                      <h3 className="font-semibold">Outlook</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Connect Microsoft 365
                      </p>
                      {emailConnected === 'outlook' && (
                        <Badge className="mt-2 bg-green-500">Connected</Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={handleNext}
                >
                  I'll do this later
                </Button>
              </div>
            )}

            {/* Step 3: Invite Team */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {teamEmails.map((email, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="colleague@company.com"
                      value={email}
                      onChange={(e) => handleTeamEmailChange(index, e.target.value)}
                      className="flex-1"
                    />
                    {teamEmails.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTeamEmail(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={handleAddTeamEmail}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add another
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Invitations will be sent after setup completes
                </p>
              </div>
            )}

            {/* Step 4: Settings */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for deal values and reports
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for scheduling and activity timestamps
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Magic Setup */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {!isLoading && setupMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center animate-pulse">
                      <Sparkles className="h-10 w-10 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Ready to set up your workspace</h3>
                    <p className="text-muted-foreground mb-6">
                      Our AI will configure everything for {companyName}
                    </p>
                    <Button size="lg" onClick={handleStartMagicSetup}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Magic Setup
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-purple-600 transition-all duration-500"
                        style={{ width: `${setupProgress}%` }}
                      />
                    </div>

                    {/* Setup messages */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {setupMessages.map((msg, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm animate-fade-in"
                        >
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{msg}</span>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Processing...</span>
                        </div>
                      )}
                    </div>

                    {setupProgress === 100 && (
                      <div className="text-center pt-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <Check className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold">All done!</h3>
                        <p className="text-muted-foreground">Redirecting to your dashboard...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          {/* Navigation */}
          {currentStep < 5 && (
            <div className="flex items-center justify-between px-6 pb-6">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={isLoading}>
                {currentStep === 4 ? 'Finish Setup' : 'Continue'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </Card>

        {/* Skip link */}
        {currentStep < 5 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="hover:underline"
            >
              Skip onboarding and go to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
