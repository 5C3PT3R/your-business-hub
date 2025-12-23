import { useState } from 'react';
import { mockLeads } from '@/data/mockData';
import { Lead } from '@/types/crm';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Mail, Phone, Edit, Trash2 } from 'lucide-react';

const statusColors = {
  new: 'bg-info/10 text-info border-info/20',
  contacted: 'bg-warning/10 text-warning border-warning/20',
  qualified: 'bg-success/10 text-success border-success/20',
  lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusLabels = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  lost: 'Lost',
};

export function LeadsTable() {
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedLeads.length === mockLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(mockLeads.map((lead) => lead.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((leadId) => leadId !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedLeads.length === mockLeads.length}
                onCheckedChange={toggleSelectAll}
              />
            </TableHead>
            <TableHead className="font-semibold">Name</TableHead>
            <TableHead className="font-semibold">Company</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Source</TableHead>
            <TableHead className="font-semibold text-right">Value</TableHead>
            <TableHead className="font-semibold">Created</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockLeads.map((lead) => (
            <TableRow
              key={lead.id}
              className="group transition-colors hover:bg-muted/30"
            >
              <TableCell>
                <Checkbox
                  checked={selectedLeads.includes(lead.id)}
                  onCheckedChange={() => toggleSelect(lead.id)}
                />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{lead.name}</p>
                  <p className="text-sm text-muted-foreground">{lead.email}</p>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{lead.company}</TableCell>
              <TableCell>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    statusColors[lead.status]
                  )}
                >
                  {statusLabels[lead.status]}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{lead.source}</TableCell>
              <TableCell className="text-right font-medium">
                ${lead.value.toLocaleString()}
              </TableCell>
              <TableCell className="text-muted-foreground">{lead.createdAt}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Email
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
