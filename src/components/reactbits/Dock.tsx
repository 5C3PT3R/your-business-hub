import { useRef, ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DockItemData {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  isActive?: boolean;
}

interface DockProps {
  items: DockItemData[];
  className?: string;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  magnification?: number;
}

interface DockItemProps extends DockItemData {
  mouseX: any;
  distance: number;
  baseItemSize: number;
  magnification: number;
}

const DockItem = ({
  icon,
  label,
  onClick,
  className,
  isActive,
  mouseX,
  distance,
  baseItemSize,
  magnification
}: DockItemProps) => {
  const ref = useRef<HTMLDivElement>(null);

  const distanceCalc = useTransform(mouseX, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distanceCalc, [-distance, 0, distance], [
    baseItemSize,
    magnification,
    baseItemSize
  ]);

  const width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12
  });

  return (
    <motion.div
      ref={ref}
      style={{ width, height: width }}
      onClick={onClick}
      className={cn(
        'relative flex items-center justify-center rounded-2xl cursor-pointer',
        'bg-card/80 backdrop-blur-sm border border-border/50',
        'hover:bg-card hover:border-border transition-colors duration-200',
        isActive && 'bg-primary/10 border-primary/30',
        className
      )}
    >
      <div className="flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors">
        {icon}
      </div>
      
      {/* Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
        <div className="px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md whitespace-nowrap border border-border shadow-lg">
          {label}
        </div>
      </div>
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
      )}
    </motion.div>
  );
};

export const Dock = ({
  items,
  className = '',
  distance = 150,
  panelHeight = 56,
  baseItemSize = 44,
  magnification = 64
}: DockProps) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        'flex items-end gap-2 px-3 py-2 rounded-2xl',
        'bg-card/60 backdrop-blur-xl border border-border/50',
        'shadow-lg',
        className
      )}
      style={{ height: panelHeight + 16 }}
    >
      {items.map((item, i) => (
        <div key={i} className="group">
          <DockItem
            {...item}
            mouseX={mouseX}
            distance={distance}
            baseItemSize={baseItemSize}
            magnification={magnification}
          />
        </div>
      ))}
    </motion.div>
  );
};
