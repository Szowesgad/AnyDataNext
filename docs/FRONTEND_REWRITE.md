# Frontend Rewrite Instructions for AI Agent
(c)2025 by M&K

## Overview
This document provides detailed instructions for rewriting the AnyDataset frontend using Next.js, TypeScript, Tailwind CSS, and shadcn/ui. The new frontend should maintain feature parity with the existing implementation while improving code quality, type safety, and user experience.

## Project Setup
1. Run `./docs/frontend_init.sh` to bootstrap the Next.js project structure
2. Analyze existing frontend in `/frontend` directory to understand current implementation
3. Create equivalent components in the new structure as outlined below

## Type Definitions
Create the following TypeScript interfaces in `/src/types/models.ts`:

```typescript
export interface DatasetItem {
  id: string;
  name: string;
  metadata: Record<string, any>;
  processed: boolean;
  created_at: string;
  file_type: string;
  size: number;
}

export interface ProcessingOptions {
  model_provider: string;
  model_name: string;
  processing_type: string;
  processing_options: Record<string, any>;
  parallel_processing: boolean;
  max_workers?: number;
}

export interface ProcessingResult {
  success: boolean;
  job_id?: string;
  error_message?: string;
  processed_files?: number;
  total_files?: number;
}

export interface ProgressStatus {
  job_id: string;
  current: number;
  total: number;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
  result?: any;
}

export interface ModelProvider {
  id: string;
  name: string;
  models: Model[];
  available: boolean;
}

export interface Model {
  id: string;
  name: string;
  max_tokens: number;
  context_window: number;
  available: boolean;
}
```

## API Client
Create a comprehensive API client in `/src/lib/api/client.ts`:

```typescript
import axios from 'axios';
import { DatasetItem, ProcessingOptions, ProcessingResult, ProgressStatus } from '@/types/models';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchDatasets = async (): Promise<DatasetItem[]> => {
  const response = await apiClient.get('/datasets');
  return response.data;
};

export const uploadFile = async (file: File): Promise<DatasetItem> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const processFile = async (
  fileId: string, 
  options: ProcessingOptions
): Promise<ProcessingResult> => {
  const response = await apiClient.post(`/process/${fileId}`, options);
  return response.data;
};

export const batchProcess = async (
  fileIds: string[],
  options: ProcessingOptions
): Promise<ProcessingResult> => {
  const response = await apiClient.post('/batch/process', {
    file_ids: fileIds,
    options,
  });
  return response.data;
};

export const getModelProviders = async () => {
  const response = await apiClient.get('/models');
  return response.data;
};

export const getJobProgress = async (jobId: string): Promise<ProgressStatus> => {
  const response = await apiClient.get(`/jobs/${jobId}/progress`);
  return response.data;
};

export const downloadResults = async (jobId: string) => {
  const response = await apiClient.get(`/jobs/${jobId}/download`, {
    responseType: 'blob',
  });
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `results-${jobId}.zip`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default {
  fetchDatasets,
  uploadFile,
  processFile,
  batchProcess,
  getModelProviders,
  getJobProgress,
  downloadResults,
};
```

## WebSocket Setup
Create a WebSocket client for real-time progress updates in `/src/lib/api/websocket.ts`:

```typescript
import { ProgressStatus } from '@/types/models';

export type ProgressHandler = (progress: ProgressStatus) => void;

export class WebSocketService {
  private socket: WebSocket | null = null;
  private progressHandlers: Map<string, ProgressHandler[]> = new Map();
  private baseUrl: string;
  
  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_API_HOST || window.location.host;
    this.baseUrl = `${protocol}//${host}/ws`;
  }
  
  connect(jobId: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'subscribe', job_id: jobId }));
      return;
    }
    
    this.socket = new WebSocket(`${this.baseUrl}/progress/${jobId}`);
    
    this.socket.onopen = () => {
      console.log(`WebSocket connected for job ${jobId}`);
    };
    
    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ProgressStatus;
        
        if (data.job_id) {
          const handlers = this.progressHandlers.get(data.job_id) || [];
          handlers.forEach(handler => handler(data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.socket.onclose = () => {
      console.log('WebSocket connection closed');
    };
  }
  
  subscribe(jobId: string, handler: ProgressHandler): () => void {
    if (!this.progressHandlers.has(jobId)) {
      this.progressHandlers.set(jobId, []);
      this.connect(jobId);
    }
    
    const handlers = this.progressHandlers.get(jobId)!;
    handlers.push(handler);
    
    return () => {
      const updatedHandlers = handlers.filter(h => h !== handler);
      
      if (updatedHandlers.length === 0) {
        this.progressHandlers.delete(jobId);
        
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'unsubscribe', job_id: jobId }));
        }
      } else {
        this.progressHandlers.set(jobId, updatedHandlers);
      }
    };
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.progressHandlers.clear();
  }
}

export const webSocketService = new WebSocketService();
```

## Component Structure
Implement the following key components with detailed functionality:

### 1. FileUpload Component
Create `/src/components/forms/FileUpload.tsx` for file uploading:

```typescript
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/ui/icons';
import { uploadFile } from '@/lib/api/client';
import { DatasetItem } from '@/types/models';

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
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Failed to upload file. Please try again.');
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
            <Icons.upload className="h-8 w-8 text-muted-foreground" />
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
```

### 2. ProcessingConfigurator Component
Create `/src/components/forms/ProcessingConfigurator.tsx` for configuring processing options:

```typescript
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { getModelProviders } from '@/lib/api/client';
import { Model, ModelProvider, ProcessingOptions } from '@/types/models';

interface ProcessingConfiguratorProps {
  onSubmit: (options: ProcessingOptions) => void;
  isSubmitting: boolean;
}

export function ProcessingConfigurator({ onSubmit, isSubmitting }: ProcessingConfiguratorProps) {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [processingType, setProcessingType] = useState<string>('standard');
  const [parallelProcessing, setParallelProcessing] = useState<boolean>(true);
  const [maxWorkers, setMaxWorkers] = useState<number>(3);
  
  const availableModels = selectedProvider
    ? providers.find(p => p.id === selectedProvider)?.models.filter(m => m.available) || []
    : [];
  
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const data = await getModelProviders();
        setProviders(data.providers);
        
        // Select first available provider and model by default
        const firstProvider = data.providers.find(p => p.available);
        if (firstProvider) {
          setSelectedProvider(firstProvider.id);
          
          const firstModel = firstProvider.models.find(m => m.available);
          if (firstModel) {
            setSelectedModel(firstModel.id);
          }
        }
      } catch (error) {
        console.error('Error fetching model providers:', error);
        setError('Failed to load model providers');
      } finally {
        setLoading(false);
      }
    };
    
    fetchProviders();
  }, []);
  
  const handleSubmit = () => {
    const options: ProcessingOptions = {
      model_provider: selectedProvider,
      model_name: selectedModel,
      processing_type: processingType,
      processing_options: {},
      parallel_processing: parallelProcessing,
      max_workers: parallelProcessing ? maxWorkers : 1,
    };
    
    onSubmit(options);
  };
  
  if (loading) {
    return <div className="text-center py-4">Loading available models...</div>;
  }
  
  if (error) {
    return <div className="text-destructive text-center py-4">{error}</div>;
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Processing Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Model Provider</Label>
            <Select
              value={selectedProvider}
              onValueChange={setSelectedProvider}
              disabled={isSubmitting}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers
                  .filter(provider => provider.available)
                  .map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={selectedModel}
              onValueChange={setSelectedModel}
              disabled={isSubmitting || !selectedProvider || availableModels.length === 0}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="processingType">Processing Type</Label>
            <Select
              value={processingType}
              onValueChange={setProcessingType}
              disabled={isSubmitting}
            >
              <SelectTrigger id="processingType">
                <SelectValue placeholder="Select processing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="articles">Articles</SelectItem>
                <SelectItem value="dictionary">Dictionary</SelectItem>
                <SelectItem value="translate">Translation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="parallelProcessing"
              checked={parallelProcessing}
              onCheckedChange={(checked) => setParallelProcessing(checked as boolean)}
              disabled={isSubmitting}
            />
            <Label htmlFor="parallelProcessing">Enable Parallel Processing</Label>
          </div>
          
          {parallelProcessing && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between">
                <Label htmlFor="maxWorkers">Max Concurrent Workers: {maxWorkers}</Label>
              </div>
              <Slider
                id="maxWorkers"
                value={[maxWorkers]}
                min={1}
                max={10}
                step={1}
                onValueChange={(value) => setMaxWorkers(value[0])}
                disabled={isSubmitting}
              />
            </div>
          )}
          
          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedProvider || !selectedModel}
          >
            {isSubmitting ? 'Processing...' : 'Start Processing'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. ExistingDatasets Component
Create `/src/components/data-display/ExistingDatasets.tsx` for displaying uploaded datasets:

```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchDatasets } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { DatasetItem } from '@/types/models';

interface ExistingDatasetsProps {
  onSelect: (datasets: DatasetItem[]) => void;
  refreshTrigger?: number;
}

export function ExistingDatasets({ onSelect, refreshTrigger = 0 }: ExistingDatasetsProps) {
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const loadDatasets = async () => {
      try {
        setLoading(true);
        const data = await fetchDatasets();
        setDatasets(data);
      } catch (error) {
        console.error('Error fetching datasets:', error);
        setError('Failed to load existing datasets');
      } finally {
        setLoading(false);
      }
    };
    
    loadDatasets();
  }, [refreshTrigger]);
  
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    
    setSelectedIds(newSelected);
  };
  
  const handleProcessSelected = () => {
    const selectedDatasets = datasets.filter(dataset => selectedIds.has(dataset.id));
    onSelect(selectedDatasets);
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  if (loading) {
    return <div className="text-center py-4">Loading datasets...</div>;
  }
  
  if (error) {
    return <div className="text-destructive text-center py-4">{error}</div>;
  }
  
  if (datasets.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Existing Datasets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No datasets found. Upload a file to get started.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Existing Datasets</CardTitle>
        {selectedIds.size > 0 && (
          <Button onClick={handleProcessSelected}>
            Process Selected ({selectedIds.size})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {datasets.map(dataset => (
            <div
              key={dataset.id}
              className={`flex items-center p-3 rounded-md border cursor-pointer 
                ${selectedIds.has(dataset.id) ? 'border-primary bg-primary/5' : 'border-border'}
              `}
              onClick={() => toggleSelect(dataset.id)}
            >
              <div className="flex-shrink-0 mr-3">
                <Icons.fileType className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="flex-grow">
                <div className="font-medium">{dataset.name}</div>
                <div className="text-sm text-muted-foreground flex gap-2">
                  <span>{dataset.file_type.toUpperCase()}</span>
                  <span>•</span>
                  <span>{formatFileSize(dataset.size)}</span>
                  <span>•</span>
                  <span>{new Date(dataset.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex-shrink-0 ml-2">
                {dataset.processed ? (
                  <Icons.checkCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Icons.circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 4. ProgressIndicator Component
Create `/src/components/data-display/ProgressIndicator.tsx` for displaying processing progress:

```typescript
import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { webSocketService } from '@/lib/api/websocket';
import { downloadResults, getJobProgress } from '@/lib/api/client';
import { ProgressStatus } from '@/types/models';

interface ProgressIndicatorProps {
  jobId: string;
  onComplete?: () => void;
}

export function ProgressIndicator({ jobId, onComplete }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState<ProgressStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchInitialProgress = async () => {
      try {
        const initialProgress = await getJobProgress(jobId);
        setProgress(initialProgress);
        
        if (initialProgress.status === 'completed' && onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error('Error fetching initial progress:', error);
        setError('Failed to load processing status');
      }
    };
    
    fetchInitialProgress();
    
    const unsubscribe = webSocketService.subscribe(jobId, (updatedProgress) => {
      setProgress(updatedProgress);
      
      if (updatedProgress.status === 'completed' && onComplete) {
        onComplete();
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [jobId, onComplete]);
  
  const handleDownload = async () => {
    try {
      await downloadResults(jobId);
    } catch (error) {
      console.error('Error downloading results:', error);
      setError('Failed to download results');
    }
  };
  
  if (!progress) {
    return <div className="text-center py-4">Loading progress...</div>;
  }
  
  if (error) {
    return <div className="text-destructive text-center py-4">{error}</div>;
  }
  
  const progressPercentage = progress.total > 0
    ? Math.floor((progress.current / progress.total) * 100)
    : 0;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Processing Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {progressPercentage}%</span>
            <span>{progress.current} of {progress.total}</span>
          </div>
          <Progress value={progressPercentage} />
        </div>
        
        {progress.status === 'in_progress' && (
          <div className="text-center text-muted-foreground">
            Processing files... This may take a few minutes.
          </div>
        )}
        
        {progress.status === 'completed' && (
          <div className="text-center text-green-600 font-medium">
            Processing complete!
          </div>
        )}
        
        {progress.status === 'failed' && (
          <div className="text-center text-destructive">
            <div className="font-medium">Processing failed</div>
            {progress.error && <div className="text-sm mt-1">{progress.error}</div>}
          </div>
        )}
      </CardContent>
      
      {progress.status === 'completed' && (
        <CardFooter>
          <Button className="w-full" onClick={handleDownload}>
            Download Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
```

### 5. Main Pages
Create the following main page components:

#### Home Page (`/src/app/page.tsx`):
```typescript
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-6">AnyDataset</h1>
      <p className="text-xl text-center max-w-2xl mb-8">
        Process any dataset with AI. Convert audio, text, and documents into structured data.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/upload">
          <Button size="lg" className="w-full">
            Upload Single File
          </Button>
        </Link>
        <Link href="/batch">
          <Button size="lg" className="w-full" variant="outline">
            Batch Processing
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

#### Upload Page (`/src/app/upload/page.tsx`):
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileUpload } from '@/components/forms/FileUpload';
import { ProcessingConfigurator } from '@/components/forms/ProcessingConfigurator';
import { ProgressIndicator } from '@/components/data-display/ProgressIndicator';
import { processFile } from '@/lib/api/client';
import { DatasetItem, ProcessingOptions, ProcessingResult } from '@/types/models';

export default function UploadPage() {
  const router = useRouter();
  const [currentFile, setCurrentFile] = useState<DatasetItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const handleFileUploaded = (file: DatasetItem) => {
    setCurrentFile(file);
    setProcessingResult(null);
    setProcessingError(null);
  };
  
  const handleProcess = async (options: ProcessingOptions) => {
    if (!currentFile) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      const result = await processFile(currentFile.id, options);
      setProcessingResult(result);
    } catch (error) {
      console.error('Processing error:', error);
      setProcessingError('Failed to process file. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleProcessingComplete = () => {
    // Optional: Perform any actions needed after processing completes
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Process Single File</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <FileUpload onFileUploaded={handleFileUploaded} />
          
          {currentFile && (
            <div className="mt-6">
              <ProcessingConfigurator 
                onSubmit={handleProcess} 
                isSubmitting={isProcessing} 
              />
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
            <ProgressIndicator 
              jobId={processingResult.job_id} 
              onComplete={handleProcessingComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

#### Batch Page (`/src/app/batch/page.tsx`):
```typescript
'use client';

import { useState } from 'react';
import { ExistingDatasets } from '@/components/data-display/ExistingDatasets';
import { ProcessingConfigurator } from '@/components/forms/ProcessingConfigurator';
import { ProgressIndicator } from '@/components/data-display/ProgressIndicator';
import { batchProcess } from '@/lib/api/client';
import { DatasetItem, ProcessingOptions, ProcessingResult } from '@/types/models';

export default function BatchPage() {
  const [selectedDatasets, setSelectedDatasets] = useState<DatasetItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  const handleDatasetsSelected = (datasets: DatasetItem[]) => {
    setSelectedDatasets(datasets);
    setProcessingResult(null);
    setProcessingError(null);
  };
  
  const handleProcess = async (options: ProcessingOptions) => {
    if (selectedDatasets.length === 0) return;
    
    setIsProcessing(true);
    setProcessingError(null);
    
    try {
      const fileIds = selectedDatasets.map(dataset => dataset.id);
      const result = await batchProcess(fileIds, options);
      setProcessingResult(result);
    } catch (error) {
      console.error('Batch processing error:', error);
      setProcessingError('Failed to process selected datasets. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleProcessingComplete = () => {
    // Refresh the datasets list
    setRefreshCounter(prev => prev + 1);
    setSelectedDatasets([]);
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Batch Processing</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <ExistingDatasets 
            onSelect={handleDatasetsSelected} 
            refreshTrigger={refreshCounter}
          />
          
          {selectedDatasets.length > 0 && (
            <div className="mt-6">
              <ProcessingConfigurator 
                onSubmit={handleProcess} 
                isSubmitting={isProcessing} 
              />
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
            <ProgressIndicator 
              jobId={processingResult.job_id} 
              onComplete={handleProcessingComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

## Icons Component
Create `/src/components/ui/icons.tsx` for consistent icon usage:

```typescript
import {
  Upload,
  FileText,
  CheckCircle,
  Circle,
  Download,
  Settings,
  FileSeries,
  Moon,
  Sun,
  MoreVertical,
  ChevronDown,
  Loader2,
} from 'lucide-react';

export const Icons = {
  upload: Upload,
  fileType: FileText,
  checkCircle: CheckCircle,
  circle: Circle,
  download: Download,
  settings: Settings,
  fileStack: FileSeries,
  moon: Moon,
  sun: Sun,
  more: MoreVertical,
  chevronDown: ChevronDown,
  spinner: Loader2,
};
```

## Layout Configuration
Update `/src/app/layout.tsx` to implement consistent styling across the app:

```typescript
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Link from 'next/link';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'AnyDataset',
  description: 'Process any dataset with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen flex flex-col">
            <header className="border-b">
              <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                <Link href="/" className="text-xl font-bold">
                  AnyDataset
                </Link>
                <nav className="flex items-center gap-6">
                  <Link href="/upload" className="text-sm hover:underline">
                    Upload
                  </Link>
                  <Link href="/batch" className="text-sm hover:underline">
                    Batch Process
                  </Link>
                  <ThemeToggle />
                </nav>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t py-4">
              <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                © 2025 AnyDataset. All rights reserved.
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## Implementation Steps
Follow these steps to complete the frontend rewrite:

1. **Setup Project**
   - Run `./docs/frontend_init.sh` to bootstrap the project
   - Configure environment variables in `.env.local`

2. **Implement Core Components**
   - Create all the components listed above
   - Implement the API client and WebSocket services

3. **Implement Pages**
   - Create the home page, upload page, and batch page

4. **Testing and Refinement**
   - Test the application with the backend running
   - Ensure all features work as expected
   - Refine UI/UX as needed

5. **Optimization**
   - Add loading states and error handling
   - Implement responsive design for mobile/tablet
   - Add accessibility features

## Backend Integration
Make sure the frontend properly integrates with the existing backend API endpoints:

- `/upload` - POST for file uploads
- `/datasets` - GET to list datasets
- `/process/{file_id}` - POST to process a file
- `/batch/process` - POST to process multiple files
- `/models` - GET available model providers and models
- `/jobs/{job_id}/progress` - GET job progress
- `/jobs/{job_id}/download` - GET download results
- WebSocket: `/ws/progress/{job_id}` - Real-time progress updates

## Additional Notes
- All components should use Typescript interfaces for props and state
- Follow shadcn/ui patterns for component styling
- Implement responsive design for all screens
- Use Next.js App Router for routing
- Use React Hooks for state management
- Implement proper error handling throughout the application
- Use environment variables for API configuration
- Ensure accessibility with proper ARIA attributes
- Follow the existing file naming conventions

(c)2025 by M&K