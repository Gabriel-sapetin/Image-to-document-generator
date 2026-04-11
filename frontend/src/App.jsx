import React, { useState, useRef, useCallback, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

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

const Icon = {
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Download: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  X: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  Zap: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Alert: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Heart: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
};

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
  const fileRef = useRef(null);

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body, #root {
          width: 100%;
          min-height: 100%;
          overflow-x: hidden;
          background: #0a0a0f;
        }

        body {
          font-family: 'DM Sans', sans-serif;
          color: #e8e6f0;
          -webkit-font-smoothing: antialiased;
        }

        .app-wrap {
          width: 100%;
          min-height: 100vh;
          background: #0a0a0f;
          overflow-x: hidden;
        }

        /* Hero */
        .hero {
          padding: 3rem 1.25rem 2rem;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: rgba(110,86,255,0.15);
          border: 1px solid rgba(110,86,255,0.35);
          border-radius: 100px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #a590ff;
          margin-bottom: 1rem;
        }
        .badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #6e56ff;
          flex-shrink: 0;
        }
        .hero h1 {
          font-size: clamp(1.8rem, 6vw, 3.2rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.08;
          color: #f0eeff;
          margin-bottom: 0.6rem;
        }
        .accent {
          background: linear-gradient(90deg, #6e56ff, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero p {
          font-size: 0.95rem;
          color: #7c7a94;
          max-width: 420px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Main */
        .main {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
          padding: 1.5rem 1.25rem 2rem;
        }

        /* Error */
        .error-box {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 0.85rem 1rem;
          margin-bottom: 1.25rem;
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          color: #f87171;
          font-size: 0.88rem;
        }

        /* Cards grid — side by side on desktop, stacked on mobile */
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
          width: 100%;
        }
        @media (max-width: 640px) {
          .cards-grid {
            grid-template-columns: 1fr;
          }
        }

        .card {
          background: #12111a;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1.5rem;
          width: 100%;
          min-width: 0;
        }
        .card-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #5a5870;
          margin-bottom: 0.25rem;
        }
        .card-title {
          font-size: 1rem;
          font-weight: 700;
          color: #d8d4f0;
          margin-bottom: 1.25rem;
        }

        /* Dropzone */
        .dropzone {
          border: 1.5px dashed rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 1.5rem 1rem;
          text-align: center;
          cursor: pointer;
          background: rgba(255,255,255,0.02);
          transition: all 0.2s;
          width: 100%;
        }
        .dropzone.active {
          border-color: #6e56ff;
          background: rgba(110,86,255,0.07);
        }
        .drop-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(110,86,255,0.15);
          color: #8b72ff;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 0.6rem;
        }
        .drop-text { font-size: 0.88rem; font-weight: 600; color: #c8c4e0; }
        .drop-sub { font-size: 0.75rem; color: #5a5870; margin-top: 2px; }

        /* Thumbs */
        .thumb-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 5px;
          margin-top: 0.75rem;
          max-height: 140px;
          overflow-y: auto;
        }
        .thumb { position: relative; aspect-ratio: 1; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .thumb-btn {
          position: absolute; top: 2px; right: 2px;
          background: rgba(0,0,0,0.7); color: #e8e6f0;
          border: none; border-radius: 50%;
          width: 16px; height: 16px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; padding: 0;
        }

        /* Stats */
        .stats-row { display: flex; gap: 0.6rem; margin-top: 1rem; }
        .stat {
          flex: 1;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 0.6rem 0.5rem;
          text-align: center;
          min-width: 0;
        }
        .stat-val { font-size: 1.2rem; font-weight: 800; color: #8b72ff; display: block; line-height: 1; margin-bottom: 3px; }
        .stat-label { font-size: 0.65rem; color: #5a5870; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }

        /* Form elements */
        .field-label { display: block; font-size: 0.78rem; font-weight: 600; color: #7c7a94; margin-bottom: 0.45rem; letter-spacing: 0.04em; }
        .range-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.1rem; }
        .range-row input[type=range] { flex: 1; accent-color: #6e56ff; cursor: pointer; }
        .range-val { min-width: 24px; text-align: center; font-size: 1rem; font-weight: 800; color: #8b72ff; }

        .text-input {
          width: 100%;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #e8e6f0;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          margin-bottom: 1.1rem;
        }
        .text-input:focus { border-color: rgba(110,86,255,0.5); }

        .size-row { display: flex; gap: 0.5rem; margin-bottom: 1.1rem; }
        .size-btn {
          flex: 1;
          padding: 0.55rem;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.03);
          color: #5a5870;
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.15s;
          font-family: inherit;
        }
        .size-btn.active {
          border-color: rgba(110,86,255,0.6);
          background: rgba(110,86,255,0.15);
          color: #a590ff;
        }

        .toggle-row { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .toggle-track {
          width: 34px; height: 19px; border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          position: relative; transition: all 0.2s; flex-shrink: 0;
        }
        .toggle-track.on { border-color: rgba(110,86,255,0.6); background: rgba(110,86,255,0.4); }
        .toggle-knob {
          position: absolute; top: 2px; left: 2px;
          width: 13px; height: 13px; border-radius: 50%;
          background: #3a3850; transition: left 0.2s;
        }
        .toggle-knob.on { left: 17px; background: #8b72ff; }
        .toggle-label { font-size: 0.8rem; color: #7c7a94; font-weight: 600; }

        /* Generate button */
        .gen-btn {
          width: 100%;
          padding: 0.95rem 1.5rem;
          border-radius: 12px;
          border: none;
          color: white;
          font-weight: 700;
          font-size: 0.92rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          transition: opacity 0.2s, transform 0.15s;
          font-family: inherit;
          margin-bottom: 1rem;
        }
        .gen-btn.ready {
          background: linear-gradient(135deg, #6e56ff 0%, #9b72ff 50%, #c084fc 100%);
          box-shadow: 0 0 32px rgba(110,86,255,0.3);
        }
        .gen-btn.ready:hover { opacity: 0.9; transform: translateY(-1px); }
        .gen-btn.disabled {
          background: rgba(255,255,255,0.05);
          color: #3a3850;
          cursor: not-allowed;
        }

        /* Success */
        .success-card {
          background: linear-gradient(135deg, rgba(110,86,255,0.12), rgba(192,132,252,0.08));
          border: 1px solid rgba(110,86,255,0.3);
          border-radius: 14px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          text-align: center;
          animation: fadeUp 0.4s ease;
        }
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        .success-star { font-size: 1.6rem; margin-bottom: 0.4rem; }
        .success-title { font-size: 1rem; font-weight: 700; color: #c4b5fd; margin-bottom: 0.2rem; }
        .success-sub { font-size: 0.8rem; color: #7c7a94; margin-bottom: 1.1rem; }
        .dl-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
        .dl-btn {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.65rem 1.2rem;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 700;
          font-size: 0.85rem;
          transition: filter 0.2s;
        }
        .dl-btn:hover { filter: brightness(1.15); }
        .dl-pdf { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
        .dl-docx { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; }

        /* Divider */
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 2rem 0 1.5rem; }

        /* Donation */
        .donation-card {
          background: #12111a;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1.75rem 1.25rem;
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .donation-tag {
          display: flex; align-items: center; justify-content: center;
          gap: 0.4rem; margin-bottom: 0.5rem;
          color: #f87171; font-size: 0.75rem; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
        }
        .donation-title { font-size: 1rem; font-weight: 700; color: #d8d4f0; margin-bottom: 0.5rem; }
        .donation-desc { color: #5a5870; font-size: 0.82rem; max-width: 340px; margin: 0 auto 0.75rem; line-height: 1.6; }
        .gcash-badge {
          display: inline-flex; flex-direction: column; align-items: center;
          padding: 12px 24px;
          background: linear-gradient(135deg, #007dfe, #00b4ff);
          border-radius: 12px;
          margin-bottom: 0.75rem;
          box-shadow: 0 6px 24px rgba(0,125,254,0.3);
        }
        .gcash-label { font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; font-weight: 600; color: white; }
        .gcash-num { font-size: 1.3rem; font-weight: 800; color: white; letter-spacing: 0.02em; }
        .gcash-name { font-size: 0.75rem; font-weight: 500; opacity: 0.9; color: white; }
        .donation-email { font-size: 0.72rem; color: #3a3850; }

        /* Footer */
        .footer {
          text-align: center;
          padding: 1.25rem;
          color: #3a3850;
          font-size: 0.75rem;
          border-top: 1px solid rgba(255,255,255,0.04);
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="app-wrap">
        {/* Hero */}
        <div className="hero">
          <div className="badge"><span className="badge-dot" />Image Grid Creator</div>
          <h1>Smart Layouts /><span className="accent">Zero Effort.</span></h1>
          <p>Upload photos, configure your grid, and download a pixel-perfect PDF or Word file in seconds.</p>
        </div>

        <div className="main">
          {/* Error */}
          {error && (
            <div className="error-box">
              <Icon.Alert /><span>{error}</span>
            </div>
          )}

          {/* Cards */}
          <div className="cards-grid">
            {/* Upload */}
            <div className="card">
              <p className="card-label">Step 01</p>
              <h2 className="card-title">Upload Images</h2>
              <div
                className={`dropzone${drag ? ' active' : ''}`}
                onDragEnter={onDrag} onDragLeave={onDrag} onDragOver={onDrag} onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="drop-icon"><Icon.Upload /></div>
                <p className="drop-text">Drop images here</p>
                <p className="drop-sub">or click to browse • PNG, JPG, WEBP</p>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

              {images.length > 0 && (
                <div className="thumb-grid">
                  {images.map(img => (
                    <div key={img.id} className="thumb">
                      <img src={img.preview} alt="" />
                      <button className="thumb-btn" onClick={() => remove(img.id)}><Icon.X /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="stats-row">
                <div className="stat"><span className="stat-val">{images.length}</span><span className="stat-label">Images</span></div>
                <div className="stat"><span className="stat-val">{pageCount}</span><span className="stat-label">Pages est.</span></div>
                <div className="stat"><span className="stat-val">{gridCols}×2</span><span className="stat-label">Grid</span></div>
              </div>
            </div>

            {/* Configure */}
            <div className="card">
              <p className="card-label">Step 02</p>
              <h2 className="card-title">Configure Layout</h2>

              <label className="field-label">Columns</label>
              <div className="range-row">
                <input type="range" min="1" max="4" value={gridCols} onChange={e => setGridCols(+e.target.value)} />
                <span className="range-val">{gridCols}</span>
              </div>

              <label className="field-label">Document Title</label>
              <input
                type="text"
                className="text-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="My Image Collection"
              />

              <label className="field-label">Page Size</label>
              <div className="size-row">
                {['A4', 'Letter'].map(s => (
                  <button key={s} className={`size-btn${pageSize === s ? ' active' : ''}`} onClick={() => setPageSize(s)}>{s}</button>
                ))}
              </div>

              <div className="toggle-row" onClick={() => setPreserveOrder(p => !p)}>
                <div className={`toggle-track${preserveOrder ? ' on' : ''}`}>
                  <div className={`toggle-knob${preserveOrder ? ' on' : ''}`} />
                </div>
                <span className="toggle-label">Preserve upload order</span>
              </div>
            </div>
          </div>

          {/* Generate */}
          <button
            className={`gen-btn${processing || images.length === 0 ? ' disabled' : ' ready'}`}
            disabled={processing || images.length === 0}
            onClick={generate}
          >
            {processing ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="spin">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                {status || 'Processing…'}
              </>
            ) : (
              <><Icon.Zap /> Generate Documents</>
            )}
          </button>

          {/* Success */}
          {links && (
            <div className="success-card">
              <div className="success-star">✦</div>
              <p className="success-title">Your documents are ready</p>
              <p className="success-sub">{links.pages} page{links.pages !== 1 ? 's' : ''} generated</p>
              <div className="dl-row">
                <a href={links.pdf} className="dl-btn dl-pdf" download><Icon.Download /> Download PDF</a>
                <a href={links.docx} className="dl-btn dl-docx" download><Icon.Download /> Download Word</a>
              </div>
            </div>
          )}

          <div className="divider" />

          {/* Donation */}
          <div className="donation-card">
            <h3 className="donation-title">Built by Gabriel L. Sapetin</h3>
            <p className="donation-desc">Hi! I'm Gab and the creator of this simple and yet helpful Web App. A small support will greatly help me as a student, thank you!</p>
            <div className="gcash-badge">
              <span className="gcash-label">GCash</span>
              <span className="gcash-num">0951 944 5551</span>
              <span className="gcash-name">Graciel S.</span>
            </div>
            <p className="donation-email">gabrielsapetin9@gmail.com</p>
          </div>
        </div>

        <div className="footer">© {new Date().getFullYear()} Image-to-Doc · SNSU Student Project · All rights reserved</div>
      </div>
    </>
  );
}
