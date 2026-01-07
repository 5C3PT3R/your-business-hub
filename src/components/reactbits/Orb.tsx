import { useEffect, useRef, useCallback, useMemo } from 'react';

interface OrbProps {
  hue?: number;
  hoverIntensity?: number;
  rotateOnHover?: boolean;
  forceHoverState?: boolean;
  backgroundColor?: string;
  className?: string;
}

export const Orb = ({
  hue = 0,
  hoverIntensity = 0.2,
  rotateOnHover = true,
  forceHoverState = false,
  backgroundColor = 'transparent',
  className = ''
}: OrbProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const mouseRef = useRef({ x: 0.5, y: 0.5, isHovering: forceHoverState });

  const colors = useMemo(() => {
    const h = hue;
    return [
      `hsl(${h}, 70%, 60%)`,
      `hsl(${(h + 60) % 360}, 60%, 50%)`,
      `hsl(${(h + 120) % 360}, 70%, 55%)`,
    ];
  }, [hue]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw orbs
    const time = Date.now() * 0.001;
    
    colors.forEach((color, i) => {
      const angle = time * 0.5 + (i * Math.PI * 2) / colors.length;
      const offsetX = Math.cos(angle) * radius * 0.3;
      const offsetY = Math.sin(angle) * radius * 0.3;
      
      const gradient = ctx.createRadialGradient(
        centerX + offsetX,
        centerY + offsetY,
        0,
        centerX + offsetX,
        centerY + offsetY,
        radius
      );

      // Convert HSL to HSLA with opacity
      const colorWithAlpha = color.replace('hsl(', 'hsla(').replace(')', ', 0.53)');

      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, colorWithAlpha);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX + offsetX, centerY + offsetY, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    animationRef.current = requestAnimationFrame(draw);
  }, [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  return (
    <div 
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-30"
        style={{ filter: 'blur(60px)' }}
      />
    </div>
  );
};
