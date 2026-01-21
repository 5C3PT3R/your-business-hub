export type PlanType = 'FREE' | 'PRO_UNLIMITED' | 'AGENCY';

export interface Wallet {
  id: string;
  workspace_id: string;
  data_credits: number;
  ai_drafts_usage: number;
  plan_type: PlanType;
  created_at: string;
  updated_at: string;
}

export interface WalletUpdate {
  data_credits?: number;
  ai_drafts_usage?: number;
  plan_type?: PlanType;
}

export interface CreditTransaction {
  id: string;
  wallet_id: string;
  type: 'ENRICHMENT' | 'PURCHASE' | 'REFUND' | 'BONUS';
  amount: number;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CreditStatus {
  credits: number;
  status: 'low' | 'medium' | 'high';
  formatted: string;
  lowThreshold: number;
  mediumThreshold: number;
}

// Utility functions
export const walletUtils = {
  getCreditStatus(credits: number): CreditStatus {
    const lowThreshold = 10;
    const mediumThreshold = 50;
    
    let status: 'low' | 'medium' | 'high' = 'high';
    if (credits <= lowThreshold) {
      status = 'low';
    } else if (credits <= mediumThreshold) {
      status = 'medium';
    }
    
    return {
      credits,
      status,
      formatted: credits >= 1000 ? `${(credits / 1000).toFixed(1)}k` : credits.toString(),
      lowThreshold,
      mediumThreshold
    };
  },
  
  formatPlanType(planType: PlanType): string {
    const planLabels: Record<PlanType, string> = {
      FREE: 'Free',
      PRO_UNLIMITED: 'Pro Unlimited',
      AGENCY: 'Agency'
    };
    return planLabels[planType] || planType;
  },
  
  getPlanLimits(planType: PlanType): {
    maxCredits: number | null;
    maxAIUsage: number | null;
    hasUnlimitedAI: boolean;
  } {
    switch (planType) {
      case 'FREE':
        return { maxCredits: 50, maxAIUsage: null, hasUnlimitedAI: true };
      case 'PRO_UNLIMITED':
        return { maxCredits: 1000, maxAIUsage: null, hasUnlimitedAI: true };
      case 'AGENCY':
        return { maxCredits: null, maxAIUsage: null, hasUnlimitedAI: true };
      default:
        return { maxCredits: null, maxAIUsage: null, hasUnlimitedAI: true };
    }
  }
};