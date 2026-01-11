import React from 'react';
import { Card } from '@/components/ui/card';
import { DealHealthBadge } from './DealHealthBadge';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  MessageSquare,
  TrendingUp,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DealHealthMetrics {
  overallScore: number;
  recencyScore: number;
  engagementScore: number;
  momentumScore: number;
  responseScore: number;
  lastContactDays: number;
  conversationCount: number;
  avgResponseTime: number;
  stageProgress: number;
}

interface DealHealthCardProps {
  metrics: DealHealthMetrics;
}

export function DealHealthCard({ metrics }: DealHealthCardProps) {
  const healthFactors = [
    {
      icon: Clock,
      label: 'Recency',
      score: metrics.recencyScore,
      description: `Last contact ${metrics.lastContactDays} days ago`,
      color: metrics.lastContactDays > 7 ? 'text-red-600' : 'text-green-600',
    },
    {
      icon: MessageSquare,
      label: 'Engagement',
      score: metrics.engagementScore,
      description: `${metrics.conversationCount} conversations`,
      color: metrics.conversationCount > 5 ? 'text-green-600' : 'text-yellow-600',
    },
    {
      icon: TrendingUp,
      label: 'Momentum',
      score: metrics.momentumScore,
      description: `${metrics.stageProgress}% through pipeline`,
      color: metrics.momentumScore >= 70 ? 'text-green-600' : 'text-yellow-600',
    },
    {
      icon: Mail,
      label: 'Response Rate',
      score: metrics.responseScore,
      description: `Avg ${metrics.avgResponseTime}h response`,
      color: metrics.responseScore >= 70 ? 'text-green-600' : 'text-red-600',
    },
  ];

  const getRisks = () => {
    const risks = [];

    if (metrics.lastContactDays > 7) {
      risks.push(`No contact for ${metrics.lastContactDays} days`);
    }

    if (metrics.engagementScore < 50) {
      risks.push('Low engagement from prospect');
    }

    if (metrics.momentumScore < 40) {
      risks.push('Deal stalled in current stage');
    }

    if (metrics.responseScore < 50) {
      risks.push('Slow response times');
    }

    return risks;
  };

  const risks = getRisks();

  return (
    <Card className="p-5">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Deal Health</h3>
          <DealHealthBadge score={metrics.overallScore} size="lg" />
        </div>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Overall Health</span>
            <span className="font-semibold text-gray-900">{metrics.overallScore}/100</span>
          </div>
          <Progress value={metrics.overallScore} className="h-2" />
        </div>

        {/* Health Factors Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          {healthFactors.map((factor) => {
            const Icon = factor.icon;
            return (
              <div key={factor.label} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', factor.color)} />
                  <span className="text-sm font-medium text-gray-700">{factor.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={factor.score} className="h-1.5 flex-1" />
                  <span className="text-xs font-semibold text-gray-900 w-8 text-right">
                    {factor.score}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{factor.description}</p>
              </div>
            );
          })}
        </div>

        {/* Risks Section */}
        {risks.length > 0 && (
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-semibold text-gray-900">Risk Factors</span>
            </div>
            <ul className="space-y-1">
              {risks.map((risk, idx) => (
                <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
