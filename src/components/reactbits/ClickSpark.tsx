import { useRef, useCallback, ReactNode } from 'react';

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: string;
  extraScale?: number;
  children?: ReactNode;
}

export const ClickSpark = ({
  sparkColor = 'hsl(217, 91%, 60%)',
  sparkSize = 10,
  sparkRadius = 20,
  sparkCount = 8,
  duration = 400,
  easing = 'ease-out',
  extraScale = 1,
  children
}: ClickSparkProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const createSpark = useCallback((x: number, y: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relX = x - rect.left;
    const relY = y - rect.top;

    for (let i = 0; i < sparkCount; i++) {
      const spark = document.createElement('div');
      const angle = (i / sparkCount) * Math.PI * 2;
      const endX = Math.cos(angle) * sparkRadius * extraScale;
      const endY = Math.sin(angle) * sparkRadius * extraScale;

      spark.style.cssText = `
        position: absolute;
        left: ${relX}px;
        top: ${relY}px;
        width: ${sparkSize}px;
        height: 2px;
        background: ${sparkColor};
        border-radius: 2px;
        pointer-events: none;
        transform: translate(-50%, -50%) rotate(${angle}rad);
        animation: spark-fly ${duration}ms ${easing} forwards;
        --end-x: ${endX}px;
        --end-y: ${endY}px;
      `;

      container.appendChild(spark);
      
      setTimeout(() => spark.remove(), duration);
    }
  }, [sparkColor, sparkSize, sparkRadius, sparkCount, duration, easing, extraScale]);

  const handleClick = (e: React.MouseEvent) => {
    createSpark(e.clientX, e.clientY);
  };

  return (
    <div 
      ref={containerRef} 
      onClick={handleClick}
      className="relative"
      style={{ isolation: 'isolate' }}
    >
      {children}
      <style>{`
        @keyframes spark-fly {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) rotate(var(--angle, 0)) translateX(0);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--end-x)), calc(-50% + var(--end-y))) rotate(var(--angle, 0)) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
};

// Trigger spark programmatically 
export const triggerSpark = (element: HTMLElement, options?: Partial<ClickSparkProps>) => {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  const {
    sparkColor = 'hsl(217, 91%, 60%)',
    sparkSize = 10,
    sparkRadius = 25,
    sparkCount = 8,
    duration = 400,
    extraScale = 1.2
  } = options || {};

  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement('div');
    const angle = (i / sparkCount) * Math.PI * 2;
    const endX = Math.cos(angle) * sparkRadius * extraScale;
    const endY = Math.sin(angle) * sparkRadius * extraScale;

    spark.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${sparkSize}px;
      height: 2px;
      background: ${sparkColor};
      border-radius: 2px;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%) rotate(${angle}rad);
    `;

    document.body.appendChild(spark);

    spark.animate([
      { 
        opacity: 1, 
        transform: `translate(-50%, -50%) rotate(${angle}rad) translateX(0)` 
      },
      { 
        opacity: 0, 
        transform: `translate(calc(-50% + ${endX}px), calc(-50% + ${endY}px)) rotate(${angle}rad) scale(0.5)` 
      }
    ], {
      duration,
      easing: 'ease-out',
      fill: 'forwards'
    });

    setTimeout(() => spark.remove(), duration);
  }
};
