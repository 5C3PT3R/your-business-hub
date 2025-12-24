import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useAuth } from '@/hooks/useAuth';
import { getAllIndustries, IndustryType } from '@/config/industryTemplates';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, ArrowLeft, Check } from 'lucide-react';
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background font-bold text-sm">U</span>
          </div>
          <span className="text-lg font-semibold">Upflo</span>
        </div>
        {hasWorkspace && (
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-4xl">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-2xl md:text-3xl font-semibold mb-3">
              {hasWorkspace ? 'Create New Workspace' : 'Choose Your CRM'}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              {hasWorkspace 
                ? 'Add another workspace to your account'
                : 'Select the CRM tailored for your industry'
              }
            </p>
          </div>

          {/* CRM Grid - 4 equal columns */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {industries.map((industry) => {
              const Icon = industry.icon;
              const isSelected = selectedIndustry === industry.id;
              const alreadyExists = existingIndustryTypes.has(industry.id);
              
              return (
                <button
                  key={industry.id}
                  disabled={alreadyExists}
                  onClick={() => setSelectedIndustry(industry.id)}
                  className={cn(
                    'relative p-6 rounded-xl border-2 transition-all text-left',
                    'hover:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    alreadyExists
                      ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                      : 'cursor-pointer bg-card',
                    isSelected && !alreadyExists
                      ? 'border-foreground shadow-lg'
                      : 'border-border'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'h-12 w-12 rounded-xl flex items-center justify-center mb-4',
                      `bg-gradient-to-br ${industry.gradient}`
                    )}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="font-medium mb-1">{industry.name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {industry.description}
                  </p>

                  {/* Status badges */}
                  {alreadyExists && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
                      <Check className="h-3 w-3" />
                      Active
                    </div>
                  )}
                  {isSelected && !alreadyExists && (
                    <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-foreground flex items-center justify-center">
                      <Check className="h-3 w-3 text-background" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Get Started Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              className="min-w-[200px] gap-2"
              disabled={!selectedIndustry || loading}
              onClick={handleSelectCRM}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}