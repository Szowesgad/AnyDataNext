'use client';

import Image from "next/image";
import FileUpload from "@/components/FileUpload";
import ProcessingConfigurator from "@/components/ProcessingConfigurator";
import { useState, useEffect, useRef } from "react";
import axios from 'axios';
import { Progress } from '@/components/ui/progress';
import ExistingDatasets from '@/components/ExistingDatasets';
import JobStatusRecovery from '@/components/JobStatusRecovery';
import { AvailableModels } from '../types/models';

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

interface ProcessingStatus {
  progress: number;
  statusText: string;
  error: string | null;
}

type AppStep = 'upload' | 'configure' | 'processing' | 'results';

export default function Home() {
  const [appStep, setAppStep] = useState<AppStep>('upload');
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

  const ws = useRef<WebSocket | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  // Jawnie konstruuj URL websocketa
  const websocketUrl = backendUrl.includes('https://') 
    ? backendUrl.replace('https://', 'wss://') 
    : backendUrl.replace('http://', 'ws://');
  
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

  // Function to create and setup WebSocket connection
  const setupWebSocket = (jobId: string) => {
    const clientId = `frontend_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    // Use the response job_id for WebSocket, not the fileId
    const wsUrl = `${websocketUrl}/ws/${clientId}?job_id=${jobId}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    
    // Close existing connection if any
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
    
    // Create new connection
    const socket = new WebSocket(wsUrl);
    ws.current = socket;
    
    return socket;
  };

  // Maximum number of reconnection attempts
  const MAX_RECONNECT_ATTEMPTS = 3;
  // Time between reconnection attempts in ms
  const RECONNECT_INTERVAL = 2000;
  
  useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    if (isProcessing && currentJobId) {
      const socket = setupWebSocket(currentJobId);

      socket.onopen = () => {
        console.log('WebSocket Connected');
        setStatusText('WebSocket Connected. Waiting for updates...');
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('WebSocket Message:', message);

          if (message.job_id !== currentJobId) {
            console.log(`Ignoring message for different job_id: ${message.job_id}`);
            return;
          }

          if (message.type === 'job_update') {
            setStatusText(message.status || 'Processing...');
            setProcessingProgress(message.progress || 0);
            if (message.status === 'Error') {
              setError(`Processing Error: ${message.details?.error || 'Unknown error'}`);
              setIsProcessing(false);
              setCurrentJobId(null);
            }
          } else if (message.type === 'job_complete') {
            setStatusText('Processing Complete!');
            setProcessingProgress(100);
            setFinalResultUrl(`${backendUrl}/api/results/${message.job_id}`);
            setIsProcessing(false);
            setShowConfigurator(false);
            setUploadedFileInfo(null);
          } else if (message.type === 'job_error') {
            setError(`Processing Failed: ${message.error || 'Unknown error'}`);
            setStatusText('Processing Failed');
            setProcessingProgress(0);
            setIsProcessing(false);
            setCurrentJobId(null);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', event.data, e);
          setError('Received invalid message from server.');
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket Error:', event);
        setError('WebSocket connection error. Please check the backend.');
        setStatusText('WebSocket Error');
        // Don't set isProcessing to false here - we'll let the onclose handler
        // try to reconnect first if possible
      };

      socket.onclose = (event) => {
        console.log('WebSocket Disconnected:', event.code, event.reason);
        
        // Normal closure is code 1000, anything else is unexpected
        if (event.code === 1000) {
          console.log('WebSocket closed normally');
          return;
        }
        
        // Only attempt reconnection if still processing and not a normal close
        if (isProcessing && event.code !== 1000) {
          // Try to reconnect if we haven't exceeded max attempts
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`WebSocket disconnected. Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
            setStatusText(`Connection lost. Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            // Schedule reconnection attempt
            reconnectTimeout = setTimeout(() => {
              if (isProcessing && currentJobId) {
                setupWebSocket(currentJobId);
              }
            }, RECONNECT_INTERVAL);
          } else {
            // Max reconnect attempts reached, show error
            console.error('WebSocket reconnection failed after maximum attempts');
            setError('WebSocket connection lost and reconnection failed. Processing status unknown.');
            setStatusText('Connection lost permanently');
            // Keep isProcessing true to allow user to manually check status or restart
          }
        }
      };

      // Cleanup function to run when component unmounts or dependencies change
      return () => {
        // Clear any pending reconnection timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Close WebSocket if open
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          console.log('Closing WebSocket connection...');
          ws.current.close();
        }
        ws.current = null;
      };
    }
  }, [isProcessing, currentJobId, websocketUrl, backendUrl]);

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
      const response = await axios.post(`${backendUrl}${endpoint}`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        withCredentials: false, // Wyłącz przesyłanie credentiali
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
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
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
            <a
              href={finalResultUrl}
              download
              className="inline-block px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow transition duration-200"
            >
              Download Dataset ZIP
            </a>
            <button
              onClick={handleResetAndUploadAnother}
              className="ml-4 text-sm text-gray-500 hover:text-gray-700 underline"
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
                    
                    // Connect to WebSocket for updates
                    setupWebSocket(jobId);
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
