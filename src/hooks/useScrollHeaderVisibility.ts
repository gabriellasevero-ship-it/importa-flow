import { useEffect, useRef, useState } from 'react';

const SCROLL_DELTA = 8;
const TOP_OFFSET = 16;

/**
 * Esconde o header principal ao rolar para baixo e exibe ao rolar para cima ou no topo.
 */
export function useScrollHeaderVisibility(enabled: boolean) {
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setVisible(true);
      return;
    }

    lastScrollY.current = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;

      if (currentY <= TOP_OFFSET) {
        setVisible(true);
      } else if (currentY > lastScrollY.current + SCROLL_DELTA) {
        setVisible(false);
      } else if (currentY < lastScrollY.current - SCROLL_DELTA) {
        setVisible(true);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return visible;
}
