import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  Phone,
  Users,
  Plus,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { getAllPlatforms, getPlatformsByCategory } from '@/config/platforms';

interface EmptyInboxStateProps {
  onConnectPlatform?: () => void;
}

export function EmptyInboxState({ onConnectPlatform }: EmptyInboxStateProps) {
  const navigate = useNavigate();
  const allPlatforms = getAllPlatforms();
  const emailPlatforms = getPlatformsByCategory('email');
  const messagingPlatforms = getPlatformsByCategory('messaging');
  const socialPlatforms = getPlatformsByCategory('social');

  const handleConnectClick = () => {
    if (onConnectPlatform) {
      onConnectPlatform();
    } else {
      // Navigate to settings/integrations page
      navigate('/settings?tab=integrations');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[600px] p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Mail className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-yellow-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-yellow-900" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome to Your Unified Inbox
          </h2>
          <p className="text-base text-gray-600 max-w-md mx-auto">
            Connect your communication channels to see all messages in one place.
            Never miss an important conversation again.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 text-left">
            <MessageSquare className="h-5 w-5 text-blue-600 mb-2" />
            <h3 className="font-semibold text-sm text-gray-900 mb-1">
              All Channels
            </h3>
            <p className="text-xs text-gray-600">
              Email, social, messaging - all in one view
            </p>
          </Card>
          <Card className="p-4 text-left">
            <Users className="h-5 w-5 text-purple-600 mb-2" />
            <h3 className="font-semibold text-sm text-gray-900 mb-1">
              Unified Threads
            </h3>
            <p className="text-xs text-gray-600">
              See all messages with a contact across platforms
            </p>
          </Card>
          <Card className="p-4 text-left">
            <Sparkles className="h-5 w-5 text-yellow-600 mb-2" />
            <h3 className="font-semibold text-sm text-gray-900 mb-1">
              AI Insights
            </h3>
            <p className="text-xs text-gray-600">
              Smart sentiment analysis and prioritization
            </p>
          </Card>
        </div>

        {/* CTA */}
        <div className="space-y-4">
          <Button
            size="lg"
            onClick={handleConnectClick}
            className="h-12 px-8 text-base"
          >
            <Plus className="mr-2 h-5 w-5" />
            Connect Your First Platform
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Available Platforms Preview */}
        <div className="space-y-3 pt-4">
          <p className="text-sm font-medium text-gray-700">
            Available Platforms ({allPlatforms.length})
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Email */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100">
              <span className="text-sm font-medium text-gray-700">Email:</span>
              {emailPlatforms.slice(0, 2).map((platform) => (
                <span key={platform.platform} className="text-lg">
                  {platform.icon}
                </span>
              ))}
            </div>
            {/* Messaging */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100">
              <span className="text-sm font-medium text-gray-700">
                Messaging:
              </span>
              {messagingPlatforms.slice(0, 3).map((platform) => (
                <span key={platform.platform} className="text-lg">
                  {platform.icon}
                </span>
              ))}
            </div>
            {/* Social */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100">
              <span className="text-sm font-medium text-gray-700">Social:</span>
              {socialPlatforms.slice(0, 3).map((platform) => (
                <span key={platform.platform} className="text-lg">
                  {platform.icon}
                </span>
              ))}
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              +{allPlatforms.length - 8} more
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
