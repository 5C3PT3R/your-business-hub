import { ReactNode, ComponentType } from 'react';
import { cn } from '@/lib/utils';

interface StarBorderProps {
  as?: keyof JSX.IntrinsicElements | ComponentType<any>;
  className?: string;
  color?: string;
  speed?: string;
  thickness?: number;
  children?: ReactNode;
  [key: string]: any;
}

export const StarBorder = ({
  as: Component = 'button',
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 2,
  children,
  ...props
}: StarBorderProps) => {
  return (
    <Component
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl overflow-hidden',
        className
      )}
      style={{ padding: thickness }}
      {...props}
    >
      {/* Animated gradient border */}
      <div
        className="absolute inset-0 overflow-hidden rounded-xl"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: `star-border-spin ${speed} linear infinite`,
        }}
      />
      
      {/* Inner content container */}
      <div className="relative z-10 w-full h-full bg-background rounded-xl">
        {children}
      </div>
      
      <style>{`
        @keyframes star-border-spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Component>
  );
};
