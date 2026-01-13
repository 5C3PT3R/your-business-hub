/**
 * V1 MODE: Single Sales CRM, conversation-first.
 * Pipeline is the primary home screen.
 * Stages locked: Lead → Qualified → Proposal → Closed
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, LayoutGrid, Table as TableIcon, Loader2, MessageSquare, TrendingUp } from 'lucide-react';
import { useDeals, DealStage } from '@/hooks/useDeals';
import { useActivities } from '@/hooks/useActivities';
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
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isConversationModalOpen, setIsConversationModalOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const { deals, loading, addDeal, updateDeal, deleteDeal } = useDeals();
  const { addActivity } = useActivities();

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

  const filteredDeals = deals.filter((deal) => {
    const matchesSearch = 
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStage = stageFilter === 'all' || deal.stage === stageFilter;
    
    return matchesSearch && matchesStage;
  });

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
      
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
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
        </div>

        {/* V1: Simplified Add Deal Dialog - essential fields only */}
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingDeal(null);
            setNewDeal({ title: '', company: '', value: '', stage: 'lead' });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDeal ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="deal-title">Title *</Label>
                <Input
                  id="deal-title"
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  placeholder="Enterprise License Deal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-company">Company</Label>
                <Input
                  id="deal-company"
                  value={newDeal.company}
                  onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-value">Value ($)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  value={newDeal.value}
                  onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-stage">Stage</Label>
                <Select value={newDeal.stage} onValueChange={(value) => setNewDeal({ ...newDeal, stage: value as DealStage })}>
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
              {/* V1: probability, expected_close_date, contact_id hidden */}
              <Button className="w-full" variant="gradient" onClick={handleAddDeal}>
                {editingDeal ? 'Save Changes' : 'Add Deal'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Conversation Modal */}
        <AddConversationModal
          open={isConversationModalOpen}
          onOpenChange={setIsConversationModalOpen}
          deals={deals}
          onAddConversation={handleAddConversation}
          onCreateDealWithConversation={handleCreateDealWithConversation}
        />

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!loading && deals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">No deals yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Start by adding a conversation or creating your first deal.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsConversationModalOpen(true)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Conversation
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                Add Deal
              </Button>
            </div>
          </div>
        )}

        {/* Pipeline View */}
        {!loading && deals.length > 0 && viewMode === 'pipeline' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4 animate-slide-up">
              {stages.map((stage) => {
                const stageDeals = getDealsByStage(stage.id);
                const totalValue = getStageValue(stage.id);

                return (
                  <DroppableColumn
                    key={stage.id}
                    id={stage.id}
                    name={stage.name}
                    color={stage.color}
                    count={stageDeals.length}
                    value={totalValue}
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
              {activeDeal && <DraggableDealCard deal={activeDeal} isDragging />}
            </DragOverlay>
          </DndContext>
        )}

        {/* Table View */}
        {!loading && deals.length > 0 && viewMode === 'table' && (
          <DealsTable 
            deals={filteredDeals} 
            stages={stages} 
            onUpdateDeal={updateDeal}
            onDealClick={handleDealClick}
          />
        )}
      </div>
    </MainLayout>
  );
}
