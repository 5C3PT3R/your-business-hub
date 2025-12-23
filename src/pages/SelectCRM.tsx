import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { getAllIndustries, IndustryType } from '@/config/industryTemplates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, Loader2, ArrowLeft, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SelectCRM() {
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType | null>(null);
  const [loading, setLoading] = useState(false);
  const { createWorkspace, hasWorkspace, workspaces } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const industries = getAllIndustries();
  
  // Get list of industry types that already have workspaces
  const existingIndustryTypes = useMemo(() => {
    return new Set(workspaces.map(w => w.industry_type));
  }, [workspaces]);

  const handleSelectCRM = async () => {
    if (!selectedIndustry || !user) return;

    setLoading(true);
    const industry = industries.find(i => i.id === selectedIndustry);
    const workspaceName = industry?.name || 'My Workspace';

    const { error } = await createWorkspace(workspaceName, selectedIndustry);

    if (error) {
      toast({
        title: 'Failed to create workspace',
        description: error.message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    toast({
      title: 'Workspace created!',
      description: 'Your CRM is ready to use.',
    });

    navigate('/');
  };

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-glow">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-white">Upflo</span>
        </div>
        {hasWorkspace && (
          <Link to="/">
            <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        )}
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="text-center mb-10 max-w-2xl">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 animate-fade-in">
            {hasWorkspace ? 'Create New Workspace' : 'Choose Your CRM'}
          </h1>
          <p className="text-lg md:text-xl text-white/70 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {hasWorkspace 
              ? 'Add another CRM workspace to your account. Each workspace is independent with its own data.'
              : 'Select the CRM tailored for your industry. Each version is optimized with AI features specific to your workflow.'
            }
          </p>
        </div>

        {/* CRM Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl w-full mb-10">
{industries.map((industry, index) => {
            const Icon = industry.icon;
            const isSelected = selectedIndustry === industry.id;
            const alreadyExists = existingIndustryTypes.has(industry.id);
            
            return (
              <Card
                key={industry.id}
                className={cn(
                  'relative transition-all duration-300 border-2 bg-white/10 backdrop-blur-sm',
                  'animate-slide-up',
                  alreadyExists
                    ? 'opacity-60 cursor-not-allowed border-white/10'
                    : 'cursor-pointer hover:bg-white/15',
                  isSelected && !alreadyExists
                    ? 'border-white shadow-lg shadow-white/20 scale-[1.02]'
                    : !alreadyExists && 'border-white/20 hover:border-white/40'
                )}
                style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                onClick={() => !alreadyExists && setSelectedIndustry(industry.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl transition-all',
                        `bg-gradient-to-br ${industry.gradient}`,
                        alreadyExists && 'opacity-50'
                      )}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    {alreadyExists ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/20 px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" />
                        Created
                      </div>
                    ) : isSelected && (
                      <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center animate-scale-in">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                  <CardTitle className={cn("text-lg text-white mt-3", alreadyExists && "opacity-70")}>
                    {industry.name}
                  </CardTitle>
                  <CardDescription className={cn("text-white/60", alreadyExists && "opacity-70")}>
                    {industry.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {industry.enabledModules.slice(0, 3).map((module) => (
                      <span
                        key={module}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full bg-white/10 text-white/70",
                          alreadyExists && "opacity-60"
                        )}
                      >
                        {module.replace('_', ' ')}
                      </span>
                    ))}
                    {industry.enabledModules.length > 3 && (
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full bg-white/10 text-white/70",
                        alreadyExists && "opacity-60"
                      )}>
                        +{industry.enabledModules.length - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Get Started Button */}
        <Button
          size="lg"
          variant="gradient"
          className="min-w-[200px] h-12 text-base font-semibold animate-fade-in"
          style={{ animationDelay: '0.4s' }}
          disabled={!selectedIndustry || loading}
          onClick={handleSelectCRM}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </main>
    </div>
  );
}
