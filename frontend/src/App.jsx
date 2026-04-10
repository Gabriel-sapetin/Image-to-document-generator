import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileDown, Zap, CheckCircle, AlertCircle } from 'lucide-react';
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

  // Handle file selection
  const handleFiles = useCallback((files) => {
    console.log('Files selected:', files.length);
    const imageFiles = Array.from(files).filter(file => {
      console.log('Checking file:', file.name, file.type);
      return file.type.startsWith('image/');
    });

    console.log('Valid images:', imageFiles.length);

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

  // Drag and drop handlers
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

  // Remove image from list
  const removeImage = (id) => {
    setUploadedImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      filtered.forEach(img => URL.revokeObjectURL(img.preview));
      return filtered;
    });
  };

  // Process images and generate documents
  const handleGenerateDocuments = async () => {
    if (uploadedImages.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsProcessing(true);
    setError('');
    setDownloadLinks(null);

    try {
      // Step 1: Upload images
      setProcessingStatus('Extracting metadata...');
      console.log('Starting upload with', uploadedImages.length, 'images');
      
      const uploadResponse = await api.uploadImages(
        uploadedImages.map(img => img.file),
        gridCols,
        pageSize,
        documentTitle,
        preserveOrder
      );

      console.log('Upload response:', uploadResponse);

      if (!uploadResponse || !uploadResponse.session_id) {
        throw new Error('Invalid upload response - no session_id');
      }

      const sessionId = uploadResponse.session_id;
      const pageCount = uploadResponse.page_count;

      setProcessingStatus(`Processing ${uploadResponse.image_count} images on ${pageCount} page(s)...`);

      // Step 2: Generate PDF
      setProcessingStatus('Generating PDF...');
      console.log('Generating PDF for session:', sessionId);
      
      const pdfResponse = await api.generatePDF(sessionId, documentTitle, true);
      console.log('PDF response:', pdfResponse);

      // Step 3: Generate DOCX
      setProcessingStatus('Generating Word document...');
      console.log('Generating DOCX for session:', sessionId);
      
      const docxResponse = await api.generateDocx(sessionId, documentTitle);
      console.log('DOCX response:', docxResponse);

      setProcessingStatus('');
      setDownloadLinks({
        pdf: pdfResponse.download_url,
        docx: docxResponse.download_url,
        pages: pageCount
      });

      console.log('✅ All documents generated successfully!');

    } catch (err) {
      console.error('❌ Error:', err);
      setError(`Failed: ${err.message}`);
      setProcessingStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate grid dimensions
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
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginBottom: '1rem'
          }}>
            <Zap size={28} style={{ color: '#2563eb' }} />
            <h1 style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Image Grid Creator
            </h1>
          </div>
          <p style={{
            fontSize: '1.1rem',
            color: '#64748b',
            margin: 0,
            maxWidth: '600px',
            marginX: 'auto'
          }}>
            Transform your images into beautifully organized PDF and Word documents
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center'
          }}>
            <AlertCircle size={20} style={{ color: '#dc2626' }} />
            <span style={{ color: '#dc2626' }}>{error}</span>
          </div>
        )}

        {/* Main Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>

          {/* Upload Section */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '0.5px solid #e2e8f0',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: '600',
              marginBottom: '1.5rem',
              color: '#1e293b'
            }}>
              1. Upload Images
            </h2>

            {/* Drag and Drop Area */}
            <div
              onDrag={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? '#2563eb' : '#cbd5e1'}`,
                borderRadius: '8px',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: dragActive ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.3s ease',
                marginBottom: '1rem'
              }}
            >
              <Upload size={32} style={{
                color: '#2563eb',
                marginBottom: '0.75rem',
                margin: '0 auto 0.75rem'
              }} />
              <p style={{
                fontSize: '1rem',
                fontWeight: '600',
                color: '#1e293b',
                margin: '0.5rem 0 0.25rem'
              }}>
                Drag and drop images here
              </p>
              <p style={{
                fontSize: '0.9rem',
                color: '#64748b',
                margin: 0
              }}>
                or click to browse your computer
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFiles(e.target.files)}
              style={{ display: 'none' }}
            />

            {/* Image Count */}
            {uploadedImages.length > 0 && (
              <div style={{
                background: '#eff6ff',
                border: '0.5px solid #bfdbfe',
                borderRadius: '6px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle size={18} style={{ color: '#0284c7' }} />
                <span style={{ color: '#0284c7', fontSize: '0.9rem', fontWeight: '500' }}>
                  {uploadedImages.length} image{uploadedImages.length !== 1 ? 's' : ''} ready ({(uploadedImages.reduce((sum, img) => sum + parseFloat(img.size), 0)).toFixed(2)} MB)
                </span>
              </div>
            )}

            {/* Image Grid Preview */}
            {uploadedImages.length > 0 && (
              <div style={{
                maxHeight: '280px',
                overflowY: 'auto',
                border: '0.5px solid #e2e8f0',
                borderRadius: '6px',
                padding: '0.75rem'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem'
                }}>
                  {uploadedImages.map((img) => (
                    <div key={img.id} style={{
                      position: 'relative',
                      aspectRatio: '1',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: '#f1f5f9',
                      border: '0.5px solid #e2e8f0'
                    }}>
                      <img
                        src={img.preview}
                        alt={img.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        style={{
                          position: 'absolute',
                          top: '0.25rem',
                          right: '0.25rem',
                          background: 'rgba(0, 0, 0, 0.6)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          width: '24px',
                          height: '24px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            border: '0.5px solid #e2e8f0',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}>
            <h2 style={{
              fontSize: '1.3rem',
              fontWeight: '600',
              marginBottom: '1.5rem',
              color: '#1e293b'
            }}>
              2. Configure
            </h2>

            {/* Grid Columns */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#475569'
              }}>
                Grid Layout: {gridCols} columns
              </label>
              <input
                type="range"
                min="1"
                max="4"
                value={gridCols}
                onChange={(e) => setGridCols(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '2px',
                  background: '#e2e8f0',
                  outline: 'none',
                  cursor: 'pointer',
                  marginBottom: '0.75rem'
                }}
              />
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem'
              }}>
                {[1, 2, 3, 4].map(cols => (
                  <button
                    key={cols}
                    onClick={() => setGridCols(cols)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: `1.5px solid ${gridCols === cols ? '#2563eb' : '#e2e8f0'}`,
                      background: gridCols === cols ? '#eff6ff' : 'white',
                      color: gridCols === cols ? '#2563eb' : '#64748b',
                      fontWeight: '500',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {cols}×{Math.ceil(uploadedImages.length / (cols * 2))}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Size */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.75rem',
                color: '#475569'
              }}>
                Page Size
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {['A4', 'LETTER'].map(size => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: `1.5px solid ${pageSize === size ? '#2563eb' : '#e2e8f0'}`,
                      background: pageSize === size ? '#eff6ff' : 'white',
                      color: pageSize === size ? '#2563eb' : '#64748b',
                      fontWeight: '500',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Document Title */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '0.5rem',
                color: '#475569'
              }}>
                Document Title
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '0.5px solid #e2e8f0',
                  fontSize: '0.95rem',
                  boxSizing: 'border-box'
                }}
                placeholder="My Photo Collection"
              />
            </div>

            {/* Options */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.9rem',
                color: '#475569',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={preserveOrder}
                  onChange={(e) => setPreserveOrder(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Preserve upload order (ignore timestamps)
              </label>
            </div>

            {/* Stats */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{
                fontSize: '0.85rem',
                color: '#64748b',
                lineHeight: '1.6'
              }}>
                <div>📊 {uploadedImages.length} images</div>
                <div>📄 {pageCount} page{pageCount !== 1 ? 's' : ''} ({gridCols} cols)</div>
                <div>⏱️ Smart timestamp sequencing enabled</div>
              </div>
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={handleGenerateDocuments}
            disabled={isProcessing || uploadedImages.length === 0}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '8px',
              border: 'none',
              background: isProcessing || uploadedImages.length === 0 ? '#cbd5e1' : 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              color: 'white',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isProcessing || uploadedImages.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.3s',
              boxShadow: '0 4px 6px rgba(37, 99, 235, 0.3)'
            }}
          >
            {isProcessing ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                {processingStatus}
              </>
            ) : (
              <>
                <FileDown size={20} />
                Generate PDF & Word
              </>
            )}
          </button>
        </div>

        {/* Download Links */}
{downloadLinks && (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    border: '0.5px solid #e2e8f0',
    padding: '2rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    marginBottom: '2rem'
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      marginBottom: '1.5rem'
    }}>
      <CheckCircle size={24} style={{ color: '#16a34a' }} />
      <h3 style={{
        fontSize: '1.3rem',
        fontWeight: '600',
        color: '#16a34a',
        margin: 0
      }}>
        Documents Ready! ({downloadLinks.pages} pages)
      </h3>
    </div>

    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem'
    }}>
      
        href={downloadLinks.pdf}
        download
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '8px',
          background: '#fee2e2',
          color: '#991b1b',
          textDecoration: 'none',
          fontWeight: '600',
          border: '0.5px solid #fecaca',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#fecaca';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#fee2e2';
        }}
    
        <FileDown size={20} />
        <a>Download PDF
      </a>
      
        href={downloadLinks.docx}
        download
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '8px',
          background: '#dbeafe',
          color: '#1e40af',
          textDecoration: 'none',
          fontWeight: '600',
          border: '0.5px solid #93c5fd',
          transition: 'all 0.2s',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#93c5fd';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = '#dbeafe';
        }}
      
        <FileDown size={20}/>
        <a>Download Word
      </a>
    </div>

    <button
      onClick={() => {
        setDownloadLinks(null);
        setUploadedImages([]);
        setDocumentTitle('Image Collection');
      }}
      style={{
        width: '100%',
        marginTop: '1rem',
        padding: '0.75rem',
        borderRadius: '6px',
        border: '0.5px solid #e2e8f0',
        background: 'white',
        color: '#475569',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '0.9rem'
      }}
    >
      Start Over
    </button>
  </div>
)}

        {/* CSS Animations */}
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          input[type="range"] {
            appearance: none;
            -webkit-appearance: none;
          }
          input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #2563eb;
            cursor: pointer;
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #2563eb;
            cursor: pointer;
            border: none;
          }
        `}</style>
      </div>
    </div>
  );
};

export default ImageToDocumentApp;