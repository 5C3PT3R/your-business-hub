import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { ContactCard } from '@/components/contacts/ContactCard';
import { useContacts } from '@/hooks/useContacts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, LayoutGrid, List, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { contacts, loading, addContact } = useContacts();

  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
  });

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (contact.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const handleAddContact = async () => {
    if (!newContact.name) return;
    
    await addContact({
      name: newContact.name,
      email: newContact.email || null,
      phone: newContact.phone || null,
      company: newContact.company || null,
      position: newContact.position || null,
      avatar_url: null,
      status: 'active',
    });
    
    setNewContact({ name: '', email: '', phone: '', company: '', position: '' });
    setIsAddDialogOpen(false);
  };

  return (
    <MainLayout>
      <Header
        title="Contacts"
        subtitle="Your business network and connections"
      />
      
      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex items-center justify-between gap-4 animate-fade-in">
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
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
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
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
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
                  <Button className="w-full" variant="gradient" onClick={handleAddContact}>
                    Add Contact
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
              'grid gap-6 animate-slide-up',
              viewMode === 'grid'
                ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            )}
          >
            {filteredContacts.map((contact, index) => (
              <div
                key={contact.id}
                style={{ animationDelay: `${index * 0.05}s` }}
                className="animate-fade-in"
              >
                <ContactCard contact={{
                  id: contact.id,
                  name: contact.name,
                  email: contact.email || '',
                  phone: contact.phone || '',
                  company: contact.company || '',
                  position: contact.position || '',
                  avatar: contact.avatar_url || '',
                }} />
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