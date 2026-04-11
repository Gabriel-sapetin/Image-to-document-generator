const API_BASE = "/_/backend";

export const api = {
  uploadImages: async (files, gridCols, pageSize, documentTitle, preserveOrder) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    
    const params = new URLSearchParams({
      grid_cols: gridCols,
      page_size: pageSize,
      document_title: documentTitle,
      preserve_order: preserveOrder
    });

    const response = await fetch(`${API_BASE}/upload?${params}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  },

  generatePDF: async (sessionId, documentTitle, includePageNumbers) => {
    const response = await fetch(`${API_BASE}/generate-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        document_title: documentTitle,
        include_page_numbers: includePageNumbers
      }),
    });

    if (!response.ok) throw new Error('PDF generation failed');
    return response.json();
  },

  generateDocx: async (sessionId, documentTitle) => {
    const response = await fetch(`${API_BASE}/generate-docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        document_title: documentTitle
      }),
    });

    if (!response.ok) throw new Error('Word generation failed');
    return response.json();
  }
};