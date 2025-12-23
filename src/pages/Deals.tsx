import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { DealPipeline } from '@/components/deals/DealPipeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { useState } from 'react';

export default function Deals() {
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');

  return (
    <MainLayout>
      <Header
        title="Deals"
        subtitle="Track and manage your sales pipeline"
        action={{
          label: 'Add Deal',
          onClick: () => console.log('Add deal'),
        }}
      />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search deals..."
                className="pl-9 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
          
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
              variant={viewMode === 'pipeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('pipeline')}
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Pipeline
            </Button>
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Table
            </Button>
          </div>
        </div>

        {/* Pipeline View */}
        <div className="animate-slide-up">
          <DealPipeline />
        </div>
      </div>
    </MainLayout>
  );
}
