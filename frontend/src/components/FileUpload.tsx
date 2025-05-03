'use client';

import React, { useState, useCallback } from 'react';
import axios from 'axios'; // Using axios for easier handling

interface FileUploadProps {
  onUploadSuccess: (fileInfo: { fileId: string; originalFilename: string; size: number }) => void;
  backendUrl?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onUploadSuccess, 
  backendUrl // Expect URL from props, remove default here
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setUploadStatus('idle');
      setErrorMessage(null);
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setSelectedFile(event.dataTransfer.files[0]);
      setUploadStatus('idle');
      setErrorMessage(null);
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploadStatus('uploading');
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      const response = await axios.post(`${backendUrl}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percentCompleted);
        },
      });

      if (response.status === 200 && response.data.file_id) {
        setUploadStatus('success');
        onUploadSuccess({
          fileId: response.data.file_id,
          originalFilename: response.data.original_filename,
          size: response.data.size,
        });
         // Optionally reset selected file after successful upload
         // setSelectedFile(null);
      } else {
        throw new Error(response.data.detail || 'Upload failed with status: ' + response.status);
      }
    } catch (error: any) { // Use any for broader error catching initially
      console.error("Upload error:", error);
      setUploadStatus('error');
      let detail = 'An unknown error occurred during upload.';
      if (axios.isAxiosError(error)) {
        detail = error.response?.data?.detail || error.message || detail;
      } else if (error instanceof Error) {
        detail = error.message;
      }
      setErrorMessage(detail);
    }
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-white shadow-sm">
      <div 
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer 
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          transition-colors duration-200 ease-in-out`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById('fileInput')?.click()} // Trigger file input click
      >
        <input 
          id="fileInput" 
          type="file" 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
        <p className="mb-2 text-sm text-gray-500">
          <span className="font-semibold">Click to upload</span> or drag and drop
        </p>
        <p className="text-xs text-gray-500">Any file type supported by backend</p>
      </div>

      {selectedFile && (
        <div className="mt-4 text-sm">
          <p>Selected file: <span className="font-medium">{selectedFile.name}</span> ({Math.round(selectedFile.size / 1024)} KB)</p>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-width duration-300 ease-out" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-xs text-center mt-1">Uploading... {uploadProgress}%</p>
        </div>
      )}

      {uploadStatus === 'success' && (
        <p className="mt-4 text-sm text-green-600">✅ File uploaded successfully!</p>
      )}

      {uploadStatus === 'error' && (
        <p className="mt-4 text-sm text-red-600">❌ Upload failed: {errorMessage}</p>
      )}

      <button 
        onClick={handleUpload} 
        disabled={!selectedFile || uploadStatus === 'uploading'}
        className={`mt-4 w-full px-4 py-2 text-white rounded-md transition-colors duration-200 ease-in-out 
          ${!selectedFile || uploadStatus === 'uploading' 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload File'}
      </button>
    </div>
  );
};

export default FileUpload;
