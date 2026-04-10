import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileDown, Zap, CheckCircle, AlertCircle, Heart } from 'lucide-react';
import { api } from './utils/api';

const ImageToDocumentApp = () => {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [gridCols, setGridCols] = useState(2);
  const [pageSize, setPageSize] = useState('A4');
  const [documentTitle, setDocumentTitle] = useState('Image Collection');
  const [preserveOrder, setPreserveOrder] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [downloadLinks, setDownloadLinks] = useState(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, [uploadedImages]);

  const handleFiles = useCallback((files) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const newImages = imageFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2)
    }));
    setUploadedImages(prev => [...prev, ...newImages]);
    setError('');
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type !== 'dragleave' && e.type !== 'drop');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (id) => {
    setUploadedImages(prev => {
      const target = prev.find(img => img.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(img => img.id !== id);
    });
  };

  const handleGenerateDocuments = async () => {
    if (uploadedImages.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsProcessing(true);
    setError('');
    setDownloadLinks(null);

    try {
      setProcessingStatus('Extracting metadata...');
      const uploadResponse = await api.uploadImages(
        uploadedImages.map(img => img.file),
        gridCols,
        pageSize,
        documentTitle,
        preserveOrder
      );

      if (!uploadResponse || !uploadResponse.session_id) {
        throw new Error('Invalid upload response');
      }

      const sessionId = uploadResponse.session_id;
      setProcessingStatus('Generating PDF...');
      const pdfResponse = await api.generatePDF(sessionId, documentTitle, true);

      setProcessingStatus('Generating Word document...');
      const docxResponse = await api.generateDocx(sessionId, documentTitle);

      setProcessingStatus('');
      setDownloadLinks({
        pdf: pdfResponse.download_url,
        docx: docxResponse.download_url,
        pages: uploadResponse.page_count
      });
    } catch (err) {
      setError(`Failed: ${err.message}`);
      setProcessingStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateGridDimensions = () => {
    const totalImages = uploadedImages.length;
    const imagesPerPage = gridCols * 2;
    const pageCount = Math.ceil(totalImages / imagesPerPage);
    return { pageCount, imagesPerPage };
  };

  const { pageCount } = calculateGridDimensions();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem 1rem'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Zap size={28} style={{ color: '#2563eb' }} />
            <h1 style={{
              fontSize: '2.5rem', fontWeight: '700', margin: 0,
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>
              Image Grid Creator
            </h1>
          </div>
          <p style={{ fontSize: '1.1rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
            Transform your images into organized PDF and Word documents.
          </p>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <AlertCircle size={20} style={{ color: '#dc2626' }} />
            <span style={{ color: '#dc2626' }}>{error}</span>
          </div>
        )}

        {/* Setup Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          {/* 1. Upload */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem' }}>1. Upload Images</h2>
            <div
              onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? '#2563eb' : '#cbd5e1'}`,
                borderRadius: '8px', padding: '2rem', textAlign: 'center', cursor: 'pointer',
                backgroundColor: dragActive ? '#eff6ff' : '#f8fafc'
              }}
            >
              <Upload size={32} style={{ color: '#2563eb', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: '600', margin: '0' }}>Click or drag images here</p>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
            
            {uploadedImages.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                {uploadedImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <img src={img.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="thumb" />
                    <button onClick={() => removeImage(img.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Configure */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '600', marginBottom: '1.5rem' }}>2. Configure</h2>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '500' }}>Columns: {gridCols}</label>
              <input type="range" min="1" max="4" value={gridCols} onChange={(e) => setGridCols(parseInt(e.target.value))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: '500' }}>Title</label>
              <input type="text" value={documentTitle} onChange={(e) => setDocumentTitle(e.target.value)} style={{ width: '100%', padding: '0.6rem', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
            </div>
            <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#64748b' }}>
              Summary: {uploadedImages.length} images | Approx {pageCount} pages
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerateDocuments}
          disabled={isProcessing || uploadedImages.length === 0}
          style={{
            width: '100%', padding: '1rem', borderRadius: '12px', border: 'none',
            background: isProcessing || uploadedImages.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
            color: 'white', fontWeight: '700', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem'
          }}
        >
          {isProcessing ? processingStatus : <><FileDown size={20} /> Generate Files</>}
        </button>

        {downloadLinks && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', marginTop: '1.5rem', textAlign: 'center', border: '2px solid #16a34a' }}>
            <h3 style={{ color: '#16a34a', marginTop: 0 }}>Done! Download below:</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a href={downloadLinks.pdf} style={{ padding: '0.6rem 1.2rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' }}>PDF</a>
              <a href={downloadLinks.docx} style={{ padding: '0.6rem 1.2rem', background: '#dbeafe', color: '#1e40af', borderRadius: '6px', textDecoration: 'none', fontWeight: '600' }}>Word</a>
            </div>
          </div>
        )}

        {/* DONATION & FOOTER SECTION */}
        <div style={{
          marginTop: '60px',
          padding: '40px 20px',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(10px)',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          textAlign: 'center',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
            <div style={{ background: '#007dfe', padding: '10px', borderRadius: '50%', color: 'white' }}>
              <Heart size={24} fill="white" />
            </div>
          </div>
          
          <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1e293b', margin: '0 0 10px 0' }}>
            Support My Studies
          </h3>
          <p style={{ color: '#64748b', maxWidth: '450px', margin: '0 auto 20px auto', fontSize: '0.9rem', lineHeight: '1.5' }}>
            I'm Gabriel Laag, a student building tools to make school/work easier. This app is free, but if it helped you, a small <strong>GCash</strong> donation would be a huge help!
          </p>

          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '15px 30px',
            background: '#007dfe',
            color: 'white',
            borderRadius: '15px',
            boxShadow: '0 4px 14px 0 rgba(0, 125, 254, 0.39)'
          }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.9, textTransform: 'uppercase', letterSpacing: '1px' }}>GCash Number</span>
            <span style={{ fontSize: '1.4rem', fontWeight: '800' }}>0951 944 5551</span>
            <span style={{ fontSize: '0.85rem', marginTop: '4px', fontWeight: '500' }}>Account: Graciel S.</span>
          </div>
          
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #cbd5e1', color: '#64748b', fontSize: '0.85rem' }}>
            <p style={{ margin: '5px 0' }}>Email: <strong>gabrielsapetin9@gmail.com</strong></p>
            <p style={{ margin: '5px 0', opacity: 0.7 }}>© {new Date().getFullYear()} Image-to-Doc | SNSU Student</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageToDocumentApp;