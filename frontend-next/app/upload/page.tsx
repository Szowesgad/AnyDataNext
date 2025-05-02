'use client'

import { useState } from 'react'
import { FileUpload } from '../../components/forms/FileUpload'
import { ProgressIndicator } from '../../components/data-display/ProgressIndicator'
import { processFile } from '../../lib/api/client'
import { DatasetItem, ProcessingOptions, ProcessingResult } from '../../types/models'

export default function UploadPage() {
  const [currentFile, setCurrentFile] = useState<DatasetItem | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [processingError, setProcessingError] = useState<string | null>(null)
  
  const handleFileUploaded = (file: DatasetItem) => {
    setCurrentFile(file)
    setProcessingResult(null)
    setProcessingError(null)
  }
  
  const handleProcessClick = async () => {
    if (!currentFile) return
    
    setIsProcessing(true)
    setProcessingError(null)
    
    try {
      // Prosty domyślny obiekt opcji dla proof of concept - w pełnej wersji użyj ProcessingConfigurator
      const options: ProcessingOptions = {
        model_provider: 'openai',
        model_name: 'gpt-3.5-turbo',
        processing_type: 'standard',
        processing_options: {},
        parallel_processing: true,
        max_workers: 3
      }
      
      const result = await processFile(currentFile.id, options)
      setProcessingResult(result)
    } catch (error: any) {
      console.error('Processing error:', error)
      setProcessingError('Failed to process file: ' + (error.message || 'Unknown error'))
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Process Single File</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <FileUpload onFileUploaded={handleFileUploaded} />
          
          {currentFile && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">File Details</h2>
              <p><strong>Name:</strong> {currentFile.name}</p>
              <p><strong>Type:</strong> {currentFile.file_type}</p>
              <p><strong>Size:</strong> {Math.round(currentFile.size / 1024)} KB</p>
              
              <button 
                className="mt-4 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
                disabled={isProcessing}
                onClick={handleProcessClick}
              >
                {isProcessing ? 'Processing...' : 'Process File'}
              </button>
            </div>
          )}
          
          {processingError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-md text-destructive">
              {processingError}
            </div>
          )}
        </div>
        
        <div>
          {processingResult?.job_id && (
            <ProgressIndicator jobId={processingResult.job_id} />
          )}
        </div>
      </div>
    </div>
  )
}