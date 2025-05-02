import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { uploadFile } from '../../lib/api/client';
import { DatasetItem } from '../../types/models';
import { UploadCloud, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileUploaded: (file: DatasetItem) => void;
}

export function FileUpload({ onFileUploaded }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    setIsUploading(true);
    setUploadError(null);
    
    try {
      const uploadedFile = await uploadFile(file);
      onFileUploaded(uploadedFile);
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload file: ' + (error.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  }, [onFileUploaded]);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    multiple: false,
  });
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Dataset</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-md p-6 cursor-pointer text-center
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/20'}
            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2">
            {isDragActive ? (
              <UploadCloud className="h-8 w-8 text-primary" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            
            {isDragActive ? (
              <p>Drop the file here...</p>
            ) : isUploading ? (
              <p>Uploading...</p>
            ) : (
              <div>
                <p className="text-sm font-medium">Drag & drop a file here, or click to select</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports TXT, CSV, PDF, DOCX, MD, SQL, YAML, WAV, and other formats
                </p>
              </div>
            )}
          </div>
        </div>
        
        {uploadError && (
          <div className="mt-2 text-sm text-destructive">{uploadError}</div>
        )}
        
        <div className="mt-4 flex justify-center">
          <Button
            disabled={isUploading}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            {isUploading ? 'Uploading...' : 'Select File'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}