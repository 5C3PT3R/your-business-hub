import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, LayoutGrid, Table as TableIcon, Loader2 } from 'lucide-react';
import { useDeals, DealStage } from '@/hooks/useDeals';
import { useContacts } from '@/hooks/useContacts';
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

const stages: { id: DealStage; name: string; color: string }[] = [
  { id: 'lead', name: 'Lead', color: 'bg-muted' },
  { id: 'qualified', name: 'Qualified', color: 'bg-info' },
  { id: 'proposal', name: 'Proposal', color: 'bg-warning' },
  { id: 'closed', name: 'Closed', color: 'bg-success' },
];

export default function Deals() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const { deals, loading, addDeal, updateDeal } = useDeals();
  const { contacts } = useContacts();

  const [newDeal, setNewDeal] = useState({
    title: '',
    company: '',
    value: '',
    stage: 'lead' as DealStage,
    probability: '20',
    expected_close_date: '',
    contact_id: '',
  });

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
    
    await addDeal({
      title: newDeal.title,
      company: newDeal.company || null,
      value: parseFloat(newDeal.value) || 0,
      stage: newDeal.stage,
      probability: parseInt(newDeal.probability) || 20,
      expected_close_date: newDeal.expected_close_date || null,
      contact_id: newDeal.contact_id || null,
    });
    
    setNewDeal({
      title: '',
      company: '',
      value: '',
      stage: 'lead',
      probability: '20',
      expected_close_date: '',
      contact_id: '',
    });
    setIsAddDialogOpen(false);
  };

  const handleDealClick = (dealId: string) => {
    navigate(`/deal/${dealId}`);
  };

  const activeDeal = activeDealId ? deals.find(d => d.id === activeDealId) : null;

  return (
    <MainLayout>
      <Header
        title="Deals"
        subtitle="Track and manage your sales pipeline"
        action={{
          label: 'Add Deal',
          onClick: () => setIsAddDialogOpen(true),
        }}
      />
      
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

        {/* Add Deal Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
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
              <div className="space-y-2">
                <Label htmlFor="deal-probability">Probability (%)</Label>
                <Input
                  id="deal-probability"
                  type="number"
                  value={newDeal.probability}
                  onChange={(e) => setNewDeal({ ...newDeal, probability: e.target.value })}
                  placeholder="50"
                  min="0"
                  max="100"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-close-date">Expected Close Date</Label>
                <Input
                  id="deal-close-date"
                  type="date"
                  value={newDeal.expected_close_date}
                  onChange={(e) => setNewDeal({ ...newDeal, expected_close_date: e.target.value })}
                />
              </div>
              {contacts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="deal-contact">Contact</Label>
                  <Select value={newDeal.contact_id} onValueChange={(value) => setNewDeal({ ...newDeal, contact_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" variant="gradient" onClick={handleAddDeal}>
                Add Deal
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Pipeline View */}
        {!loading && viewMode === 'pipeline' && (
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
        {!loading && viewMode === 'table' && (
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
