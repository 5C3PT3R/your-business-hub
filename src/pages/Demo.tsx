/**
 * V1 MODE: Demo experience - no login required
 * Loads a seeded demo workspace with sample data
 * Destructive actions are disabled
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Loader2, 
  MessageSquarePlus, 
  LayoutGrid, 
  List, 
  Info, 
  X,
  Sparkles,
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

// Demo data - seeded sample deals
const DEMO_DEALS = [
  {
    id: "demo-1",
    title: "Acme Corp Enterprise Deal",
    company: "Acme Corporation",
    value: 75000,
    stage: "qualified" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    title: "TechStart Software License",
    company: "TechStart Inc",
    value: 25000,
    stage: "proposal" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    title: "GlobalRetail Partnership",
    company: "GlobalRetail",
    value: 150000,
    stage: "lead" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "demo-4",
    title: "MedTech Solutions Contract",
    company: "MedTech Solutions",
    value: 50000,
    stage: "closed" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function Demo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showBanner, setShowBanner] = useState(true);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Simulate loading demo workspace
    const timer = setTimeout(() => {
      setLoading(false);
      toast({
        title: "Demo workspace loaded",
        description: "Explore the pipeline and try adding a conversation!",
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleDemoAction = (action: string) => {
    toast({
      title: "Demo mode",
      description: `${action} is disabled in demo mode. Sign up to use this feature!`,
      variant: "destructive",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading demo workspace...</p>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Upflo Demo</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-4 space-y-2">
        <Button variant="secondary" className="w-full justify-start gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Pipeline
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2"
          onClick={() => handleDemoAction("Contacts page")}
        >
          <Users className="h-4 w-4" />
          Contacts
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2"
          onClick={() => handleDemoAction("Tasks page")}
        >
          <CheckSquare className="h-4 w-4" />
          Tasks
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2"
          onClick={() => handleDemoAction("Settings page")}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </nav>

      {/* Sign Up CTA */}
      <div className="p-4 border-t border-border">
        <Button 
          className="w-full" 
          onClick={() => navigate("/auth")}
        >
          Sign Up Free
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 h-full w-60 bg-sidebar border-r border-sidebar-border">
          <SidebarContent />
        </aside>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-40 flex items-center px-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-60">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 ml-3">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Upflo Demo</span>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-200",
        isMobile ? "pt-14" : "pl-60"
      )}>
        {/* Demo Banner */}
        {showBanner && (
          <div className="bg-primary/10 border-b border-primary/20 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium">
                  You're viewing a demo workspace.{" "}
                  <button
                    onClick={() => navigate("/auth")}
                    className="text-primary underline hover:no-underline"
                  >
                    Sign up
                  </button>{" "}
                  to create your own.
                </p>
              </div>
              <button
                onClick={() => setShowBanner(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Pipeline</h1>
              <p className="text-muted-foreground">Demo Sales CRM</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsConversationModalOpen(true)}
                className="gap-2"
              >
                <MessageSquarePlus className="h-4 w-4" />
                Add Conversation
              </Button>
            </div>
          </div>

          {/* View Toggle */}
          <Tabs value={view} onValueChange={(v) => setView(v as "pipeline" | "table")}>
            <TabsList>
              <TabsTrigger value="pipeline" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <List className="h-4 w-4" />
                Table
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline" className="mt-6">
              <DemoPipeline deals={DEMO_DEALS} onAction={handleDemoAction} />
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              <DemoTable deals={DEMO_DEALS} onAction={handleDemoAction} />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Demo Conversation Modal */}
      <DemoConversationModal
        open={isConversationModalOpen}
        onOpenChange={setIsConversationModalOpen}
        deals={DEMO_DEALS}
        onSubmit={(dealId, text) => {
          toast({
            title: "Demo mode",
            description: "Conversation saved! In the full app, AI would now analyze this.",
          });
          setIsConversationModalOpen(false);
        }}
      />
    </div>
  );
}

// Demo Conversation Modal
function DemoConversationModal({
  open,
  onOpenChange,
  deals,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: typeof DEMO_DEALS;
  onSubmit: (dealId: string, text: string) => void;
}) {
  const [text, setText] = useState("");
  const [selectedDeal, setSelectedDeal] = useState("");

  const handleSubmit = () => {
    if (!text.trim() || !selectedDeal) return;
    onSubmit(selectedDeal, text);
    setText("");
    setSelectedDeal("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" />
            Add Conversation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Conversation *</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste call transcript, meeting notes, or chat here…"
              className="min-h-[150px] resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label>Link to Deal *</Label>
            <Select value={selectedDeal} onValueChange={setSelectedDeal}>
              <SelectTrigger>
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.title} ({deal.company})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={!text.trim() || !selectedDeal}>
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              Save Conversation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Demo Pipeline Component
function DemoPipeline({ 
  deals, 
  onAction 
}: { 
  deals: typeof DEMO_DEALS;
  onAction: (action: string) => void;
}) {
  const stages = ["lead", "qualified", "proposal", "closed"] as const;
  const stageLabels: Record<string, string> = {
    lead: "Lead",
    qualified: "Qualified",
    proposal: "Proposal",
    closed: "Closed",
  };

  const getDealsByStage = (stage: string) => deals.filter((d) => d.stage === stage);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {stages.map((stage) => (
        <div key={stage} className="bg-muted/30 rounded-lg p-4 min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{stageLabels[stage]}</h3>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {getDealsByStage(stage).length}
            </span>
          </div>
          <div className="space-y-3">
            {getDealsByStage(stage).map((deal) => (
              <div
                key={deal.id}
                className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onAction("View deal details")}
              >
                <h4 className="font-medium text-sm mb-1">{deal.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{deal.company}</p>
                <p className="text-sm font-semibold text-primary">
                  ${deal.value?.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Demo Table Component
function DemoTable({ 
  deals, 
  onAction 
}: { 
  deals: typeof DEMO_DEALS;
  onAction: (action: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-4 text-sm font-medium">Deal</th>
            <th className="text-left p-4 text-sm font-medium hidden sm:table-cell">Company</th>
            <th className="text-left p-4 text-sm font-medium">Value</th>
            <th className="text-left p-4 text-sm font-medium">Stage</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr
              key={deal.id}
              className="border-t border-border hover:bg-muted/30 cursor-pointer"
              onClick={() => onAction("View deal details")}
            >
              <td className="p-4 text-sm font-medium">{deal.title}</td>
              <td className="p-4 text-sm text-muted-foreground hidden sm:table-cell">{deal.company}</td>
              <td className="p-4 text-sm font-semibold text-primary">
                ${deal.value?.toLocaleString()}
              </td>
              <td className="p-4">
                <span className="text-xs bg-muted px-2 py-1 rounded capitalize">
                  {deal.stage}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
