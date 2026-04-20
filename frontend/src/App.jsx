import React, { useState, useRef, useCallback, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES = 50;

const apiCall = {
  uploadImages: async (files, gridCols, pageSize, title, preserveOrder) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const params = new URLSearchParams({
      grid_cols: gridCols,
      page_size: pageSize,
      document_title: title,
      preserve_order: preserveOrder,
    });
    const res = await fetch(`${API}/api/upload?${params}`, { method: 'POST', body: form });
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

const formatBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
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
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  Warn: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

export default function App() {
  const [images, setImages] = useState([]);
  const [gridCols, setGridCols] = useState(2);
  const [pageSize, setPageSize] = useState('A4');
  const [title, setTitle] = useState('Image Collection');
  const [preserveOrder, setPreserveOrder] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [status, setStatus] = useState('');
  const [links, setLinks] = useState(null);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [drag, setDrag] = useState(false);
  const [dragOverId, setDragOverId] = useState(null);
  const [toast, setToast] = useState('');
  const fileRef = useRef(null);
  const dragSrcId = useRef(null);

  useEffect(() => {
    return () => images.forEach(img => URL.revokeObjectURL(img.preview));
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text).then(() => showToast(`${label} copied!`));
  };

  const addFiles = useCallback((files) => {
    const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'));
    const warns = [];

    // Check count limit
    const remaining = MAX_IMAGES - images.length;
    if (fileArr.length > remaining) {
      warns.push(`Max ${MAX_IMAGES} images allowed. Only first ${remaining} added.`);
    }
    const allowed = fileArr.slice(0, remaining);

    const oversized = allowed.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      warns.push(`${oversized.length} file(s) exceed 50MB limit and were skipped: ${oversized.map(f => f.name).join(', ')}`);
    }

    const valid = allowed.filter(f => f.size <= MAX_FILE_SIZE);
    const imgs = valid.map((f, i) => ({
      id: `${Date.now()}-${i}-${Math.random()}`,
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name,
      size: f.size,
    }));

    setImages(p => [...p, ...imgs]);
    setWarnings(warns);
    setError('');
    setLinks(null);
  }, [images]);

  const onDrag = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(e.type === 'dragover' || e.type === 'dragenter'); };
  const onDrop = (e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); if (e.dataTransfer.files) addFiles(e.dataTransfer.files); };

  const remove = (id) => {
    setImages(p => {
      const t = p.find(i => i.id === id);
      if (t) URL.revokeObjectURL(t.preview);
      return p.filter(i => i.id !== id);
    });
  };

  const clearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setLinks(null);
    setWarnings([]);
    setError('');
  };

  // Drag-to-reorder handlers
  const onThumbDragStart = (e, id) => {
    dragSrcId.current = id;
    e.dataTransfer.effectAllowed = 'move';
    // Store id in dataTransfer as fallback
    e.dataTransfer.setData('text/plain', id);
  };
  const onThumbDragOver = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };
  const onThumbDragLeave = (e) => {
    // Only clear if leaving to outside the thumb entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverId(null);
    }
  };
  const onThumbDrop = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const srcId = dragSrcId.current || e.dataTransfer.getData('text/plain');
    if (!srcId || srcId === targetId) return;
    setImages(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(i => i.id === srcId);
      const toIdx = arr.findIndex(i => i.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return arr;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    // Always lock to drag order after manual reorder
    setPreserveOrder(true);
    dragSrcId.current = null;
  };
  const onThumbDragEnd = () => { setDragOverId(null); dragSrcId.current = null; };

  const totalSize = images.reduce((s, i) => s + i.size, 0);
  const imagesPerPage = gridCols * 2;
  const pageCount = images.length > 0 ? Math.ceil(images.length / imagesPerPage) : 0;

  const generate = async () => {
    if (!images.length) { setError('Please upload at least one image.'); return; }
    setProcessing(true); setError(''); setLinks(null); setProgress(0);
    try {
      setStatus('Uploading images…'); setProgress(10);
      const up = await apiCall.uploadImages(images.map(i => i.file), gridCols, pageSize, title, preserveOrder);
      if (!up?.session_id) throw new Error('Invalid server response');
      setProgress(40);
      setStatus('Generating PDF…'); setProgress(55);
      const pdf = await apiCall.generatePDF(up.session_id, title, false);
      setProgress(75);
      setStatus('Generating Word document…'); setProgress(88);
      const docx = await apiCall.generateDocx(up.session_id, title);
      setProgress(100);
      setStatus('');
      setLinks({ pdf: `${API}${pdf.download_url}`, docx: `${API}${docx.download_url}`, pages: up.page_count });
    } catch (e) {
      setError(e.message || 'Something went wrong.');
      setStatus('');
      setProgress(0);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { width: 100%; min-height: 100%; overflow-x: hidden; background: #0a0a0f; }
        body { font-family: 'DM Sans', sans-serif; color: #e8e6f0; -webkit-font-smoothing: antialiased; }
        .app-wrap { width: 100%; min-height: 100vh; background: #0a0a0f; overflow-x: hidden; }

        /* Hero */
        .hero { padding: 3rem 1.25rem 2rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; background: rgba(110,86,255,0.15); border: 1px solid rgba(110,86,255,0.35); border-radius: 100px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a590ff; margin-bottom: 1rem; }
        .badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #6e56ff; flex-shrink: 0; }
        .hero h1 { font-size: clamp(1.8rem, 6vw, 3.2rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; color: #f0eeff; margin-bottom: 0.6rem; }
        .accent { background: linear-gradient(90deg, #6e56ff, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .hero p { font-size: 0.95rem; color: #7c7a94; max-width: 420px; margin: 0 auto; line-height: 1.6; }

        /* Main */
        .main { width: 100%; max-width: 960px; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; }

        /* Error */
        .error-box { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; gap: 0.6rem; align-items: flex-start; color: #f87171; font-size: 0.88rem; }

        /* Warning */
        .warn-box { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; gap: 0.5rem; align-items: flex-start; color: #fbbf24; font-size: 0.82rem; }

        /* Cards grid */
        .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; width: 100%; }
        @media (max-width: 640px) { .cards-grid { grid-template-columns: 1fr; } }

        .card { background: #12111a; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.5rem; width: 100%; min-width: 0; }
        .card-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #5a5870; margin-bottom: 0.25rem; }
        .card-title { font-size: 1rem; font-weight: 700; color: #d8d4f0; margin-bottom: 1.25rem; }

        /* Dropzone */
        .dropzone { border: 1.5px dashed rgba(255,255,255,0.1); border-radius: 10px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; background: rgba(255,255,255,0.02); transition: all 0.2s; width: 100%; }
        .dropzone.active { border-color: #6e56ff; background: rgba(110,86,255,0.07); }
        .drop-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(110,86,255,0.15); color: #8b72ff; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.6rem; }
        .drop-text { font-size: 0.88rem; font-weight: 600; color: #c8c4e0; }
        .drop-sub { font-size: 0.75rem; color: #5a5870; margin-top: 2px; }

        /* Thumb grid */
        .thumb-header { display: flex; align-items: center; justify-content: space-between; margin-top: 0.75rem; margin-bottom: 0.4rem; }
        .thumb-hint { font-size: 0.68rem; color: #3a3850; }
        .clear-btn { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.25); background: rgba(239,68,68,0.08); color: #f87171; font-size: 0.7rem; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .clear-btn:hover { background: rgba(239,68,68,0.15); }

        .thumb-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; max-height: 200px; overflow-y: auto; }
        .thumb { position: relative; aspect-ratio: 1; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); cursor: grab; transition: transform 0.15s, box-shadow 0.15s; user-select: none; }
        .thumb:active { cursor: grabbing; }
        .thumb.drag-over { border-color: #6e56ff; box-shadow: 0 0 0 2px rgba(110,86,255,0.4); transform: scale(0.97); }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .thumb-num { position: absolute; bottom: 2px; left: 3px; background: rgba(0,0,0,0.75); color: #e8e6f0; font-size: 0.55rem; font-weight: 800; border-radius: 3px; padding: 1px 4px; line-height: 1.4; pointer-events: none; }
        .thumb-size { position: absolute; bottom: 2px; right: 18px; background: rgba(0,0,0,0.6); color: #a09aba; font-size: 0.5rem; border-radius: 3px; padding: 1px 3px; line-height: 1.4; pointer-events: none; }
        .thumb-btn { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.7); color: #e8e6f0; border: none; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }

        /* Stats */
        .stats-row { display: flex; gap: 0.6rem; margin-top: 0.75rem; }
        .stat { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.6rem 0.5rem; text-align: center; min-width: 0; }
        .stat-val { font-size: 1.1rem; font-weight: 800; color: #8b72ff; display: block; line-height: 1; margin-bottom: 3px; }
        .stat-label { font-size: 0.62rem; color: #5a5870; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
        .stat-warn { color: #fbbf24 !important; }

        /* Form */
        .field-label { display: block; font-size: 0.78rem; font-weight: 600; color: #7c7a94; margin-bottom: 0.45rem; letter-spacing: 0.04em; }
        .range-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.1rem; }
        .range-row input[type=range] { flex: 1; accent-color: #6e56ff; cursor: pointer; }
        .range-val { min-width: 24px; text-align: center; font-size: 1rem; font-weight: 800; color: #8b72ff; }
        .text-input { width: 100%; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e8e6f0; font-size: 0.88rem; outline: none; transition: border-color 0.2s; font-family: inherit; margin-bottom: 1.1rem; }
        .text-input:focus { border-color: rgba(110,86,255,0.5); }
        .size-row { display: flex; gap: 0.5rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
        .size-btn { flex: 1; min-width: 54px; padding: 0.55rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #5a5870; font-weight: 700; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .size-btn.active { border-color: rgba(110,86,255,0.6); background: rgba(110,86,255,0.15); color: #a590ff; }
        .toggle-row { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
        .toggle-track { width: 34px; height: 19px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); position: relative; transition: all 0.2s; flex-shrink: 0; }
        .toggle-track.on { border-color: rgba(110,86,255,0.6); background: rgba(110,86,255,0.4); }
        .toggle-knob { position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #3a3850; transition: left 0.2s; }
        .toggle-knob.on { left: 17px; background: #8b72ff; }
        .toggle-label { font-size: 0.8rem; color: #7c7a94; font-weight: 600; }

        /* Progress bar */
        .progress-wrap { width: 100%; background: rgba(255,255,255,0.06); border-radius: 100px; height: 6px; margin-bottom: 0.6rem; overflow: hidden; }
        .progress-bar { height: 100%; border-radius: 100px; background: linear-gradient(90deg, #6e56ff, #c084fc); transition: width 0.4s ease; }
        .progress-label { font-size: 0.78rem; color: #7c7a94; text-align: center; margin-bottom: 0.75rem; }

        /* Generate button */
        .gen-btn { width: 100%; padding: 0.95rem 1.5rem; border-radius: 12px; border: none; color: white; font-weight: 700; font-size: 0.92rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.6rem; transition: opacity 0.2s, transform 0.15s; font-family: inherit; margin-bottom: 1rem; }
        .gen-btn.ready { background: linear-gradient(135deg, #6e56ff 0%, #9b72ff 50%, #c084fc 100%); box-shadow: 0 0 32px rgba(110,86,255,0.3); }
        .gen-btn.ready:hover { opacity: 0.9; transform: translateY(-1px); }
        .gen-btn.disabled { background: rgba(255,255,255,0.05); color: #3a3850; cursor: not-allowed; }

        /* Success */
        .success-card { background: linear-gradient(135deg, rgba(110,86,255,0.12), rgba(192,132,252,0.08)); border: 1px solid rgba(110,86,255,0.3); border-radius: 14px; padding: 1.5rem; margin-bottom: 1rem; text-align: center; animation: fadeUp 0.4s ease; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        .success-star { font-size: 1.6rem; margin-bottom: 0.4rem; }
        .success-title { font-size: 1rem; font-weight: 700; color: #c4b5fd; margin-bottom: 0.2rem; }
        .success-sub { font-size: 0.8rem; color: #7c7a94; margin-bottom: 1.1rem; }
        .dl-row { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
        .dl-btn { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.65rem 1.2rem; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.85rem; transition: filter 0.2s; }
        .dl-btn:hover { filter: brightness(1.15); }
        .dl-pdf { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
        .dl-docx { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; }

        /* Divider */
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 2rem 0 1.5rem; }

        /* Support */
        .support-card { background: #12111a; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 2rem 1.5rem; text-align: center; margin-bottom: 1.5rem; }
        .support-tag { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 0.6rem; padding: 4px 12px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); border-radius: 100px; color: #f87171; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .support-title { font-size: 1.1rem; font-weight: 800; color: #f0eeff; margin-bottom: 0.4rem; }
        .support-desc { color: #5a5870; font-size: 0.82rem; max-width: 380px; margin: 0 auto 1.5rem; line-height: 1.6; }
        .payment-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; max-width: 520px; margin-left: auto; margin-right: auto; }
        .payment-badge { display: flex; flex-direction: column; align-items: center; padding: 14px 16px; border-radius: 12px; cursor: pointer; transition: transform 0.15s, filter 0.15s; position: relative; }
        .payment-badge:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .payment-badge.gcash { background: linear-gradient(135deg, #007dfe, #00b4ff); box-shadow: 0 6px 20px rgba(0,125,254,0.25); }
        .payment-badge.maya { background: linear-gradient(135deg, #00b341, #00d94f); box-shadow: 0 6px 20px rgba(0,179,65,0.25); }
        .payment-badge.paypal { background: linear-gradient(135deg, #003087, #009cde); box-shadow: 0 6px 20px rgba(0,48,135,0.25); }
        .pay-logo { font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.8; font-weight: 700; color: white; margin-bottom: 2px; }
        .pay-num { font-size: 1rem; font-weight: 800; color: white; letter-spacing: 0.01em; }
        .pay-name { font-size: 0.7rem; font-weight: 500; opacity: 0.85; color: white; margin-top: 1px; }
        .pay-copy { position: absolute; top: 6px; right: 8px; font-size: 0.55rem; background: rgba(255,255,255,0.2); border-radius: 4px; padding: 2px 5px; color: white; opacity: 0; transition: opacity 0.2s; }
        .payment-badge:hover .pay-copy { opacity: 1; }
        .support-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 1.25rem auto; max-width: 300px; }
        .support-other { font-size: 0.72rem; color: #3a3850; margin-bottom: 0.5rem; }
        .share-row { display: flex; justify-content: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .share-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 7px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); color: #7c7a94; font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; text-decoration: none; }
        .share-btn:hover { border-color: rgba(110,86,255,0.4); color: #a590ff; background: rgba(110,86,255,0.08); }
        .support-email { font-size: 0.78rem; color: #5a5870; font-weight: 600; }
        .support-email a { color: #6e56ff; text-decoration: none; }
        .support-email a:hover { text-decoration: underline; }

        /* Toast */
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1e1c2e; border: 1px solid rgba(110,86,255,0.4); border-radius: 8px; padding: 8px 18px; color: #a590ff; font-size: 0.8rem; font-weight: 600; z-index: 9999; animation: fadeUp 0.3s ease; pointer-events: none; white-space: nowrap; }

        /* Footer */
        .footer { text-align: center; padding: 1.25rem; color: #3a3850; font-size: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04); }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="app-wrap">
        {/* Toast */}
        {toast && <div className="toast">{toast}</div>}

        {/* Hero */}
        <div className="hero">
          <div className="badge"><span className="badge-dot" />Image Grid Creator</div>
          <h1>Smart Layouts <span className="accent"> Zero Effort.</span></h1>
          <p>Upload photos, configure your grid, and download a pixel-perfect PDF or Word file in seconds.</p>
        </div>

        <div className="main">
          {/* Error */}
          {error && (
            <div className="error-box">
              <Icon.Alert /><span>{error}</span>
            </div>
          )}

          {/* Warnings */}
          {warnings.map((w, i) => (
            <div key={i} className="warn-box">
              <Icon.Warn /><span>{w}</span>
            </div>
          ))}

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
                <p className="drop-sub">or click to browse • PNG, JPG, WEBP • max 50MB each</p>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />

              {images.length > 0 && (
                <>
                  <div className="thumb-header">
                    <span className="thumb-hint">↕ drag thumbnails to reorder</span>
                    <button className="clear-btn" onClick={clearAll}><Icon.Trash /> Clear all</button>
                  </div>
                  <div className="thumb-grid">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`thumb${dragOverId === img.id ? ' drag-over' : ''}`}
                        draggable
                        onDragStart={e => onThumbDragStart(e, img.id)}
                        onDragOver={e => onThumbDragOver(e, img.id)}
                        onDragLeave={onThumbDragLeave}
                        onDrop={e => onThumbDrop(e, img.id)}
                        onDragEnd={onThumbDragEnd}
                      >
                        <img src={img.preview} alt="" style={{ pointerEvents: 'none' }} />
                        <span className="thumb-num">#{idx + 1}</span>
                        <span className="thumb-size">{formatBytes(img.size)}</span>
                        <button className="thumb-btn" onClick={(e) => { e.stopPropagation(); remove(img.id); }}><Icon.X /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="stats-row">
                <div className="stat">
                  <span className={`stat-val${images.length >= MAX_IMAGES ? ' stat-warn' : ''}`}>{images.length}/{MAX_IMAGES}</span>
                  <span className="stat-label">Images</span>
                </div>
                <div className="stat">
                  <span className="stat-val">{imagesPerPage}</span>
                  <span className="stat-label">Per page</span>
                </div>
                <div className="stat">
                  <span className="stat-val">{pageCount}</span>
                  <span className="stat-label">Pages</span>
                </div>
                <div className="stat">
                  <span className={`stat-val${totalSize > 40 * 1024 * 1024 ? ' stat-warn' : ''}`}>{formatBytes(totalSize)}</span>
                  <span className="stat-label">Size</span>
                </div>
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
                {['A4', 'Letter', 'Short', 'Long'].map(s => (
                  <button key={s} className={`size-btn${pageSize === s ? ' active' : ''}`} onClick={() => setPageSize(s)}>{s}</button>
                ))}
              </div>

              <div className="toggle-row" onClick={() => setPreserveOrder(p => !p)}>
                <div className={`toggle-track${preserveOrder ? ' on' : ''}`}>
                  <div className={`toggle-knob${preserveOrder ? ' on' : ''}`} />
                </div>
                <span className="toggle-label">
                  {preserveOrder ? 'Using your drag order' : 'Auto-sort by timestamp'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar (only during processing) */}
          {processing && (
            <>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="progress-label">{status || 'Processing…'} ({progress}%)</p>
            </>
          )}

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

          {/* Support */}
          <div className="support-card">
            <div className="support-tag">GO FUND ME</div>
            <h3 className="support-title">Built by Gabriel L.</h3>
            <p className="support-desc">Hi! I'm Gab, creator of this free tool. I'm a student — any support means a lot. Pick any method below!</p>

            <div className="payment-grid">
              <div className="payment-badge gcash" onClick={() => copyText('09121008476', 'GCash number')}>
                <span className="pay-logo">GCash</span>
                <span className="pay-num">0912 100 8476</span>
                <span className="pay-name">Gabriel L.</span>
                <span className="pay-copy">tap to copy</span>
              </div>
              <div className="payment-badge maya" onClick={() => copyText('09123285779', 'Maya number')}>
                <span className="pay-logo">Maya</span>
                <span className="pay-num">0912 328 5779</span>
                <span className="pay-name">Gabriel S.</span>
                <span className="pay-copy">tap to copy</span>
              </div>
              <div className="payment-badge paypal" onClick={() => window.open('https://paypal.me/gabrielsapetin', '_blank')}>
                <span className="pay-logo">PayPal</span>
                <span className="pay-num">paypal.me/</span>
                <span className="pay-name">gabrielsapetin</span>
                <span className="pay-copy">tap to open</span>
              </div>
            </div>

            <div className="support-divider" />
            <p className="support-other">Other ways to help</p>
            <div className="share-row">
              <a className="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=https://image-to-document.vercel.app" target="_blank" rel="noreferrer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                Share on Facebook
              </a>
              <button className="share-btn" onClick={() => copyText('https://image-to-document.vercel.app', 'Link')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                Copy Link
              </button>
            </div>
            <div className="support-divider" />
            <p className="support-email">Questions? <a href="mailto:gabrielsapetin9@gmail.com">gabrielsapetin9@gmail.com</a></p>
          </div>
        </div>

        <div className="footer">© {new Date().getFullYear()} Image-to-Doc · Gabriel L. · All rights reserved</div>
      </div>
    </>
  );
}