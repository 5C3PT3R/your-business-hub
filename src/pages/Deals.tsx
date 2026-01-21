/**
 * V1 MODE: Single Sales CRM, conversation-first.
 * Pipeline is the primary home screen.
 * Stages locked: Lead → Qualified → Proposal → Closed
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, LayoutGrid, Table as TableIcon, Loader2, MessageSquare, TrendingUp } from 'lucide-react';
import { useDeals, DealStage } from '@/hooks/useDeals';
import { useActivities } from '@/hooks/useActivities';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DraggableDealCard } from '@/components/deals/DraggableDealCard';
import { DroppableColumn } from '@/components/deals/DroppableColumn';
import { DealsTable } from '@/components/deals/DealsTable';
import { AddConversationModal } from '@/components/deals/AddConversationModal';
import { useToast } from '@/hooks/use-toast';

// V1: Stages are locked - not editable
const stages: { id: DealStage; name: string; color: string }[] = [
  { id: 'lead', name: 'Lead', color: 'bg-muted' },
  { id: 'qualified', name: 'Qualified', color: 'bg-info' },
  { id: 'proposal', name: 'Proposal', color: 'bg-warning' },
  { id: 'closed', name: 'Closed', color: 'bg-success' },
];

export default function Deals() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const viewParam = searchParams.get('view');
  const isMobile = useIsMobile();

  // On mobile, default to 'list' view; on desktop, default to 'pipeline'
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [mobileStageFilter, setMobileStageFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const { deals, loading, addDeal, updateDeal, deleteDeal } = useDeals();
  const { addActivity } = useActivities();

  // Handle view mode from URL and mobile responsiveness
  useEffect(() => {
    if (viewParam === 'list') {
      setViewMode('table');
    }
  }, [viewParam]);

  // On mobile, force table/list view (Kanban doesn't work well)
  useEffect(() => {
    if (isMobile && viewMode === 'pipeline') {
      setViewMode('table');
    }
  }, [isMobile]);

  // V1: Simplified new deal form - only essential fields
  const [newDeal, setNewDeal] = useState({
    title: '',
    company: '',
    value: '',
    stage: 'lead' as DealStage,
  });

  const [editingDeal, setEditingDeal] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate filtered deals immediately after state declarations
  const filteredDeals = (deals || []).filter((deal) => {
    const matchesSearch =
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    const matchesStage = stageFilter === 'all' || deal.stage === stageFilter;

    // Handle filter from URL parameters
    let matchesFilter = true;
    if (filterParam) {
      const healthScore = deal.health_score ?? 50;
      const daysInStage = deal.days_in_stage ?? 0;

      switch (filterParam) {
        case 'hot':
          // Hot deals: high health score (80+) and active
          matchesFilter = healthScore >= 80 && deal.stage !== 'closed';
          break;
        case 'at-risk':
          // At risk: low health score (50-79) or has risk factors
          matchesFilter =
            (healthScore >= 30 && healthScore < 80) ||
            (deal.ai_risk_factors && deal.ai_risk_factors.length > 0);
          break;
        case 'stalled':
          // Stalled: deals sitting in stage for > 14 days
          matchesFilter = daysInStage > 14 && deal.stage !== 'closed';
          break;
        case 'won':
          // Closed won: deals in closed stage
          matchesFilter = deal.stage === 'closed';
          break;
        default:
          matchesFilter = true;
      }
    }

    return matchesSearch && matchesStage && matchesFilter;
  });

  // Filter deals for mobile stage filter
  const mobileFilteredDeals = filteredDeals.filter((deal) =>
    mobileStageFilter === 'all' || deal.stage === mobileStageFilter
  );

  const getDealsByStage = (stageId: DealStage) =>
    filteredDeals.filter((deal) => deal.stage === stageId);

  const getStageValue = (stageId: DealStage) =>
    getDealsByStage(stageId).reduce((sum, deal) => sum + deal.value, 0);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDealId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDealId(null);

    if (over && active.id !== over.id) {
      const dealId = active.id as string;
      const newStage = over.id as DealStage;
      
      if (stages.find(s => s.id === newStage)) {
        await updateDeal(dealId, { stage: newStage });
      }
    }
  };

  const handleAddDeal = async () => {
    if (!newDeal.title) return;

    if (editingDeal) {
      // Update existing deal
      await updateDeal(editingDeal, {
        title: newDeal.title,
        company: newDeal.company || null,
        value: parseFloat(newDeal.value) || 0,
        stage: newDeal.stage,
      });
      setEditingDeal(null);
    } else {
      // V1: Only save essential fields
      await addDeal({
        title: newDeal.title,
        company: newDeal.company || null,
        value: parseFloat(newDeal.value) || 0,
        stage: newDeal.stage,
        probability: 20, // V1: Default value, hidden from UI
        expected_close_date: null, // V1: Hidden from UI
        contact_id: null, // V1: Hidden from UI
      });
    }

    setNewDeal({
      title: '',
      company: '',
      value: '',
      stage: 'lead',
    });
    setIsAddDialogOpen(false);
  };

  const handleDealClick = (dealId: string) => {
    navigate(`/deal/${dealId}`);
  };

  const handleEditDeal = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      setNewDeal({
        title: deal.title,
        company: deal.company || '',
        value: deal.value.toString(),
        stage: deal.stage,
      });
      setEditingDeal(dealId);
      setIsAddDialogOpen(true);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (confirm('Are you sure you want to delete this deal?')) {
      await deleteDeal(dealId);
    }
  };

  const handleAddConversation = async (dealId: string, rawText: string): Promise<boolean> => {
    const result = await addActivity({
      type: 'conversation',
      description: 'Conversation added',
      raw_text: rawText,
      related_deal_id: dealId,
    });
    return !!result;
  };

  const handleCreateDealWithConversation = async (
    dealTitle: string,
    company: string,
    rawText: string
  ): Promise<boolean> => {
    const newDealData = await addDeal({
      title: dealTitle,
      company: company || null,
      value: 0,
      stage: 'lead',
      probability: 20,
      expected_close_date: null,
      contact_id: null,
    });

    if (!newDealData) {
      toast({
        title: "Error",
        description: "Failed to create deal.",
        variant: "destructive",
      });
      return false;
    }

    const activityResult = await addActivity({
      type: 'conversation',
      description: 'Conversation added',
      raw_text: rawText,
      related_deal_id: newDealData.id,
    });

    if (!activityResult) {
      toast({
        title: "Warning",
        description: "Deal created but failed to save conversation.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) : null;

  return (
    <MainLayout>
      <Header
        title="Pipeline"
        subtitle="Track and manage your deals"
        action={{
          label: 'Add Deal',
          onClick: () => setIsAddDialogOpen(true),
        }}
      />

      {/* Quick Actions Bar */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/forecast')}
            className="flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            View Forecast
          </Button>
        </div>
      </div>
      
      <div className="p-4 md:p-6 space-y-4 md:space-y-6 relative overflow-hidden min-h-[calc(100vh-8rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 rounded-full blur-2xl" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Stage</Label>
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All stages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setStageFilter('all')}
                  >
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full sm:w-auto"
              onClick={() => setIsConversationModalOpen(true)}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Add Conversation
            </Button>
          </div>
          
          {/* Mobile: Stage filter dropdown instead of view toggle */}
          {isMobile ? (
            <Select value={mobileStageFilter} onValueChange={setMobileStageFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-1 rounded-lg border border-border p-1 self-start">
              <Button
                variant={viewMode === 'pipeline' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('pipeline')}
              >
                <LayoutGrid className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Pipeline</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Table</span>
              </Button>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredDeals.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by adding your first deal or conversation
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Add Deal
              </Button>
              <Button variant="outline" onClick={() => setIsConversationModalOpen(true)}>
                Add Conversation
              </Button>
            </div>
          </div>
        )}

        {/* Pipeline View */}
        {!loading && filteredDeals.length > 0 && viewMode === 'pipeline' && !isMobile && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {stages.map((stage) => {
                const stageDeals = getDealsByStage(stage.id);
                return (
                  <DroppableColumn
                    key={stage.id}
                    id={stage.id}
                    name={stage.name}
                    color={stage.color}
                    count={stageDeals.length}
                    value={getStageValue(stage.id)}
                  >
                    {stageDeals.map((deal) => (
                      <DraggableDealCard
                        key={deal.id}
                        deal={deal}
                        onClick={() => handleDealClick(deal.id)}
                        onEdit={() => handleEditDeal(deal.id)}
                        onDelete={() => handleDeleteDeal(deal.id)}
                      />
                    ))}
                  </DroppableColumn>
                );
              })}
            </div>
            <DragOverlay>
              {activeDeal && (
                <DraggableDealCard
                  deal={activeDeal}
                  isDragging
                  onClick={() => handleDealClick(activeDeal.id)}
                  onEdit={() => handleEditDeal(activeDeal.id)}
                  onDelete={() => handleDeleteDeal(activeDeal.id)}
                />
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* Table View */}
        {!loading && filteredDeals.length > 0 && (viewMode === 'table' || isMobile) && (
          <DealsTable
            deals={isMobile ? mobileFilteredDeals : filteredDeals}
            stages={stages}
            onUpdateDeal={updateDeal}
            onDealClick={handleDealClick}
            isMobile={isMobile}
          />
        )}

        {/* Add Deal Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingDeal ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Deal Title *</Label>
                <Input
                  id="title"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  placeholder="e.g., Enterprise Contract"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={newDeal.company}
                  onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                  placeholder="e.g., Acme Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="value">Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                  placeholder="e.g., 50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select
                  value={newDeal.stage}
                  onValueChange={(value: DealStage) => setNewDeal({ ...newDeal, stage: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingDeal(null);
                    setNewDeal({
                      title: '',
                      company: '',
                      value: '',
                      stage: 'lead',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddDeal} disabled={!newDeal.title}>
                  {editingDeal ? 'Update Deal' : 'Add Deal'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Conversation Modal */}
        <AddConversationModal
          open={isConversationModalOpen}
          onOpenChange={setIsConversationModalOpen}
          onAddConversation={handleAddConversation}
          onCreateDealWithConversation={handleCreateDealWithConversation}
          deals={deals}
        />
      </div>
    </MainLayout>
  );
}
