import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { AgentPopup } from './AgentPopup';
import { cn } from '@/lib/utils';

export function AgentButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-20 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-gradient-to-br from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700",
          "transition-all hover:scale-105 hover:shadow-xl"
        )}
      >
        <Bot className="h-6 w-6 text-white" />
      </Button>
      <AgentPopup open={open} onOpenChange={setOpen} />
    </>
  );
}