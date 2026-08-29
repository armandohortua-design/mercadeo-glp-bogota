import React from 'react';

// Visor de imágenes con navegación por flechas (izq/der), teclado y contador.
// Solo se cierra con ✕, clic en el fondo, o Escape — nunca al cambiar de foto.
export type LightboxState = { photos: string[]; index: number };

export const Lightbox: React.FC<{
  state: LightboxState;
  onClose: () => void;
  onChange: (index: number) => void;
}> = ({ state, onClose, onChange }) => {
  const { photos, index } = state;
  const goPrev = () => onChange((index - 1 + photos.length) % photos.length);
  const goNext = () => onChange((index + 1) % photos.length);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.85)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', cursor: 'zoom-out',
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}
      >
        ✕
      </button>
      {photos.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goPrev(); }}
          style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '2rem', width: 52, height: 52, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ‹
        </button>
      )}
      <img
        src={photos[index]}
        alt="Zoom"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', objectFit: 'contain' }}
      />
      {photos.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); goNext(); }}
          style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', fontSize: '2rem', width: 52, height: 52, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ›
        </button>
      )}
      {photos.length > 1 && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#fff', fontSize: 12, letterSpacing: '0.05em' }}>
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  );
};
