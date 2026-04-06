import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

function CaptureOverlay() {
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirmed, setConfirmed] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const originRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlistenReady = listen<string>('capture-ready', (event) => {
      setBgImage(null);
      setSelection(null);
      setConfirmed(null);
      setDragging(false);

      setBgImage(event.payload);
    });

    const unlistenReset = listen<void>('capture-reset', () => {
      setBgImage(null);
      setSelection(null);
      setConfirmed(null);
      setDragging(false);
    });

    return () => {
      unlistenReady.then((fn) => fn());
      unlistenReset.then((fn) => fn());
    };
  }, []);

  const handleImageLoad = useCallback(() => {
    getCurrentWebviewWindow().show();
  }, []);

  const toPhysical = useCallback((cssX: number, cssY: number) => {
    const dpr = window.devicePixelRatio || 1;
    return { px: Math.round(cssX * dpr), py: Math.round(cssY * dpr) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (confirmed) return;
    originRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    setSelection(null);
  }, [confirmed]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setSelection({
      startX: originRef.current.x,
      startY: originRef.current.y,
      endX: e.clientX,
      endY: e.clientY,
    });
  }, [dragging]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setDragging(false);

    const dx = Math.abs(e.clientX - originRef.current.x);
    const dy = Math.abs(e.clientY - originRef.current.y);

    if (dx < 5 && dy < 5) {
      setSelection(null);
      const { px, py } = toPhysical(e.clientX, e.clientY);
      invoke<string>('capture_window_at_point', { x: px, y: py })
        .then((b64) => invoke('capture_confirm_selection', { imageData: b64 }))
        .catch((err) => console.error('Window capture failed:', err));
      return;
    }

    setConfirmed({
      startX: originRef.current.x,
      startY: originRef.current.y,
      endX: e.clientX,
      endY: e.clientY,
    });
  }, [dragging, toPhysical]);

  const handleConfirm = useCallback(() => {
    if (!selection) return;
    const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const w = Math.abs(selection.endX - selection.startX);
    const h = Math.abs(selection.endY - selection.startY);
    if (w < 2 || h < 2) return;

    const topLeft = toPhysical(x, y);
    const size = toPhysical(w, h);

    invoke<string>('capture_crop_region', {
      x: topLeft.px,
      y: topLeft.py,
      w: size.px,
      h: size.py,
    })
      .then((b64) => invoke('capture_confirm_selection', { imageData: b64 }))
      .catch((err) => console.error('Crop failed:', err));
  }, [selection, toPhysical]);

  const handleCancel = useCallback(() => {
    setSelection(null);
    setConfirmed(null);
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      invoke('capture_cancel').catch(console.error);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const selectionRect = selection
    ? {
        left: Math.min(selection.startX, selection.endX),
        top: Math.min(selection.startY, selection.endY),
        width: Math.abs(selection.endX - selection.startX),
        height: Math.abs(selection.endY - selection.startY),
      }
    : null;

  return (
    <div
      ref={overlayRef}
      className="capture-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {bgImage && (
        <img
          className="capture-bg"
          src={`data:image/jpeg;base64,${bgImage}`}
          alt=""
          draggable={false}
          onLoad={handleImageLoad}
        />
      )}
      <div className="capture-dim" />

      {selectionRect && (
        <div className="capture-selection" style={selectionRect}>
          <div
            className="capture-selection-inner"
            style={{
              backgroundImage: bgImage ? `url(data:image/jpeg;base64,${bgImage})` : undefined,
              backgroundSize: `${window.innerWidth}px ${window.innerHeight}px`,
              backgroundPosition: `-${selectionRect.left}px -${selectionRect.top}px`,
            }}
          />
        </div>
      )}

      {confirmed && selectionRect && (
        <div
          className="capture-actions"
          style={{
            left: selectionRect.left + selectionRect.width / 2,
            top: selectionRect.top + selectionRect.height + 12,
          }}
        >
          <button className="capture-btn capture-btn-confirm" onClick={handleConfirm}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9L7 13L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="capture-btn capture-btn-cancel" onClick={handleCancel}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 4L14 14M4 14L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      <div className="capture-hint">
        拖拽选区 · 点击捕获窗口 · Esc 取消
      </div>
    </div>
  );
}

export default CaptureOverlay;
