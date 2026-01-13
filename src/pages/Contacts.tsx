import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useContacts } from '@/hooks/useContacts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutGrid, List, Plus, Loader2, Mail, Phone, Building, MoreHorizontal, Trash2, Edit, Undo2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DialerRecorder } from '@/components/voice/DialerRecorder';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ContactEmailDialog } from '@/components/contacts/ContactEmailDialog';
import { ContactCard } from '@/components/contacts/ContactCard';

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'customer', label: 'Customer' },
];

const countryCodes = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'IN' },
  { code: '+86', country: 'CN' },
  { code: '+81', country: 'JP' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+61', country: 'AU' },
  { code: '+55', country: 'BR' },
  { code: '+971', country: 'UAE' },
];

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [callingContact, setCallingContact] = useState<any>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailingContact, setEmailingContact] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'active' | 'inactive'>('all');
  const { contacts, loading, addContact, updateContact, deleteContact } = useContacts();
  const { toast } = useToast();

  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    countryCode: '+1',
    phone: '',
    company: '',
    position: '',
    status: 'active',
  });

  const filteredContacts = contacts.filter((contact) => {
    // Search filter
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    // Tab filter
    switch (activeFilter) {
      case 'favorites':
        return contact.is_favorite === true;
      case 'active':
        return contact.status === 'active';
      case 'inactive':
        return contact.status === 'inactive';
      default:
        return true;
    }
  });

  const handleAddContact = async () => {
    if (!newContact.name) return;
    
    const fullPhone = newContact.phone ? `${newContact.countryCode} ${newContact.phone}` : null;
    
    await addContact({
      name: newContact.name,
      email: newContact.email || null,
      phone: fullPhone,
      company: newContact.company || null,
      position: newContact.position || null,
      avatar_url: null,
      status: newContact.status,
    });
    
    setNewContact({ name: '', email: '', countryCode: '+1', phone: '', company: '', position: '', status: 'active' });
    setIsAddDialogOpen(false);
  };

  const handleEditContact = async () => {
    if (!editingContact?.name) return;
    
    await updateContact(editingContact.id, {
      name: editingContact.name,
      email: editingContact.email || null,
      phone: editingContact.phone || null,
      company: editingContact.company || null,
      position: editingContact.position || null,
      status: editingContact.status,
    });
    
    setEditingContact(null);
    setIsEditDialogOpen(false);
  };

  const handleDelete = async (contact: any) => {
    const contactData = { ...contact };
    const success = await deleteContact(contact.id);
    
    if (success) {
      toast({
        title: "Contact deleted",
        description: "The contact has been removed.",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleUndo(contactData)}
            className="gap-1"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
        ),
      });
    }
  };

  const handleUndo = async (contactData: any) => {
    await addContact({
      name: contactData.name,
      email: contactData.email,
      phone: contactData.phone,
      company: contactData.company,
      position: contactData.position,
      avatar_url: contactData.avatar_url,
      status: contactData.status,
    });
    toast({
      title: "Contact restored",
      description: "The contact has been restored.",
    });
  };

  const openEditDialog = (contact: any) => {
    setEditingContact({ ...contact });
    setIsEditDialogOpen(true);
  };

  const openCallDialog = (contact: any) => {
    setCallingContact(contact);
    setIsCallDialogOpen(true);
  };

  const handleToggleFavorite = async (id: string) => {
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    await updateContact(id, { is_favorite: !contact.is_favorite });
    toast({
      title: contact.is_favorite ? "Removed from favorites" : "Added to favorites",
      description: contact.is_favorite
        ? `${contact.name} has been removed from favorites.`
        : `${contact.name} has been added to favorites.`,
    });
  };

  const handleEmailClick = (contact: any) => {
    setEmailingContact(contact);
    setEmailDialogOpen(true);
  };

  const handleCallComplete = async (transcription: string, analysis: any, durationSeconds: number, twilioCallSid?: string) => {
    toast({
      title: "Call completed",
      description: `Call with ${callingContact?.name} has been logged.`,
    });
    setIsCallDialogOpen(false);
    setCallingContact(null);
  };

  return (
    <MainLayout>
      <Header
        title="Contacts"
        subtitle="Your business network and connections"
      />
      
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Button
            variant={activeFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('all')}
          >
            All Contacts
          </Button>
          <Button
            variant={activeFilter === 'favorites' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('favorites')}
            className="flex items-center gap-2"
          >
            <Star className="h-4 w-4" />
            Favorites
          </Button>
          <Button
            variant={activeFilter === 'active' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('active')}
          >
            Active
          </Button>
          <Button
            variant={activeFilter === 'inactive' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter('inactive')}
          >
            Inactive
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 rounded-lg border border-border p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="gradient">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="flex gap-2">
                      <Select value={newContact.countryCode} onValueChange={(value) => setNewContact({ ...newContact, countryCode: value })}>
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          {countryCodes.map((cc) => (
                            <SelectItem key={cc.code} value={cc.code}>
                              {cc.code} ({cc.country})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                        placeholder="555 123-4567"
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={newContact.company}
                      onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={newContact.position}
                      onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                      placeholder="CEO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={newContact.status} onValueChange={(value) => setNewContact({ ...newContact, status: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" variant="gradient" onClick={handleAddContact}>
                    Add Contact
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            {editingContact && (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editingContact.name}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingContact.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingContact.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input
                    id="edit-company"
                    value={editingContact.company || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Position</Label>
                  <Input
                    id="edit-position"
                    value={editingContact.position || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, position: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editingContact.status || 'active'} onValueChange={(value) => setEditingContact({ ...editingContact, status: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" variant="gradient" onClick={handleEditContact}>
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Call Dialog */}
        <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Call {callingContact?.name}</DialogTitle>
            </DialogHeader>
            {callingContact && (
              <DialerRecorder
                leadId={callingContact.id}
                leadName={callingContact.name}
                leadCompany={callingContact.company || undefined}
                leadPhone={callingContact.phone || undefined}
                onCallComplete={handleCallComplete}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Email Dialog */}
        {emailingContact && (
          <ContactEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            contact={emailingContact}
          />
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Contacts Grid */}
        {!loading && (
          <div
            className={cn(
              'grid gap-4 md:gap-6 animate-slide-up',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            )}
          >
            {filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="animate-fade-in"
              >
                <ContactCard
                  contact={contact}
                  onToggleFavorite={handleToggleFavorite}
                  onEmailClick={handleEmailClick}
                  onEditClick={openEditDialog}
                  onDeleteClick={handleDelete}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && filteredContacts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {searchQuery ? 'No contacts found matching your search.' : 'No contacts yet. Add your first contact!'}
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
