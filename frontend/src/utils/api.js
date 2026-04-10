/**
 * API client - uses relative paths (proxied by Vite)
 */

const API_BASE_URL = '/api';  // ✅ Use relative path, NOT http://localhost:8000

export const api = {
  async uploadImages(files, gridCols, pageSize, documentTitle, preserveOrder) {
    console.log('Uploading', files.length, 'images...');
    
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('grid_cols', gridCols);
    formData.append('page_size', pageSize);
    formData.append('document_title', documentTitle);
    formData.append('preserve_order', preserveOrder);
    
    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      
      console.log('Upload response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('Upload error:', text);
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Upload success:', data);
      return data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },
  
  async generatePDF(sessionId, documentTitle, includePageNumbers) {
    console.log('Generating PDF for session:', sessionId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          document_title: documentTitle,
          include_page_numbers: includePageNumbers
        })
      });
      
      console.log('PDF response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('PDF error:', text);
        throw new Error(`PDF generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('PDF success:', data);
      return data;
    } catch (error) {
      console.error('PDF error:', error);
      throw error;
    }
  },
  
  async generateDocx(sessionId, documentTitle) {
    console.log('Generating DOCX for session:', sessionId);
    
    try {
      const response = await fetch(`${API_BASE_URL}/generate-docx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          document_title: documentTitle
        })
      });
      
      console.log('DOCX response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.error('DOCX error:', text);
        throw new Error(`DOCX generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('DOCX success:', data);
      return data;
    } catch (error) {
      console.error('DOCX error:', error);
      throw error;
    }
  }
};