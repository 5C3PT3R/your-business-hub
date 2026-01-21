import { supabase } from '@/integrations/supabase/client';

export interface Wallet {
  id: string;
  workspace_id: string;
  data_credits: number;
  ai_drafts_usage: number;
  plan_type: string;
  created_at: string;
  updated_at: string;
}

export interface WalletService {
  getWallet(workspaceId: string): Promise<Wallet | null>;
  hasSufficientCredits(workspaceId: string, amount: number): Promise<boolean>;
  deductCredits(workspaceId: string, amount: number): Promise<boolean>;
  addCredits(workspaceId: string, amount: number): Promise<boolean>;
  trackAIUsage(workspaceId: string): Promise<boolean>;
}

class WalletServiceImpl implements WalletService {
  /**
   * Get wallet for a workspace
   */
  async getWallet(workspaceId: string): Promise<Wallet | null> {
    try {
      // Use a type assertion to bypass TypeScript errors
      // This will work once the types are regenerated
      const { data, error } = await (supabase as any)
        .from('wallets')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();
      
      if (error) {
        console.error('Error fetching wallet:', error);
        return null;
      }
      
      return data as Wallet;
    } catch (error) {
      console.error('Exception fetching wallet:', error);
      return null;
    }
  }

  /**
   * Check if workspace has sufficient credits
   */
  async hasSufficientCredits(workspaceId: string, amount: number): Promise<boolean> {
    try {
      if (amount <= 0) {
        console.error('Amount must be positive');
        return false;
      }

      const { data, error } = await (supabase as any)
        .rpc('has_sufficient_credits', {
          _workspace_id: workspaceId,
          _required_amount: amount
        });
      
      if (error) {
        console.error('Error checking credits:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Exception checking credits:', error);
      return false;
    }
  }

  /**
   * Deduct credits atomically (prevents race conditions)
   */
  async deductCredits(workspaceId: string, amount: number): Promise<boolean> {
    try {
      if (amount <= 0) {
        console.error('Amount must be positive');
        return false;
      }

      const { data, error } = await (supabase as any)
        .rpc('deduct_credits', {
          _workspace_id: workspaceId,
          _amount: amount
        });
      
      if (error) {
        console.error('Error deducting credits:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Exception deducting credits:', error);
      return false;
    }
  }

  /**
   * Add credits to wallet (for purchases, refunds, etc.)
   */
  async addCredits(workspaceId: string, amount: number): Promise<boolean> {
    try {
      if (amount <= 0) {
        console.error('Amount must be positive');
        return false;
      }

      const { data, error } = await (supabase as any)
        .rpc('add_credits', {
          _workspace_id: workspaceId,
          _amount: amount
        });
      
      if (error) {
        console.error('Error adding credits:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Exception adding credits:', error);
      return false;
    }
  }

  /**
   * Track AI usage (increments counter, unlimited)
   */
  async trackAIUsage(workspaceId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabase as any)
        .rpc('track_ai_usage', {
          _workspace_id: workspaceId
        });
      
      if (error) {
        console.error('Error tracking AI usage:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Exception tracking AI usage:', error);
      return false;
    }
  }

  /**
   * Get wallet with real-time subscription
   */
  subscribeToWallet(workspaceId: string, callback: (wallet: Wallet | null) => void) {
    const channel = (supabase as any)
      .channel(`wallet:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload: any) => {
          callback(payload.new as Wallet);
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }
}

// Export singleton instance
export const walletService: WalletService = new WalletServiceImpl();

// Utility functions for common operations
export const walletUtils = {
  /**
   * Safely perform an enrichment operation with credit check
   */
  async performEnrichment(workspaceId: string, operation: () => Promise<any>): Promise<{ success: boolean; error?: string }> {
    const hasCredits = await walletService.hasSufficientCredits(workspaceId, 1);
    
    if (!hasCredits) {
      return { 
        success: false, 
        error: 'Insufficient credits for enrichment operation' 
      };
    }

    try {
      // Perform the actual operation
      const result = await operation();
      
      // Deduct credit after successful operation
      const deducted = await walletService.deductCredits(workspaceId, 1);
      if (!deducted) {
        console.warn('Operation succeeded but failed to deduct credits');
      }
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Enrichment operation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Operation failed' 
      };
    }
  },

  /**
   * Track AI draft generation
   */
  async trackAIDraft(workspaceId: string): Promise<void> {
    await walletService.trackAIUsage(workspaceId);
  },

  /**
   * Format credits for display
   */
  formatCredits(credits: number): string {
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(1)}k`;
    }
    return credits.toString();
  },

  /**
   * Get credit status (low, medium, high)
   */
  getCreditStatus(credits: number): 'low' | 'medium' | 'high' {
    if (credits <= 10) return 'low';
    if (credits <= 50) return 'medium';
    return 'high';
  }
};