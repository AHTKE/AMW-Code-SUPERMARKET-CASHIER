import { useEffect, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { getAppFullscreenState, toggleAppFullscreen } from '@/lib/fullscreen';

const FullscreenButton = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => {
      void getAppFullscreenState().then(setIsFullscreen).catch(() => setIsFullscreen(false));
    };
    update();
    document.addEventListener('fullscreenchange', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('fullscreenchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const handleClick = async () => {
    try {
      setIsFullscreen(await toggleAppFullscreen());
    } catch {
      setIsFullscreen(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed left-3 top-3 z-[90] flex h-9 w-9 items-center justify-center rounded border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-secondary"
      title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
      aria-label={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
    >
      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </button>
  );
};

export default FullscreenButton;
