/**
 * Mobile Bottom Navigation Bar
 * Replaces sidebar on screens < 768px
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MessageSquare, Plus, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isAction?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: MessageSquare, label: 'Inbox', path: '/inbox' },
  { icon: Plus, label: 'Add', path: '', isAction: true },
  { icon: Users, label: 'Contacts', path: '/contacts' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function MobileNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleQuickAdd = (type: 'contact' | 'deal' | 'task' | 'lead') => {
    setQuickAddOpen(false);
    switch (type) {
      case 'contact':
        navigate('/contacts?action=new');
        break;
      case 'deal':
        navigate('/deals?action=new');
        break;
      case 'task':
        navigate('/tasks?action=new');
        break;
      case 'lead':
        navigate('/leads?action=new');
        break;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-background border-t border-gray-200 dark:border-white/10 md:hidden">
      {/* Safe area padding for notch devices */}
      <div className="pb-safe">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            if (item.isAction) {
              return (
                <Sheet key="quick-add" open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                  <SheetTrigger asChild>
                    <button className="flex flex-col items-center justify-center flex-1 h-full">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 -mt-5">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-auto rounded-t-3xl">
                    <SheetHeader>
                      <SheetTitle>Quick Add</SheetTitle>
                    </SheetHeader>
                    <div className="grid grid-cols-2 gap-3 py-6">
                      <Button
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        onClick={() => handleQuickAdd('contact')}
                      >
                        <Users className="h-6 w-6" />
                        <span>Contact</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        onClick={() => handleQuickAdd('deal')}
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Deal</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        onClick={() => handleQuickAdd('task')}
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span>Task</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-20 flex-col gap-2"
                        onClick={() => handleQuickAdd('lead')}
                      >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>Lead</span>
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors',
                  isActive(item.path)
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive(item.path) && 'text-primary')} />
                <span className="text-xs font-medium">{item.label}</span>
                {isActive(item.path) && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
