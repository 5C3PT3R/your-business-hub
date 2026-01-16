import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBackgroundProps {
  className?: string;
  variant?: 'mesh' | 'dots' | 'grid' | 'aurora';
  intensity?: 'subtle' | 'medium' | 'strong';
}

export function AnimatedBackground({
  className,
  variant = 'mesh',
  intensity = 'subtle',
}: AnimatedBackgroundProps) {
  const opacityMap = {
    subtle: 'opacity-30',
    medium: 'opacity-50',
    strong: 'opacity-70',
  };

  if (variant === 'mesh') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        {/* Gradient orbs */}
        <div
          className={cn(
            'absolute w-[500px] h-[500px] rounded-full blur-3xl',
            'bg-gradient-to-r from-primary/20 to-accent/20',
            'animate-float',
            opacityMap[intensity]
          )}
          style={{ top: '10%', left: '20%' }}
        />
        <div
          className={cn(
            'absolute w-[400px] h-[400px] rounded-full blur-3xl',
            'bg-gradient-to-r from-accent/20 to-primary/20',
            'animate-float delay-200',
            opacityMap[intensity]
          )}
          style={{ top: '50%', right: '10%' }}
        />
        <div
          className={cn(
            'absolute w-[300px] h-[300px] rounded-full blur-3xl',
            'bg-gradient-to-r from-primary/15 to-purple-500/15',
            'animate-float delay-500',
            opacityMap[intensity]
          )}
          style={{ bottom: '20%', left: '30%' }}
        />
      </div>
    );
  }

  if (variant === 'dots') {
    return (
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          opacityMap[intensity],
          className
        )}
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--muted-foreground)) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />
    );
  }

  if (variant === 'grid') {
    return (
      <div
        className={cn(
          'absolute inset-0 pointer-events-none',
          opacityMap[intensity],
          className
        )}
        style={{
          backgroundImage: `
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
    );
  }

  if (variant === 'aurora') {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        <div
          className={cn(
            'absolute inset-0',
            'bg-gradient-to-br from-primary/5 via-transparent to-accent/5',
            opacityMap[intensity]
          )}
        />
        <div
          className={cn(
            'absolute -top-1/2 -left-1/2 w-full h-full',
            'bg-gradient-conic from-primary/10 via-accent/5 to-primary/10',
            'animate-spin-slow',
            opacityMap[intensity]
          )}
          style={{ animationDuration: '30s' }}
        />
      </div>
    );
  }

  return null;
}

// Spotlight effect that follows mouse
interface SpotlightProps {
  className?: string;
  size?: number;
}

export function Spotlight({ className, size = 400 }: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      container.style.setProperty('--mouse-x', `${x}px`);
      container.style.setProperty('--mouse-y', `${y}px`);
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
    >
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          width: size,
          height: size,
          left: 'var(--mouse-x, 50%)',
          top: 'var(--mouse-y, 50%)',
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

// Gradient border that animates
interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
  borderWidth?: number;
  animate?: boolean;
}

export function GradientBorder({
  children,
  className,
  borderWidth = 1,
  animate = true,
}: GradientBorderProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl p-[1px]',
        animate && 'animate-gradient',
        className
      )}
      style={{
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #d946ef 100%)',
        backgroundSize: animate ? '200% 200%' : '100% 100%',
        padding: borderWidth,
      }}
    >
      <div className="relative rounded-[11px] bg-card h-full">{children}</div>
    </div>
  );
}

// Glow effect wrapper
interface GlowWrapperProps {
  children: React.ReactNode;
  className?: string;
  color?: 'primary' | 'accent' | 'success' | 'warning' | 'destructive';
  intensity?: 'sm' | 'md' | 'lg';
}

export function GlowWrapper({
  children,
  className,
  color = 'primary',
  intensity = 'md',
}: GlowWrapperProps) {
  const colorMap = {
    primary: 'shadow-[0_0_30px_hsl(var(--primary)/0.3)]',
    accent: 'shadow-[0_0_30px_hsl(var(--accent)/0.3)]',
    success: 'shadow-[0_0_30px_hsl(var(--success)/0.3)]',
    warning: 'shadow-[0_0_30px_hsl(var(--warning)/0.3)]',
    destructive: 'shadow-[0_0_30px_hsl(var(--destructive)/0.3)]',
  };

  const intensityMap = {
    sm: 'hover:shadow-[0_0_20px_hsl(var(--primary)/0.2)]',
    md: 'hover:shadow-[0_0_40px_hsl(var(--primary)/0.3)]',
    lg: 'hover:shadow-[0_0_60px_hsl(var(--primary)/0.4)]',
  };

  return (
    <div
      className={cn(
        'transition-shadow duration-300',
        colorMap[color],
        intensityMap[intensity],
        className
      )}
    >
      {children}
    </div>
  );
}
