import { cn } from '@/lib/utils';
import { Platform, MessageStatus } from '@/types/inbox';
import {
  Mail,
  Linkedin,
  MessageCircle,
  Phone,
  Instagram,
  Facebook,
  MessageSquare,
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface PlatformIconProps {
  platform: Platform;
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  className?: string;
}

const platformConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  gmail: { icon: Mail, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Email' },
  outlook: { icon: Mail, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Email' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600', bgColor: 'bg-green-100', label: 'WhatsApp' },
  messenger: { icon: Facebook, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Messenger' },
  instagram: { icon: Instagram, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Instagram' },
  linkedin: { icon: Linkedin, color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'LinkedIn' },
  twilio_sms: { icon: Phone, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'SMS' },
  slack: { icon: MessageSquare, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Slack' },
  teams: { icon: MessageSquare, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Teams' },
  telegram: { icon: Send, color: 'text-blue-500', bgColor: 'bg-blue-100', label: 'Telegram' },
};

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function PlatformIcon({ platform, size = 'md', showBadge = false, className }: PlatformIconProps) {
  const config = platformConfig[platform] || { icon: Mail, color: 'text-gray-600', bgColor: 'bg-gray-100', label: platform };
  const Icon = config.icon;

  if (showBadge) {
    return (
      <div className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium', config.bgColor, config.color, className)}>
        <Icon className={sizeClasses[size]} />
        <span>{config.label}</span>
      </div>
    );
  }

  return <Icon className={cn(sizeClasses[size], config.color, className)} />;
}

// Message status indicator for WhatsApp-style delivery receipts
interface MessageStatusIconProps {
  status: MessageStatus;
  className?: string;
}

export function MessageStatusIcon({ status, className }: MessageStatusIconProps) {
  switch (status) {
    case 'pending':
      return <Clock className={cn('h-3 w-3 text-gray-400', className)} />;
    case 'sent':
      return <Check className={cn('h-3 w-3 text-gray-500', className)} />;
    case 'delivered':
      return <CheckCheck className={cn('h-3 w-3 text-gray-500', className)} />;
    case 'read':
      return <CheckCheck className={cn('h-3 w-3 text-blue-500', className)} />;
    case 'failed':
      return <AlertCircle className={cn('h-3 w-3 text-red-500', className)} />;
    default:
      return null;
  }
}

// Channel filter tabs
interface ChannelFilterProps {
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  counts: {
    all: number;
    email: number;
    whatsapp: number;
    social: number;
  };
}

export function ChannelFilters({ activeChannel, onChannelChange, counts }: ChannelFilterProps) {
  const channels = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'email', label: 'Email', count: counts.email, icon: Mail, color: 'text-red-600' },
    { id: 'whatsapp', label: 'WhatsApp', count: counts.whatsapp, icon: MessageCircle, color: 'text-green-600' },
    { id: 'social', label: 'Social', count: counts.social, icon: MessageSquare, color: 'text-blue-600' },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      {channels.map((channel) => {
        const Icon = channel.icon;
        const isActive = activeChannel === channel.id;

        return (
          <button
            key={channel.id}
            onClick={() => onChannelChange(channel.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {Icon && <Icon className={cn('h-4 w-4', isActive ? channel.color : '')} />}
            <span>{channel.label}</span>
            {channel.count > 0 && (
              <span className={cn(
                'ml-1 px-1.5 py-0.5 text-xs rounded-full',
                isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                {channel.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
