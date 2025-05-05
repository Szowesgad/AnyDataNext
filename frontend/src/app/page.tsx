'use client';

import Image from "next/image";
import FileUpload from "@/components/FileUpload";
import ProcessingConfigurator from "@/components/ProcessingConfigurator";
import ModelSelector from "@/components/ModelSelector";
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
  const [config, setConfig] = useState<any>({});

  const ws = useRef<WebSocket | null>(null);

  // Use environment variable for backend URL with dynamic display
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const [displayBackendUrl, setDisplayBackendUrl] = useState<string>(backendUrl);
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
    const wsUrl = `${websocketUrl}/ws/${clientId}`;
    console.log(`Connecting to WebSocket: ${wsUrl}`);
    console.log(`Monitoring job: ${jobId}`);
    
    // UWAGA: Jeśli WebSocket nie działa, aplikacja wciąż będzie funkcjonować
    // dzięki REST API i statusy będą aktualizowane co 3 sekundy (fallback)
    
    // Close existing connection if any
    if (ws.current) {
      try {
        if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
          ws.current.close(1000, "Normal closure");
        }
      } catch (e) {
        console.error("Error closing existing WebSocket:", e);
      }
      ws.current = null;
    }
    
    // Create new connection with error handling
    try {
      const socket = new WebSocket(wsUrl);
      ws.current = socket;

      // Send job ID when connection opens
      socket.onopen = () => {
        console.log("WebSocket connection established");
        // Try to send job ID to help with routing on the server
        try {
          socket.send(JSON.stringify({
            type: "register",
            job_id: jobId
          }));
        } catch (e) {
          console.warn("Failed to send job registration message:", e);
        }
      };
      
      return socket;
    } catch (e) {
      console.error("Error creating WebSocket:", e);
      return null;
    }
  };

  // Maximum number of reconnection attempts
  const MAX_RECONNECT_ATTEMPTS = 3;
  // Time between reconnection attempts in ms
  const RECONNECT_INTERVAL = 2000;
  
  // Function to check job status via REST API (backup to WebSocket)
  const checkJobStatus = async (jobId: string) => {
    if (!jobId) return;
    
    try {
      console.log(`Checking job status via REST API for job: ${jobId}`);
      const response = await axios.get(`${backendUrl}/api/status/${jobId}`);
      
      if (response.status === 200) {
        const jobData = response.data;
        console.log("Job status response:", jobData);
        
        // Update UI based on job status
        setStatusText(jobData.status || 'Unknown status');
        setProcessingProgress(jobData.progress || 0);
        
        // Check for completion
        if (jobData.completed) {
          console.log('Job completed based on REST API check');
          setStatusText('Processing Complete!');
          setProcessingProgress(100);
          setFinalResultUrl(`${backendUrl}/api/results/${jobId}`);
          setIsProcessing(false);
          setShowConfigurator(false);
          return true; // Job completed
        }
        // Check for error
        else if (jobData.status === 'error' || jobData.error) {
          setError(`Processing Error: ${jobData.error || 'Unknown error'}`);
          setStatusText('Processing Failed');
          setIsProcessing(false);
          return true; // Job completed (with error)
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
    
    return false; // Job not completed
  };

  useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let statusCheckInterval: NodeJS.Timeout | null = null;
    
    if (isProcessing && currentJobId) {
      console.log(`Setting up monitoring for job: ${currentJobId}`);
      
      // Set up regular status checks as backup to WebSocket
      // This is crucial for reliable status updates if WebSocket fails
      statusCheckInterval = setInterval(async () => {
        const completed = await checkJobStatus(currentJobId);
        
        // If job completed via REST check, we can stop polling
        if (completed) {
          console.log('Job completed via REST API check, clearing interval');
          if (statusCheckInterval) {
            clearInterval(statusCheckInterval);
            statusCheckInterval = null;
          }
        }
      }, 3000); // Check every 3 seconds
      
      // Set up WebSocket connection
      const socket = setupWebSocket(currentJobId);
      
      // Check if socket was created successfully
      if (!socket) {
        console.warn('Failed to create WebSocket, will rely on REST API status checks');
        setStatusText('Using backup connection method for updates...');
        return;
      }

      // Override the onopen handler we set in setupWebSocket
      socket.onopen = () => {
        console.log('WebSocket Connected');
        setStatusText('Connected to server. Waiting for updates...');
        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;
      };

      socket.onmessage = (event) => {
        try {
          // Log raw message for debugging
          console.log('Raw WebSocket message:', event.data);
          
          // Try to parse as JSON
          const message = JSON.parse(event.data);
          console.log('WebSocket Message (parsed):', message);

          // Debug information
          console.log('Current job ID:', currentJobId);
          console.log('Message job ID:', message.job_id);
          console.log('Message type:', message.type);
          console.log('Message status:', message.status);
          
          // Check job_id only if it exists in the message
          if (message.job_id && message.job_id !== currentJobId) {
            console.log(`Ignoring message for different job_id: ${message.job_id}`);
            return;
          }

          if (message.type === 'job_update') {
            setStatusText(message.status || 'Processing...');
            setProcessingProgress(message.progress || 0);
            
            // Check for completion based on status
            if (message.status === 'completed') {
              console.log('Job completed based on status update');
              setStatusText('Processing Complete!');
              setProcessingProgress(100);
              setFinalResultUrl(`${backendUrl}/api/results/${currentJobId}`);
              setIsProcessing(false);
              setShowConfigurator(false);
            }
            // Check for error
            else if (message.status === 'error' || message.status === 'Error') {
              setError(`Processing Error: ${message.details?.error || message.error || 'Unknown error'}`);
              setStatusText('Processing Failed');
              setIsProcessing(false);
            }
          } else if (message.type === 'job_complete') {
            console.log('Job completed based on job_complete message');
            setStatusText('Processing Complete!');
            setProcessingProgress(100);
            setFinalResultUrl(`${backendUrl}/api/results/${message.job_id || currentJobId}`);
            setIsProcessing(false);
            setShowConfigurator(false);
          } else if (message.type === 'job_error') {
            setError(`Processing Failed: ${message.error || 'Unknown error'}`);
            setStatusText('Processing Failed');
            setProcessingProgress(0);
            setIsProcessing(false);
          } else if (message.type === 'ping') {
            console.log('Received ping from server');
            // Try to send pong back to keep connection alive
            try {
              socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            } catch (e) {
              console.warn('Failed to send pong response');
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', event.data, e);
          // Don't set error for the user on parse failures, as this could be a benign issue
          console.warn('Received message that could not be parsed');
        }
      };

      socket.onerror = (event) => {
        console.error('WebSocket Error:', event);
        console.log('Will rely on REST API backup for status updates');
        // Don't show error to user immediately, as we have the REST API backup
        setStatusText('Using backup connection for updates...');
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
            setStatusText(`Using backup connection. Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            
            // Schedule reconnection attempt
            reconnectTimeout = setTimeout(() => {
              if (isProcessing && currentJobId) {
                setupWebSocket(currentJobId);
              }
            }, RECONNECT_INTERVAL);
          } else {
            // Max reconnect attempts reached, but don't show error as we have REST backup
            console.warn('WebSocket reconnection failed after maximum attempts');
            setStatusText('Using polling for status updates...');
            // We DON'T set an error here since we're still getting updates via REST API
          }
        }
      };

      // Cleanup function to run when component unmounts or dependencies change
      return () => {
        // Clear any pending reconnection timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Clear status check interval
        if (statusCheckInterval) {
          clearInterval(statusCheckInterval);
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
      <div className="flex flex-col w-full mb-8">
        <div className="flex justify-between items-center w-full mb-2">
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
        
        {/* Recent Models Quick Selector */}
        {!isProcessing && 
          <div className="mb-2">
            <ModelSelector 
              className="max-w-lg" 
              onModelSelect={(provider, model) => {
                if (uploadedFileInfo) {
                  setConfig(prev => ({
                    ...prev,
                    provider: provider,
                    model: model
                  }));
                }
              }}
            />
          </div>
        }
      </div>

      <div className="w-full max-w-4xl bg-white dark:bg-gray-850 shadow-xl rounded-lg p-6 md:p-8">
        {/* Display backend server info */}
        <div className="mb-4 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
          <span>Server: {displayBackendUrl}</span>
          <button
            onClick={() => {
              // Copy backend URL to clipboard using navigator.clipboard API with fallback
              try {
                // Try using the modern Navigator Clipboard API first
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(backendUrl)
                    .then(() => {
                      // Show success message
                      const originalText = displayBackendUrl;
                      setDisplayBackendUrl('Copied to clipboard!');
                      setTimeout(() => setDisplayBackendUrl(originalText), 2000);
                    })
                    .catch(err => {
                      // If permission denied or other error, try fallback method
                      console.warn('Navigator clipboard failed, trying fallback:', err);
                      useFallbackCopy();
                    });
                } else {
                  // Fallback for browsers that don't support navigator.clipboard
                  useFallbackCopy();
                }
              } catch (error) {
                console.error('Failed to copy:', error);
                alert('Could not copy to clipboard');
              }
              
              // Fallback copy method using document.execCommand
              function useFallbackCopy() {
                // Create temporary textarea element
                const textArea = document.createElement('textarea');
                textArea.value = backendUrl;
                
                // Make the textarea out of viewport
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                
                try {
                  // Select and copy
                  textArea.focus();
                  textArea.select();
                  const successful = document.execCommand('copy');
                  
                  if (successful) {
                    // Show success message
                    const originalText = displayBackendUrl;
                    setDisplayBackendUrl('Copied to clipboard!');
                    setTimeout(() => setDisplayBackendUrl(originalText), 2000);
                  } else {
                    console.error('execCommand copy failed');
                    alert('Could not copy to clipboard');
                  }
                } catch (err) {
                  console.error('execCommand error:', err);
                  alert('Could not copy to clipboard');
                } finally {
                  // Clean up
                  document.body.removeChild(textArea);
                }
              }
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
              initialProvider={config.provider}
              initialModel={config.model}
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
