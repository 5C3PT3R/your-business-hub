import { useRef, useEffect, useMemo } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

interface BlurTextProps {
  text: string;
  animateBy?: 'words' | 'letters';
  direction?: 'top' | 'bottom';
  delay?: number;
  stepDuration?: number;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  onAnimationComplete?: () => void;
}

export const BlurText = ({
  text,
  animateBy = 'words',
  direction = 'top',
  delay = 150,
  stepDuration = 0.4,
  threshold = 0.1,
  rootMargin = '0px',
  className = '',
  onAnimationComplete
}: BlurTextProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: threshold, margin: rootMargin as any });

  const elements = useMemo(() => {
    if (animateBy === 'words') {
      return text.split(' ');
    }
    return text.split('');
  }, [text, animateBy]);

  const variants: Variants = {
    hidden: {
      opacity: 0,
      filter: 'blur(10px)',
      y: direction === 'top' ? -20 : 20
    },
    visible: (i: number) => ({
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration: stepDuration,
        delay: i * (delay / 1000),
        ease: [0.4, 0, 0.2, 1]
      }
    })
  };

  return (
    <span ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {elements.map((element, i) => (
        <motion.span
          key={`${element}-${i}`}
          custom={i}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={variants}
          onAnimationComplete={i === elements.length - 1 ? onAnimationComplete : undefined}
          className="inline-block"
          style={{ marginRight: animateBy === 'words' ? '0.25em' : 0 }}
        >
          {element}
        </motion.span>
      ))}
    </span>
  );
};
