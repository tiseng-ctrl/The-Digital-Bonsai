import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { BONSAI_HTML } from './bonsaiHtml';

const BonsaiView = forwardRef(function BonsaiView(
  { climate, onDone },
  ref
) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    reset() {
      webRef.current?.contentWindow?.resetTree?.();
    },

    setStage(day) {
      webRef.current?.contentWindow?.setTreeStage?.(day);
    },

    clearStage() {
      webRef.current?.contentWindow?.clearTreeStage?.();
    },
  }));

  useEffect(() => {
    if (!ready || !webRef.current?.contentWindow || !climate) {
      return;
    }

    webRef.current.contentWindow.setClimate?.(climate);
  }, [ready, climate]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== webRef.current?.contentWindow) {
        return;
      }

      let msg = event.data;

      try {
        if (typeof msg === 'string') {
          msg = JSON.parse(msg);
        }

        if (msg?.type === 'ready') {
          setReady(true);
        }

        if (msg?.type === 'done') {
          onDone?.();
        }
      } catch (error) {
        console.warn('Bonsai message error:', error);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onDone]);

  return (
    <iframe
      ref={webRef}
      srcDoc={BONSAI_HTML}
      title="3D Bonsai Tree"
      onLoad={() => setReady(true)}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        background: 'transparent',
        display: 'block',
      }}
    />
  );
});

export default BonsaiView;