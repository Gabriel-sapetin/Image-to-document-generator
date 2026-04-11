import React, { useState, useRef, useCallback, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

// ── API helpers ──────────────────────────────────────────────────────────────
const apiCall = {
  uploadImages: async (files, gridCols, pageSize, title, preserveOrder) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    form.append('grid_cols', gridCols);
    form.append('page_size', pageSize);
    form.append('title', title);
    form.append('preserve_order', preserveOrder);
    const res = await fetch(`${API}/api/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return res.json();
  },
  generatePDF: async (sessionId, title, pageNumbers) => {
    const res = await fetch(`${API}/api/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, title, page_numbers: pageNumbers }),
    });
    if (!res.ok) throw new Error(`PDF generation failed (${res.status})`);
    return res.json();
  },
  generateDocx: async (sessionId, title) => {
    const res = await fetch(`${API}/api/generate-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, title }),
    });
    if (!res.ok) throw new Error(`DOCX generation failed (${res.status})`);
    return res.json();
  },
};

// ── Icons (inline SVG, zero deps) ────────────────────────────────────────────
const Icon = {
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Download: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  X: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Zap: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Check: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Heart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Spinner: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.4"/>
      <path d="M12 2v4" strokeOpacity="1"/>
    </svg>
  ),
};

// ── Styles (CSS-in-JS object) ─────────────────────────────────────────────────
const S = {
  root: {
    minHeight: '100vh',
    background: '#0a0a0f',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    color: '#e8e6f0',
    padding: '0',
  },
  // Noise grain overlay via pseudo — we'll use a canvas approach instead
  hero: {
    padding: '3.5rem 1.5rem 2rem',
    textAlign: 'center',
    position: 'relative',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 12px',
    background: 'rgba(110,86,255,0.15)',
    border: '1px solid rgba(110,86,255,0.35)',
    borderRadius: '100px',
    fontSize: '0.75rem',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#a590ff',
    marginBottom: '1.2rem',
  },
  h1: {
    fontSize: 'clamp(2rem, 5vw, 3.4rem)',
    fontWeight: '800',
    letterSpacing: '-0.03em',
    margin: '0 0 0.6rem',
    lineHeight: 1.05,
    color: '#f0eeff',
  },
  accent: {
    background: 'linear-gradient(90deg, #6e56ff 0%, #c084fc 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  sub: {
    fontSize: '1rem',
    color: '#7c7a94',
    maxWidth: '480px',
    margin: '0 auto',
    lineHeight: 1.6,
  },
  main: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2.5rem 1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '1.25rem',
    marginBottom: '1.25rem',
  },
  card: {
    background: '#12111a',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '1.75rem',
    transition: 'border-color 0.2s',
  },
  cardLabel: {
    fontSize: '0.7rem',
    fontWeight: '700',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#5a5870',
    marginBottom: '0.3rem',
  },
  cardTitle: {
    fontSize: '1.05rem',
    fontWeight: '700',
    color: '#d8d4f0',
    marginBottom: '1.25rem',
    margin: '0 0 1.25rem',
  },
  dropzone: (active) => ({
    border: `1.5px dashed ${active ? '#6e56ff' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '10px',
    padding: '2rem 1rem',
    textAlign: 'center',
    cursor: 'pointer',
    background: active ? 'rgba(110,86,255,0.07)' : 'rgba(255,255,255,0.02)',
    transition: 'all 0.2s',
  }),
  dropIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(110,86,255,0.15)',
    color: '#8b72ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 0.75rem',
  },
  dropText: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#c8c4e0',
    margin: '0 0 0.25rem',
  },
  dropSub: {
    fontSize: '0.78rem',
    color: '#5a5870',
    margin: 0,
  },
  thumbGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
    marginTop: '1rem',
    maxHeight: '160px',
    overflowY: 'auto',
  },
  thumb: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  thumbBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    background: 'rgba(0,0,0,0.75)',
    color: '#e8e6f0',
    border: 'none',
    borderRadius: '50%',
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    backdropFilter: 'blur(4px)',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#7c7a94',
    marginBottom: '0.5rem',
    letterSpacing: '0.04em',
  },
  rangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  rangeVal: {
    minWidth: '28px',
    textAlign: 'center',
    fontSize: '1rem',
    fontWeight: '800',
    color: '#8b72ff',
  },
  input: {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#e8e6f0',
    fontSize: '0.9rem',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  statsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '1.25rem',
  },
  stat: {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    padding: '0.65rem 0.75rem',
    textAlign: 'center',
  },
  statVal: {
    fontSize: '1.3rem',
    fontWeight: '800',
    color: '#8b72ff',
    display: 'block',
    lineHeight: 1,
    marginBottom: '3px',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#5a5870',
    fontWeight: '600',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  generateBtn: (disabled) => ({
    width: '100%',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    border: 'none',
    background: disabled
      ? 'rgba(255,255,255,0.05)'
      : 'linear-gradient(135deg, #6e56ff 0%, #9b72ff 50%, #c084fc 100%)',
    color: disabled ? '#3a3850' : 'white',
    fontWeight: '700',
    fontSize: '0.95rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    letterSpacing: '0.02em',
    transition: 'opacity 0.2s, transform 0.15s',
    boxShadow: disabled ? 'none' : '0 0 40px rgba(110,86,255,0.3)',
  }),
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: '10px',
    padding: '0.85rem 1rem',
    marginBottom: '1.25rem',
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'flex-start',
    color: '#f87171',
    fontSize: '0.88rem',
  },
  successCard: {
    background: 'linear-gradient(135deg, rgba(110,86,255,0.12) 0%, rgba(192,132,252,0.08) 100%)',
    border: '1px solid rgba(110,86,255,0.3)',
    borderRadius: '16px',
    padding: '1.75rem',
    marginTop: '1.25rem',
    textAlign: 'center',
  },
  successTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#c4b5fd',
    margin: '0 0 0.3rem',
  },
  successSub: {
    fontSize: '0.82rem',
    color: '#7c7a94',
    margin: '0 0 1.25rem',
  },
  dlRow: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'center',
  },
  dlBtn: (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.7rem 1.4rem',
    borderRadius: '8px',
    background: color === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    border: `1px solid ${color === 'pdf' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
    color: color === 'pdf' ? '#f87171' : '#60a5fa',
    textDecoration: 'none',
    fontWeight: '700',
    fontSize: '0.88rem',
    transition: 'background 0.2s',
  }),
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    margin: '3rem 0 2rem',
  },
  donationCard: {
    background: '#12111a',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    padding: '2rem',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  gcashBadge: {
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #007dfe 0%, #00b4ff 100%)',
    borderRadius: '12px',
    margin: '1rem 0',
    boxShadow: '0 8px 32px rgba(0,125,254,0.3)',
  },
  footer: {
    textAlign: 'center',
    padding: '1.5rem',
    color: '#3a3850',
    fontSize: '0.78rem',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function App() {
  const [images, setImages] = useState([]);
  const [gridCols, setGridCols] = useState(2);
  const [pageSize, setPageSize] = useState('A4');
  const [title, setTitle] = useState('Image Collection');
  const [preserveOrder, setPreserveOrder] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const fileRef = useRef(null);

  // Spinner animation
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => setSpinAngle(a => a + 30), 100);
    return () => clearInterval(t);
  }, [processing]);

  useEffect(() => {
    return () => images.forEach(img => URL.revokeObjectURL(img.preview));
  }, [images]);

  const addFiles = useCallback((files) => {
    const imgs = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map((f, i) => ({
        id: `${Date.now()}-${i}`,
        file: f,
        preview: URL.createObjectURL(f),
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(2),
      }));
    setImages(p => [...p, ...imgs]);
    setError('');
    setLinks(null);
  }, []);

  const onDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(e.type === 'dragover' || e.type === 'dragenter'); };
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };
  const remove = (id) => setImages(p => { const t = p.find(i => i.id === id); if (t) URL.revokeObjectURL(t.preview); return p.filter(i => i.id !== id); });

  const pageCount = Math.ceil(images.length / (gridCols * 2)) || 0;

  const generate = async () => {
    if (!images.length) { setError('Please upload at least one image.'); return; }
    setProcessing(true); setError(''); setLinks(null);
    try {
      setStatus('Uploading images…');
      const up = await apiCall.uploadImages(images.map(i => i.file), gridCols, pageSize, title, preserveOrder);
      if (!up?.session_id) throw new Error('Invalid server response');
      setStatus('Generating PDF…');
      const pdf = await apiCall.generatePDF(up.session_id, title, true);
      setStatus('Generating Word document…');
      const docx = await apiCall.generateDocx(up.session_id, title);
      setStatus('');
      setLinks({ pdf: `${API}${pdf.download_url}`, docx: `${API}${docx.download_url}`, pages: up.page_count });
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={S.root}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { accent-color: #6e56ff; cursor: pointer; }
        input:focus { outline: none; border-color: rgba(110,86,255,0.5) !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .card-hover:hover { border-color: rgba(110,86,255,0.2) !important; }
        .generate-btn:not(:disabled):hover { opacity: 0.9; transform: translateY(-1px); }
        .dl-btn:hover { filter: brightness(1.15); }
        .remove-btn:hover { background: rgba(239,68,68,0.5) !important; }
      `}</style>

      {/* Hero */}
      <div style={S.hero}>
        <div style={S.badge}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#6e56ff' }} />
          Image Grid Creator
        </div>
        <h1 style={S.h1}>
          Turn images into<br />
          <span style={S.accent}>beautiful documents</span>
        </h1>
        <p style={S.sub}>Upload photos, configure your grid, and download a pixel-perfect PDF or Word file in seconds.</p>
      </div>

      <div style={S.main}>

        {/* Error */}
        {error && (
          <div style={S.errorBox}>
            <Icon.Alert />
            <span>{error}</span>
          </div>
        )}

        {/* Cards */}
        <div style={S.grid}>

          {/* Upload card */}
          <div style={S.card} className="card-hover">
            <p style={S.cardLabel}>Step 01</p>
            <h2 style={S.cardTitle}>Upload Images</h2>

            <div
              style={S.dropzone(drag)}
              onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div style={S.dropIcon}><Icon.Upload /></div>
              <p style={S.dropText}>Drop images here</p>
              <p style={S.dropSub}>or click to browse • PNG, JPG, WEBP</p>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

            {images.length > 0 && (
              <div style={S.thumbGrid}>
                {images.map(img => (
                  <div key={img.id} style={S.thumb}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <button className="remove-btn" style={S.thumbBtn} onClick={() => remove(img.id)}><Icon.X /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Stats */}
            <div style={S.statsRow}>
              <div style={S.stat}>
                <span style={S.statVal}>{images.length}</span>
                <span style={S.statLabel}>Images</span>
              </div>
              <div style={S.stat}>
                <span style={S.statVal}>{pageCount}</span>
                <span style={S.statLabel}>Pages est.</span>
              </div>
              <div style={S.stat}>
                <span style={S.statVal}>{gridCols}×2</span>
                <span style={S.statLabel}>Grid</span>
              </div>
            </div>
          </div>

          {/* Configure card */}
          <div style={S.card} className="card-hover">
            <p style={S.cardLabel}>Step 02</p>
            <h2 style={S.cardTitle}>Configure Layout</h2>

            <label style={S.label}>Columns</label>
            <div style={S.rangeRow}>
              <input type="range" min="1" max="4" value={gridCols} onChange={e => setGridCols(+e.target.value)} style={{ flex: 1 }} />
              <span style={S.rangeVal}>{gridCols}</span>
            </div>

            <label style={S.label}>Document Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ ...S.input, marginBottom: '1.25rem' }}
              placeholder="My Image Collection"
            />

            <label style={S.label}>Page Size</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {['A4', 'Letter'].map(s => (
                <button
                  key={s}
                  onClick={() => setPageSize(s)}
                  style={{
                    flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                    borderColor: pageSize === s ? 'rgba(110,86,255,0.6)' : 'rgba(255,255,255,0.08)',
                    background: pageSize === s ? 'rgba(110,86,255,0.15)' : 'rgba(255,255,255,0.03)',
                    color: pageSize === s ? '#a590ff' : '#5a5870',
                    fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: 'inherit',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
              <div
                onClick={() => setPreserveOrder(p => !p)}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: '1px solid',
                  borderColor: preserveOrder ? 'rgba(110,86,255,0.6)' : 'rgba(255,255,255,0.1)',
                  background: preserveOrder ? 'rgba(110,86,255,0.4)' : 'rgba(255,255,255,0.05)',
                  position: 'relative', transition: 'all 0.2s', flexShrink: 0,
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, left: preserveOrder ? 16 : 2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: preserveOrder ? '#8b72ff' : '#3a3850', transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: '0.82rem', color: '#7c7a94', fontWeight: '600' }}>Preserve upload order</span>
            </label>
          </div>
        </div>

        {/* Generate button */}
        <button
          className="generate-btn"
          style={S.generateBtn(processing || images.length === 0)}
          disabled={processing || images.length === 0}
          onClick={generate}
        >
          {processing ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
              {status || 'Processing…'}
            </>
          ) : (
            <>
              <Icon.Zap />
              Generate Documents
            </>
          )}
        </button>

        {/* Download links */}
        {links && (
          <div style={{ ...S.successCard, animation: 'fadeUp 0.4s ease' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✦</div>
            <h3 style={S.successTitle}>Your documents are ready</h3>
            <p style={S.successSub}>{links.pages} page{links.pages !== 1 ? 's' : ''} generated</p>
            <div style={S.dlRow}>
              <a href={links.pdf} style={S.dlBtn('pdf')} className="dl-btn" download>
                <Icon.Download /> Download PDF
              </a>
              <a href={links.docx} style={S.dlBtn('docx')} className="dl-btn" download>
                <Icon.Download /> Download Word
              </a>
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={S.divider} />

        {/* Donation */}
        <div style={S.donationCard}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#d8d4f0', margin: '0 0 0.5rem' }}>Built by Gabriel L. Sapetin</h3>
          <p style={{ color: '#5a5870', fontSize: '0.85rem', maxWidth: '380px', margin: '0 auto 0.75rem', lineHeight: 1.6 }}>
            Hi! I'm Gab and the creator of this simple and yet helpful Web App. A small support will greatly help me as a student, thank you!
          </p>
          <div style={S.gcashBadge}>
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85, fontWeight: '600' }}>GCash</span>
            <span style={{ fontSize: '1.35rem', fontWeight: '800', letterSpacing: '0.02em' }}>0951 944 5551</span>
            <span style={{ fontSize: '0.78rem', fontWeight: '500', opacity: 0.9 }}>Graciel S.</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#3a3850', margin: '0.5rem 0 0' }}>gabrielsapetin9@gmail.com</p>
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        © {new Date().getFullYear()} Image-to-Doc · SNSU Student Project · All rights reserved
      </div>
    </div>
  );
}