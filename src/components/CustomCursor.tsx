import React, { useEffect, useRef, useState } from 'react';

export const CustomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const targetPos = useRef({ x: -100, y: -100 });
  const currentPos = useRef({ x: -100, y: -100 });
  const [isHoveringInteractive, setIsHoveringInteractive] = useState(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      const target = e.target as HTMLElement | null;
      if (target) {
        const interactive = target.closest(
          'a, button, [role="button"], input, select, textarea, .clickable-row, .player-card, .bento-card, .drop-card'
        );
        setIsHoveringInteractive(Boolean(interactive));
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });

    let rafId: number;
    const animate = () => {
      const lerp = 0.2;
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerp;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerp;

      if (cursorRef.current) {
        const scale = isHoveringInteractive ? 2.5 : 1;
        cursorRef.current.style.transform = `translate3d(${currentPos.current.x - 16}px, ${currentPos.current.y - 16}px, 0) scale(${scale})`;
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [isHoveringInteractive]);

  return <div ref={cursorRef} className="acid-custom-cursor" aria-hidden="true" />;
};

export default CustomCursor;
