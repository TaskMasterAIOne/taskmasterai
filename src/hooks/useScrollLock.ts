import { useEffect, useRef } from 'react';

/**
 * Custom hook to lock/unlock body scroll when modals are open
 * Prevents background scrolling while allowing modal content to scroll
 */
export function useScrollLock(isLocked: boolean) {
  const scrollPosition = useRef<number>(0);
  const originalStyles = useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
  }>({
    overflow: '',
    position: '',
    top: '',
    width: ''
  });

  useEffect(() => {
    if (isLocked) {
      // Store the current scroll position
      scrollPosition.current = window.scrollY;
      
      // Store original body styles
      originalStyles.current = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width
      };

      // Apply scroll lock styles
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosition.current}px`;
      document.body.style.width = '100%';
    } else {
      // Restore original styles
      document.body.style.overflow = originalStyles.current.overflow;
      document.body.style.position = originalStyles.current.position;
      document.body.style.top = originalStyles.current.top;
      document.body.style.width = originalStyles.current.width;
      
      // Restore scroll position
      window.scrollTo(0, scrollPosition.current);
    }

    // Cleanup function to ensure styles are restored when component unmounts
    return () => {
      if (isLocked) {
        document.body.style.overflow = originalStyles.current.overflow;
        document.body.style.position = originalStyles.current.position;
        document.body.style.top = originalStyles.current.top;
        document.body.style.width = originalStyles.current.width;
        
        // Restore scroll position
        window.scrollTo(0, scrollPosition.current);
      }
    };
  }, [isLocked]);
}
