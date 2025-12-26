import { useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';

interface DotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface Dot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  element: HTMLDivElement;
}

export const DotGrid = ({
  dotSize = 3,
  gap = 24,
  baseColor = 'rgba(0, 0, 0, 0.1)',
  activeColor = 'rgba(59, 130, 246, 0.5)',
  proximity = 100,
  className = '',
  style = {}
}: DotGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  const createDots = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear existing dots
    container.innerHTML = '';
    dotsRef.current = [];

    const rect = container.getBoundingClientRect();
    const cols = Math.ceil(rect.width / gap);
    const rows = Math.ceil(rect.height / gap);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const dot = document.createElement('div');
        const x = col * gap + gap / 2;
        const y = row * gap + gap / 2;

        dot.style.cssText = `
          position: absolute;
          width: ${dotSize}px;
          height: ${dotSize}px;
          border-radius: 50%;
          background: ${baseColor};
          left: ${x}px;
          top: ${y}px;
          transform: translate(-50%, -50%);
          pointer-events: none;
          transition: background 0.2s ease;
        `;

        container.appendChild(dot);
        dotsRef.current.push({ x, y, baseX: x, baseY: y, element: dot });
      }
    }
  }, [dotSize, gap, baseColor]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    dotsRef.current.forEach(dot => {
      const dx = mouseRef.current.x - dot.baseX;
      const dy = mouseRef.current.y - dot.baseY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < proximity) {
        const intensity = 1 - distance / proximity;
        dot.element.style.background = activeColor;
        dot.element.style.transform = `translate(-50%, -50%) scale(${1 + intensity * 0.5})`;
      } else {
        dot.element.style.background = baseColor;
        dot.element.style.transform = 'translate(-50%, -50%) scale(1)';
      }
    });
  }, [proximity, baseColor, activeColor]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
    dotsRef.current.forEach(dot => {
      dot.element.style.background = baseColor;
      dot.element.style.transform = 'translate(-50%, -50%) scale(1)';
    });
  }, [baseColor]);

  useEffect(() => {
    createDots();

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    const handleResize = () => createDots();
    window.addEventListener('resize', handleResize);

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [createDots, handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-auto ${className}`}
      style={{ ...style }}
    />
  );
};
