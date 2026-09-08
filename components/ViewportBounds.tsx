'use client';
import { useEffect } from 'react';
export default function ViewportBounds() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const root = document.documentElement;
        const top = viewport?.offsetTop || 0,
          height = viewport?.height || window.innerHeight;
        root.style.setProperty('--visual-height', `${height}px`);
        root.style.setProperty('--visual-top', `${top}px`);
        root.style.setProperty(
          '--visual-bottom',
          `${Math.max(0, window.innerHeight - height - top)}px`,
        );
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  return null;
}
