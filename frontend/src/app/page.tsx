'use client';

import FileUpload from "@/components/FileUpload";
import ProcessingConfigurator from "@/components/ProcessingConfigurator";
import { useState, useEffect } from "react";
import axios from 'axios';
import { Progress } from '@/components/ui/progress';
import ExistingDatasets from '@/components/ExistingDatasets';
import JobStatusRecovery from '@/components/JobStatusRecovery';
import { AvailableModels } from '../types/models';
import { webSocketService } from '@/lib/websocket';
import { getStatus, getResultUrl } from '@/lib/api';

// Helper function to determine if a file is audio/video based on extension
function isAudioVideoFile(filename: string): boolean {
  // Get the file extension from the filename
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  // List of common audio/video file extensions
  const audioVideoExtensions = [
    // Audio
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff',
    // Video
    'mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'm4v', 'webm', 'mpeg', 'mpg'
  ];
  return audioVideoExtensions.includes(extension);
}

interface UploadedFileInfoFromUpload {
  fileId: string;
  originalFilename: string;
  size: number;
  keywords?: string[];
  language?: string;
}

interface ProcessingConfig {
  keywords: string[];
  language: string;
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  addReasoning?: boolean;
  outputFormat?: string;
  processingType?: string;
}

export default function Home() {
  const [uploadedFileInfo, setUploadedFileInfo] = useState<UploadedFileInfoFromUpload | null>(null);
  const [showConfigurator, setShowConfigurator] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('Initializing...');
  const [finalResultUrl, setFinalResultUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);

  // WebSocket connection managed centrally via WebSocketService

  // Use environment variable for backend URL with dynamic display
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const [displayBackendUrl, setDisplayBackendUrl] = useState<string>(backendUrl);
  // Jawnie konstruuj URL websocketa
  // const websocketUrl = backendUrl.includes('https://') 
  //   ? backendUrl.replace('https://', 'wss://') 
  //   : backendUrl.replace('http://', 'ws://');
  
  // Fetch available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await axios.get<AvailableModels>(`${backendUrl}/api/models`);
        if (response.status === 200 && response.data) {
          console.log("Models data received:", response.data);
          setAvailableModels(response.data);
        } else {
          throw new Error('Failed to fetch models');
        }
      } catch (error: any) {
        console.error("Error fetching models:", error);
        let detail = 'Could not fetch available models.';
        if (axios.isAxiosError(error)) {
          detail = error.response?.data?.detail || error.message || detail;
        } else if (error instanceof Error) {
          detail = error.message;
        }
        setError(detail);
        setAvailableModels(null);
      } finally {
        setIsLoadingModels(false);
      }
    };
    fetchModels();
  }, [backendUrl]);

  // ====== Job Monitoring via WebSocketService with REST fallback ======

  // Function to check job status via REST API (backup to WebSocket)
  const checkJobStatus = async (jobId: string) => {
    try {
      const jobData = await getStatus(jobId);
      if (!jobData) return false;
      setStatusText(jobData.status || 'Unknown status');
      if (jobData.progress) {
        setProcessingProgress(jobData.progress);
      }
      if (jobData.completed) {
        setStatusText('Processing Complete!');
        setProcessingProgress(100);
        setFinalResultUrl(getResultUrl(jobId));
        setIsProcessing(false);
        setShowConfigurator(false);
        return true;
      }
      if (jobData.status === 'error' || jobData.error) {
        setError(jobData.error || 'Unknown error');
        setIsProcessing(false);
        return true;
      }
    } catch (err) {
      console.error('Error checking job status:', err);
    }
    return false;
  };

  useEffect(() => {
    if (!isProcessing || !currentJobId) return;

    // Subscribe to WebSocketService
    const unsubscribe = webSocketService.subscribe(currentJobId, (data) => {
      const percent = data.total ? Math.round((data.current / data.total) * 100) : 0;
      setProcessingProgress(percent);
      setStatusText(data.status);

      if (data.status === 'completed') {
        setProcessingProgress(100);
        setStatusText('Processing Complete!');
        setFinalResultUrl(getResultUrl(currentJobId));
        setIsProcessing(false);
        setShowConfigurator(false);
      }

      if (data.status === 'failed') {
        setError(data.error || 'Processing failed');
        setIsProcessing(false);
      }
    });

    // REST polling fallback every 5s
    const poll = setInterval(async () => {
      const done = await checkJobStatus(currentJobId);
      if (done) {
        clearInterval(poll);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(poll);
    };
  }, [isProcessing, currentJobId]);

  const handleUploadSuccess = (data: UploadedFileInfoFromUpload) => {
    console.log('Upload successful, data received:', data);
    if (!data.fileId || !data.originalFilename) {
      console.error("Upload success callback received invalid data:", data);
      setError("Upload succeeded but received incomplete information from backend.");
      setUploadedFileInfo(null);
      setCurrentJobId(null);
      return;
    }
    setUploadedFileInfo(data);
    setCurrentJobId(data.fileId);
    setShowConfigurator(true);
    setIsProcessing(false);
    setError(null);
    setFinalResultUrl(undefined);
    setStatusText('File uploaded. Configure processing.');
    setProcessingProgress(0);
  };

  const handleConfigureAndProcess = async (config: ProcessingConfig) => {
    if (!uploadedFileInfo || !currentJobId) {
      setError('No file information available to start processing.');
      return;
    }
    console.log('Starting processing with config:', config);
    setShowConfigurator(false);
    setIsProcessing(true);
    setProcessingProgress(0);
    setStatusText('Initiating processing...');
    setError(null);
    setFinalResultUrl(undefined);

    try {
      // Determine file type to use correct endpoint
      const isAudioVideo = isAudioVideoFile(uploadedFileInfo.originalFilename);
      const endpoint = isAudioVideo ? '/api/process-audio-dataset' : '/api/process';
      
      console.log(`File type detected: ${isAudioVideo ? 'audio/video' : 'text/document'}, using endpoint: ${endpoint}`);
      
      // Prepare correct payload based on endpoint
      let payload;
      if (isAudioVideo) {
        // Payload for audio/video endpoint
        payload = {
          file_id: uploadedFileInfo.fileId, // Use fileId, not currentJobId
          language: config.language || null,
          model: config.model || 'large-v3',
        };
      } else {
        // Payload for text/document endpoint - use fileId from uploadedFileInfo
        payload = {
          file_id: uploadedFileInfo.fileId, // Use fileId, not currentJobId
          model_provider: config.provider,
          model: config.model,
          temperature: config.temperature || 0.7,
          max_tokens: config.maxTokens,
          system_prompt: config.systemPrompt,
          language: config.language || 'pl',
          keywords: config.keywords || [],
          output_format: config.outputFormat || 'json',
          add_reasoning: config.addReasoning || false,
          processing_type: config.processingType || 'standard'
        };
      }

      // Dodaj nagłówki CORS
      console.log(`Making request to ${backendUrl}${endpoint} with payload:`, payload);
      const response = await axios.post(`${backendUrl}${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Accept status 200, 201, or 202 (accepted)
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Backend responded with unexpected status: ${response.status}`);
      }
      
      // Get the job_id from response
      const jobId = response.data?.job_id;
      if (!jobId) {
        throw new Error('No job_id received from backend');
      }
      
      // Update currentJobId for WebSocket connections
      setCurrentJobId(jobId);
      
      console.log('Backend acknowledged processing request. JobID:', jobId);
      setStatusText('Processing started. Waiting for updates via WebSocket...');
    } catch (err: any) {
      console.error('Failed to initiate processing:', err);
      const errorMsg = `Failed to start processing: ${err.response?.data?.detail || err.message || 'Unknown error'}`;
      setError(errorMsg);
      setStatusText('Failed to start processing.');
      setIsProcessing(false);
      setCurrentJobId(null);
      setUploadedFileInfo(null);
      setShowConfigurator(true);
    }
  };

  const handleResetAndUploadAnother = () => {
    setUploadedFileInfo(null);
    setFinalResultUrl(undefined);
    setStatusText('Ready for new upload.');
    setError(null);
    setCurrentJobId(null);
    setIsProcessing(false);
    setShowConfigurator(false);
    setProcessingProgress(0);
    webSocketService.disconnect();
  };

  const handleCancel = () => {
    console.log('Configuration cancelled.');
    setShowConfigurator(false);
    setError(null);
    setFinalResultUrl(undefined);
    setStatusText('Configuration cancelled. Ready to upload or reconfigure.');
    setProcessingProgress(0);
    setIsProcessing(false);
  };

  const [darkMode, setDarkMode] = useState(false);

  // Efekt do wykrycia i ustawienia preferowanego motywu
  useEffect(() => {
    // Sprawdź czy preferowany jest ciemny motyw
    const isDarkPreferred = window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Sprawdź czy w localStorage jest zapisany motyw
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && isDarkPreferred)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Funkcja przełączania motywu
  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-start p-8 md:p-12 lg:p-24 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center w-full mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500 flex-grow">
          AnyDataset Processor
        </h1>
        <button
          className="rounded-full p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          onClick={toggleTheme}
          title={`Switch to ${darkMode ? "light" : "dark"} mode`}
        >
          {darkMode ? (
            // Sun icon for dark mode
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
              />
            </svg>
          ) : (
            // Moon icon for light mode
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="w-full max-w-4xl bg-white dark:bg-gray-850 shadow-xl rounded-lg p-6 md:p-8">
        {/* Display backend server info */}
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
          <span>Server: {displayBackendUrl}</span>
          <button
            onClick={() => {
              // Copy backend URL to clipboard
              navigator.clipboard.writeText(backendUrl);
              // Show a brief message that it was copied
              const originalText = displayBackendUrl;
              setDisplayBackendUrl('Copied to clipboard!');
              setTimeout(() => setDisplayBackendUrl(originalText), 2000);
            }}
            className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            title="Copy server URL"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded">
            <p className="font-bold">Error:</p>
            <p>{error}</p>
            <button
              onClick={handleResetAndUploadAnother}
              className="mt-2 text-xs text-red-800 dark:text-red-300 underline"
            >
              Start Over
            </button>
          </div>
        )}

        {!uploadedFileInfo && !isProcessing && !finalResultUrl && (
          <FileUpload
            backendUrl={backendUrl}
            onUploadSuccess={handleUploadSuccess}
          />
        )}

        {showConfigurator && uploadedFileInfo && (
          <div>
            <h3 className="text-sm text-blue-600 dark:text-blue-400 mb-2">Using server: {backendUrl}</h3>
            <ProcessingConfigurator
              originalFilename={uploadedFileInfo.originalFilename}
              initialKeywords={uploadedFileInfo.keywords}
              initialLanguage={uploadedFileInfo.language}
              onSubmit={handleConfigureAndProcess}
              onCancel={handleCancel}
              backendUrl={backendUrl}
              availableModels={availableModels}
              isLoadingModels={isLoadingModels}
              fileId={uploadedFileInfo.fileId}
            />
          </div>
        )}

        {isProcessing && (
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-semibold mb-4">Processing...</h2>
            <p className="mb-2 text-lg font-medium text-blue-600 dark:text-blue-400">{statusText}</p>
            <Progress value={processingProgress} className="my-2" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{processingProgress}% Complete</p>
          </div>
        )}

        {finalResultUrl && !isProcessing && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900 border border-green-400 dark:border-green-700 rounded-lg text-center">
            <h2 className="text-2xl font-semibold mb-4 text-green-800 dark:text-green-200">Processing Complete!</h2>
            {currentJobId && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Job ID: {currentJobId}</p>}
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">Results URL: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{finalResultUrl}</code></p>
            </div>
            <a
              href={finalResultUrl}
              download
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Results
            </a>
            <button
              onClick={() => window.open(finalResultUrl, '_blank')}
              className="ml-2 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition duration-200"
            >
              View in Browser
            </button>
            <button
              onClick={handleResetAndUploadAnother}
              className="ml-4 text-sm text-gray-500 hover:text-gray-700 underline mt-4 block mx-auto"
            >
              Process Another File
            </button>
          </div>
        )}

        {!uploadedFileInfo && !isProcessing && !finalResultUrl && (
          <div className="mt-12 pt-8 border-t border-gray-300 dark:border-gray-700 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ExistingDatasets backendUrl={backendUrl} onSelectDataset={(datasetId) => {
                console.log(`Selected dataset: ${datasetId}`);
                // Implement dataset selection logic if needed
              }} />
              
              <JobStatusRecovery 
                backendUrl={backendUrl}
                onJobRecovered={(jobId, jobStatus) => {
                  console.log("Recovered job:", jobId, jobStatus);
                  
                  // Set current job ID
                  setCurrentJobId(jobId);
                  
                  // Handle different job states
                  if (jobStatus.completed && jobStatus.status === "completed") {
                    // Job is complete, show result
                    setStatusText('Processing Complete!');
                    setProcessingProgress(100);
                    setFinalResultUrl(`${backendUrl}/api/results/${jobId}`);
                    setIsProcessing(false);
                  } else if (jobStatus.status === "error") {
                    // Job failed
                    setError(`Processing Failed: ${jobStatus.error || 'Unknown error'}`);
                    setStatusText('Processing Failed');
                    setProcessingProgress(0);
                    setIsProcessing(false);
                  } else {
                    // Job is still in progress
                    setIsProcessing(true);
                    setProcessingProgress(jobStatus.progress || 0);
                    setStatusText(jobStatus.status || 'Processing...');
                    
                    // WebSocket connection will be set up automatically by effect
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
