import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { walletService } from '@/lib/wallet-service';
import { Wallet, PlanType } from '@/types/wallet';
import { useWorkspace } from './useWorkspace';

export function useWallet(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const targetWorkspaceId = workspaceId || workspace?.id;

  // Main query to fetch wallet data
  const {
    data: wallet,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wallet', targetWorkspaceId],
    queryFn: async () => {
      if (!targetWorkspaceId) {
        throw new Error('No workspace ID available');
      }
      
      const walletData = await walletService.getWallet(targetWorkspaceId);
      if (!walletData) {
        throw new Error('Wallet not found');
      }
      
      return walletData;
    },
    enabled: !!targetWorkspaceId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Set up real-time subscription for wallet updates
  useEffect(() => {
    if (!targetWorkspaceId) return;

    let subscription: any;

    const setupSubscription = async () => {
      // Create subscription to wallets table
      subscription = (supabase as any)
        .channel(`wallet-updates-${targetWorkspaceId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'wallets',
            filter: `workspace_id=eq.${targetWorkspaceId}`,
          },
          (payload: any) => {
            console.log('Wallet updated via realtime:', payload.new);
            
            // Update the query cache with new data
            queryClient.setQueryData(['wallet', targetWorkspaceId], payload.new);
            
            // Also invalidate to trigger a refetch if needed
            queryClient.invalidateQueries({
              queryKey: ['wallet', targetWorkspaceId],
              refetchType: 'active',
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'wallets',
            filter: `workspace_id=eq.${targetWorkspaceId}`,
          },
          (payload: any) => {
            console.log('Wallet created via realtime:', payload.new);
            queryClient.setQueryData(['wallet', targetWorkspaceId], payload.new);
          }
        )
        .subscribe((status: any) => {
          console.log('Wallet subscription status:', status);
        });
    };

    setupSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        (supabase as any).removeChannel(subscription);
      }
    };
  }, [targetWorkspaceId, queryClient]);

  // Helper functions
  const hasSufficientCredits = async (amount: number): Promise<boolean> => {
    if (!targetWorkspaceId) return false;
    return walletService.hasSufficientCredits(targetWorkspaceId, amount);
  };

  const deductCredits = async (amount: number): Promise<boolean> => {
    if (!targetWorkspaceId) return false;
    return walletService.deductCredits(targetWorkspaceId, amount);
  };

  const addCredits = async (amount: number): Promise<boolean> => {
    if (!targetWorkspaceId) return false;
    return walletService.addCredits(targetWorkspaceId, amount);
  };

  const trackAIUsage = async (): Promise<boolean> => {
    if (!targetWorkspaceId) return false;
    return walletService.trackAIUsage(targetWorkspaceId);
  };

  // Credit status utilities
  const getCreditStatus = () => {
    if (!wallet) return null;
    
    const credits = wallet.data_credits;
    if (credits <= 10) return 'low';
    if (credits <= 50) return 'medium';
    return 'high';
  };

  const formatCredits = () => {
    if (!wallet) return '0';
    
    const credits = wallet.data_credits;
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}k`;
    }
    return credits.toString();
  };

  return {
    // Data
    wallet,
    isLoading,
    error,
    
    // Actions
    refetch,
    hasSufficientCredits,
    deductCredits,
    addCredits,
    trackAIUsage,
    
    // Derived state
    creditStatus: getCreditStatus(),
    formattedCredits: formatCredits(),
    hasLowCredits: getCreditStatus() === 'low',
    hasMediumCredits: getCreditStatus() === 'medium',
    hasHighCredits: getCreditStatus() === 'high',
    
    // Convenience
    credits: wallet?.data_credits || 0,
    aiUsage: wallet?.ai_drafts_usage || 0,
    planType: wallet?.plan_type as PlanType || 'FREE',
    
    // Validation
    hasWorkspace: !!targetWorkspaceId,
    workspaceId: targetWorkspaceId,
  };
}

// Hook for checking credits before performing an operation
export function useCreditCheck(amount: number = 1) {
  const { wallet, hasSufficientCredits, isLoading } = useWallet();
  
  return {
    canProceed: wallet ? wallet.data_credits >= amount : false,
    isLoading,
    creditsNeeded: amount,
    availableCredits: wallet?.data_credits || 0,
    hasSufficientCredits: () => hasSufficientCredits(amount),
  };
}