/**
 * Company Detail Page - View and manage company information
 * With tabs for Overview, People, and Active Deals
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Globe,
  MapPin,
  Users,
  DollarSign,
  Phone,
  Mail,
  Linkedin,
  Calendar,
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  ExternalLink,
  Briefcase,
  Clock,
  TrendingUp,
  Loader2,
  Plus,
  ChevronRight,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompanies, Company } from '@/hooks/useCompanies';
import { cn } from '@/lib/utils';

// Contact type (minimal)
interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  avatar_url: string | null;
  status: string;
}

// Deal type (minimal)
interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  expected_close_date: string | null;
  created_at: string;
}

// Info Item Component
function InfoItem({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  href?: string;
}) {
  if (!value) return null;

  const content = (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
      >
        {content}
      </a>
    );
  }

  return content;
}

// Contact Card
function ContactCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={contact.avatar_url || undefined} />
        <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{contact.name}</p>
        <p className="text-sm text-muted-foreground truncate">
          {contact.position || contact.email || 'No details'}
        </p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// Deal Card
function DealCard({ deal, onClick }: { deal: Deal; onClick: () => void }) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);

  const stageColors: Record<string, string> = {
    lead: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    qualified: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    proposal: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    negotiation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    lost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium truncate flex-1">{deal.title}</h4>
        <Badge className={cn('ml-2 shrink-0', stageColors[deal.stage] || stageColors.lead)}>
          {deal.stage}
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(deal.value)}
        </span>
        <span className="text-muted-foreground">{deal.probability}% probability</span>
      </div>
      {deal.expected_close_date && (
        <p className="text-xs text-muted-foreground mt-2">
          Expected close: {new Date(deal.expected_close_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// Main Component
export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCompanyById, getCompanyContacts, getCompanyDeals, deleteCompany, enrichCompany } =
    useCompanies();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Load data
  useEffect(() => {
    async function loadData() {
      if (!id) return;

      setLoading(true);
      try {
        const [companyData, contactsData, dealsData] = await Promise.all([
          getCompanyById(id),
          getCompanyContacts(id),
          getCompanyDeals(id),
        ]);

        setCompany(companyData);
        setContacts(contactsData as Contact[]);
        setDeals(dealsData as Deal[]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, getCompanyById, getCompanyContacts, getCompanyDeals]);

  const handleDelete = async () => {
    if (!id) return;
    const success = await deleteCompany(id);
    if (success) {
      navigate('/companies');
    }
  };

  const handleEnrich = async () => {
    if (!id) return;
    setEnriching(true);
    await enrichCompany(id);
    // Reload company data
    const updated = await getCompanyById(id);
    setCompany(updated);
    setEnriching(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!company) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-screen">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Company not found</h2>
          <Button onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Companies
          </Button>
        </div>
      </MainLayout>
    );
  }

  const activeDeals = deals.filter((d) => !['won', 'lost'].includes(d.stage));
  const totalDealValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/companies')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Companies
        </Button>

        {/* Header */}
        <div className="flex items-start gap-6">
          <Avatar className="h-20 w-20 rounded-xl">
            <AvatarImage src={company.logo_url || undefined} />
            <AvatarFallback className="rounded-xl text-2xl bg-primary/10 text-primary">
              {getInitials(company.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
                {company.domain && (
                  <p className="text-muted-foreground">{company.domain}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {company.industry && (
                    <Badge variant="secondary">{company.industry}</Badge>
                  )}
                  {company.employee_count && (
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {company.employee_count}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {company.website && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(company.website!, '_blank')}
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Website
                  </Button>
                )}
                <Button variant="outline" onClick={handleEnrich} disabled={enriching}>
                  {enriching ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Enrich
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Contacts</span>
              </div>
              <p className="text-2xl font-bold mt-1">{contacts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Active Deals</span>
              </div>
              <p className="text-2xl font-bold mt-1">{activeDeals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Value</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalDealValue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Added</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {new Date(company.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="people">
              People ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="deals">
              Active Deals ({activeDeals.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Company Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Company Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoItem
                    icon={Globe}
                    label="Website"
                    value={company.website}
                    href={company.website || undefined}
                  />
                  <InfoItem icon={Briefcase} label="Industry" value={company.industry} />
                  <InfoItem icon={Users} label="Employees" value={company.employee_count} />
                  <InfoItem icon={DollarSign} label="Revenue" value={company.revenue_range} />
                  <InfoItem icon={Calendar} label="Founded" value={company.founded_year} />
                  <InfoItem
                    icon={Linkedin}
                    label="LinkedIn"
                    value={company.linkedin_url ? 'View Profile' : null}
                    href={company.linkedin_url || undefined}
                  />
                </CardContent>
              </Card>

              {/* Location Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <InfoItem icon={MapPin} label="Address" value={company.address} />
                  <InfoItem
                    icon={MapPin}
                    label="City"
                    value={[company.city, company.state].filter(Boolean).join(', ')}
                  />
                  <InfoItem icon={MapPin} label="Country" value={company.country} />
                  <InfoItem icon={MapPin} label="Postal Code" value={company.postal_code} />
                  <InfoItem icon={Phone} label="Phone" value={company.phone} />
                </CardContent>
              </Card>

              {/* Description */}
              {company.description && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {company.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Tech Stack */}
              {company.tech_stack && company.tech_stack.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Technology Stack</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {company.tech_stack.map((tech) => (
                        <Badge key={tech} variant="secondary">
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* People Tab */}
          <TabsContent value="people">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Contacts</CardTitle>
                  <CardDescription>People associated with this company</CardDescription>
                </div>
                <Button size="sm" onClick={() => navigate('/contacts')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No contacts linked to this company</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {contacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        onClick={() => navigate(`/contacts/${contact.id}`)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Active Deals</CardTitle>
                  <CardDescription>Open opportunities with this company</CardDescription>
                </div>
                <Button size="sm" onClick={() => navigate('/deals')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deal
                </Button>
              </CardHeader>
              <CardContent>
                {activeDeals.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No active deals with this company</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onClick={() => navigate(`/deal/${deal.id}`)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Company</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {company.name}? This action cannot be undone.
                Contacts and deals linked to this company will remain but lose their company
                association.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
