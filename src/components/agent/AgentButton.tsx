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
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
          "transition-all hover:scale-105 hover:shadow-xl"
        )}
      >
        <Bot className="h-6 w-6 text-white" />
      </Button>
      <AgentPopup open={open} onOpenChange={setOpen} />
    </>
  );
}