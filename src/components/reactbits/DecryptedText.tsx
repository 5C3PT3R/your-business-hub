import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: 'view' | 'hover';
}

const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';

export const DecryptedText = ({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'view'
}: DecryptedTextProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const characters = useMemo(() => {
    if (useOriginalCharsOnly) {
      return [...new Set(text.split(''))].filter(c => c !== ' ');
    }
    return CHARACTERS.split('');
  }, [text, useOriginalCharsOnly]);

  const getRandomChar = () => characters[Math.floor(Math.random() * characters.length)];

  const scramble = () => {
    if (hasAnimated && animateOn === 'view') return;
    setIsAnimating(true);
    
    const textArray = text.split('');
    const revealed = new Array(text.length).fill(false);
    let iterations = 0;

    const getRevealOrder = () => {
      const indices = textArray.map((_, i) => i).filter(i => text[i] !== ' ');
      if (revealDirection === 'end') indices.reverse();
      if (revealDirection === 'center') {
        const mid = Math.floor(indices.length / 2);
        const sorted = [];
        for (let i = 0; i <= mid; i++) {
          if (indices[mid - i] !== undefined) sorted.push(indices[mid - i]);
          if (i !== 0 && indices[mid + i] !== undefined) sorted.push(indices[mid + i]);
        }
        return sorted;
      }
      return indices;
    };

    const revealOrder = getRevealOrder();
    let revealIndex = 0;

    const interval = setInterval(() => {
      const newText = textArray.map((char, i) => {
        if (char === ' ') return ' ';
        if (revealed[i]) return text[i];
        return getRandomChar();
      }).join('');
      
      setDisplayText(newText);
      iterations++;

      if (sequential) {
        if (revealIndex < revealOrder.length && iterations % 2 === 0) {
          revealed[revealOrder[revealIndex]] = true;
          revealIndex++;
        }
        if (revealIndex >= revealOrder.length) {
          clearInterval(interval);
          setDisplayText(text);
          setIsAnimating(false);
          setHasAnimated(true);
        }
      } else {
        if (iterations >= maxIterations) {
          clearInterval(interval);
          setDisplayText(text);
          setIsAnimating(false);
          setHasAnimated(true);
        }
      }
    }, speed);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    if (animateOn === 'view' && isInView && !hasAnimated) {
      scramble();
    }
  }, [isInView, animateOn, hasAnimated]);

  return (
    <motion.span
      ref={ref}
      className={`inline-block ${parentClassName}`}
      onHoverStart={animateOn === 'hover' ? scramble : undefined}
    >
      {displayText.split('').map((char, i) => (
        <span
          key={i}
          className={`${char !== text[i] ? encryptedClassName : className} transition-colors duration-150`}
          style={{ 
            opacity: char !== text[i] ? 0.5 : 1,
            fontFamily: 'inherit'
          }}
        >
          {char}
        </span>
      ))}
    </motion.span>
  );
};
