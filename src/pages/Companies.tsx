/**
 * Companies Page - B2B Company Management
 * Kinetic Minimalist design matching Contacts page
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Globe,
  Users,
  DollarSign,
  MapPin,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  Pencil,
  Sparkles,
  Filter,
  SortAsc,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useCompanies, Company, CreateCompanyInput } from '@/hooks/useCompanies';
import { cn } from '@/lib/utils';

// Industry options
const industries = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Real Estate',
  'Education',
  'Consulting',
  'Marketing',
  'Legal',
  'Other',
];

// Employee count options
const employeeCounts = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

// Revenue range options
const revenueRanges = [
  '$0-1M',
  '$1M-10M',
  '$10M-50M',
  '$50M-100M',
  '$100M+',
];

// Create Company Dialog
function CreateCompanyDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateCompanyInput) => Promise<void>;
}) {
  const [formData, setFormData] = useState<CreateCompanyInput>({
    name: '',
    domain: '',
    industry: '',
    employee_count: '',
    revenue_range: '',
    location: '',
    website: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
    setFormData({
      name: '',
      domain: '',
      industry: '',
      employee_count: '',
      revenue_range: '',
      location: '',
      website: '',
      description: '',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Company</DialogTitle>
          <DialogDescription>Create a new company record</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Acme Inc"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                value={formData.domain || ''}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                placeholder="acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://acme.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={formData.industry || ''}
                onValueChange={(v) => setFormData({ ...formData, industry: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="San Francisco, CA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employees">Employees</Label>
              <Select
                value={formData.employee_count || ''}
                onValueChange={(v) => setFormData({ ...formData, employee_count: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {employeeCounts.map((count) => (
                    <SelectItem key={count} value={count}>
                      {count}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue Range</Label>
              <Select
                value={formData.revenue_range || ''}
                onValueChange={(v) => setFormData({ ...formData, revenue_range: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  {revenueRanges.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the company..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Company Row Component
function CompanyRow({
  company,
  onDelete,
  onEnrich,
}: {
  company: Company;
  onDelete: () => void;
  onEnrich: () => void;
}) {
  const navigate = useNavigate();

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => navigate(`/companies/${company.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 rounded-lg">
            <AvatarImage src={company.logo_url || undefined} />
            <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
              {getInitials(company.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{company.name}</p>
            {company.domain && (
              <p className="text-sm text-muted-foreground">{company.domain}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        {company.industry && (
          <Badge variant="secondary" className="font-normal">
            {company.industry}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{company.employee_count || '-'}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{company.location || '-'}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{company.contacts_count || 0} contacts</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{company.deals_count || 0}</span>
          <span className="text-muted-foreground">deals</span>
          {(company.total_deal_value || 0) > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 ml-1">
              ({formatCurrency(company.total_deal_value || 0)})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/companies/${company.id}`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            {company.website && (
              <DropdownMenuItem
                onClick={() => window.open(company.website!, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Website
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onEnrich}>
              <Sparkles className="h-4 w-4 mr-2" />
              Enrich Data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-24" />
        </div>
      ))}
    </div>
  );
}

// Main Companies Page
export default function Companies() {
  const {
    companies,
    loading,
    addCompany,
    deleteCompany,
    enrichCompany,
  } = useCompanies();
  const [searchQuery, setSearchQuery] = useState('');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filter companies
  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        company.name.toLowerCase().includes(searchLower) ||
        company.domain?.toLowerCase().includes(searchLower) ||
        company.industry?.toLowerCase().includes(searchLower) ||
        company.location?.toLowerCase().includes(searchLower);

      // Industry filter
      const matchesIndustry =
        industryFilter === 'all' || company.industry === industryFilter;

      return matchesSearch && matchesIndustry;
    });
  }, [companies, searchQuery, industryFilter]);

  // Get unique industries from companies
  const uniqueIndustries = useMemo(() => {
    const set = new Set(companies.map((c) => c.industry).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [companies]);

  const handleCreateCompany = async (data: CreateCompanyInput) => {
    await addCompany(data);
  };

  const handleDeleteCompany = async (id: string) => {
    if (confirm('Are you sure you want to delete this company?')) {
      await deleteCompany(id);
    }
  };

  const handleEnrichCompany = async (id: string) => {
    await enrichCompany(id);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Companies
            </h1>
            <p className="text-muted-foreground">
              Manage your B2B company relationships
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {uniqueIndustries.map((ind) => (
                <SelectItem key={ind} value={ind}>
                  {ind}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Total Companies</p>
            <p className="text-2xl font-bold">{companies.length}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Total Contacts</p>
            <p className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + (c.contacts_count || 0), 0)}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Active Deals</p>
            <p className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + (c.deals_count || 0), 0)}
            </p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <p className="text-sm text-muted-foreground">Pipeline Value</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              $
              {(
                companies.reduce((sum, c) => sum + (c.total_deal_value || 0), 0) / 1000
              ).toFixed(0)}
              k
            </p>
          </div>
        </div>

        {/* Companies Table */}
        <div className="rounded-lg border bg-card">
          {loading ? (
            <LoadingSkeleton />
          ) : filteredCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No companies found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || industryFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Get started by adding your first company'}
              </p>
              {!searchQuery && industryFilter === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>People</TableHead>
                  <TableHead>Deals</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    onDelete={() => handleDeleteCompany(company.id)}
                    onEnrich={() => handleEnrichCompany(company.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Create Dialog */}
        <CreateCompanyDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSubmit={handleCreateCompany}
        />
      </div>
    </MainLayout>
  );
}
