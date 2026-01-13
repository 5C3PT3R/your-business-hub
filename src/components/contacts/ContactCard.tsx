import { Button } from '@/components/ui/button';
import { Mail, Phone, Building, MoreHorizontal, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  contact: {
    id: string;
    name: string;
    email: string;
    phone: string;
    company: string;
    position: string;
    avatar?: string;
    is_favorite?: boolean;
  };
  onToggleFavorite?: (id: string) => void;
  onEmailClick?: (contact: any) => void;
  onEditClick?: (contact: any) => void;
  onDeleteClick?: (contact: any) => void;
}

export function ContactCard({ contact, onToggleFavorite, onEmailClick, onEditClick, onDeleteClick }: ContactCardProps) {
  const navigate = useNavigate();

  const initials = contact.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const handleCardClick = () => {
    navigate(`/contacts/${contact.id}`);
  };

  const handleDropdownAction = (action: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when clicking dropdown

    switch (action) {
      case 'view':
        navigate(`/contacts/${contact.id}`);
        break;
      case 'edit':
        if (onEditClick) {
          onEditClick(contact);
        }
        break;
      case 'delete':
        if (onDeleteClick) {
          onDeleteClick(contact);
        }
        break;
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(contact.id);
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEmailClick) {
      onEmailClick(contact);
    } else if (contact.email) {
      window.open(`mailto:${contact.email}`);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/30 cursor-pointer"
    >
      <div className="absolute right-4 top-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", contact.is_favorite && "opacity-100")}
          onClick={handleToggleFavorite}
        >
          <Star className={cn("h-4 w-4", contact.is_favorite && "fill-yellow-400 text-yellow-400")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => handleDropdownAction('view', e)}>
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleDropdownAction('edit', e)}>
              Edit Contact
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleDropdownAction('deal', e)}>
              Add to Deal
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => handleDropdownAction('delete', e)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full gradient-primary text-primary-foreground font-semibold text-lg">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{contact.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{contact.position || 'No position'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {contact.company && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4 shrink-0" />
            <span className="truncate">{contact.company}</span>
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span>{contact.phone}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-end">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleEmailClick}
            disabled={!contact.email}
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              if (contact.phone) window.open(`tel:${contact.phone}`);
            }}
            disabled={!contact.phone}
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
