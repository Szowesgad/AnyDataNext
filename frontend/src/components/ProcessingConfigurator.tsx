'use client';

import React, { useState, useEffect } from 'react';
import { AvailableModels } from '@/types/models'; // Keep type import, path might need user fix

// Import ONLY shadcn/ui Select components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SuggestionButton from './SuggestionButton';
// Removed Textarea, Button, Input imports from shadcn/ui

// --- Helper Types --- 
interface UploadedFileInfo {
  fileId: string;
  originalFilename: string;
  size: number;
}

interface Suggestions {
  suggested_keywords: string[];
  suggested_system_prompt: string;
}

interface ModelInfo {
  id: string;
  name?: string;
}

interface ProviderInfo {
  provider: string;
  name: string;
  models: ModelInfo[];
  env_key?: string;
  list_endpoint?: string;
}

interface AvailableModelsResponse {
  [providerKey: string]: ProviderInfo;
}

interface ProcessingConfig {
  provider: string;
  model: string;
  systemPrompt?: string;
  keywords?: string[];
}

// --- Component Props --- 
interface ProcessingConfiguratorProps {
  originalFilename: string;
  initialKeywords?: string[];
  initialLanguage?: string; // Keep prop, even if unused for now
  onSubmit: (config: ProcessingConfig) => void;
  onCancel: () => void;
  backendUrl: string; // Re-added for suggestion API
  availableModels: AvailableModels | null; // Use the prop
  isLoadingModels: boolean; // Use the prop
  fileId: string; // Added to support suggestion API
}

// --- Component --- 
const ProcessingConfigurator: React.FC<ProcessingConfiguratorProps> = ({
  originalFilename,
  initialKeywords = [],
  initialLanguage = 'pl', // Default value used if needed later
  onSubmit,
  onCancel,
  backendUrl,
  availableModels, // Use prop
  isLoadingModels, // Use prop
  fileId,
}) => {
  // --- State --- 
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [keywords, setKeywords] = useState<string>(initialKeywords.join(', '));
  const [language, setLanguage] = useState<string>(initialLanguage); // Keep language state if needed

  // Removed the useState for isProcessing as it seems handled by parent or unused
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Keep error message state

  // --- Effects --- 
  // REMOVED useEffect for fetching models (lines approx 89-123)

  // Initialize form fields - simplified, only keywords and language might be needed from props now
  useEffect(() => {
      // Initialize keywords from props
      setKeywords(initialKeywords.join(', '));
      // Initialize language from props if different from default
      setLanguage(initialLanguage);
  }, [initialKeywords, initialLanguage]); // Dependency array updated

  // Reset model when provider changes - KEEP THIS
  useEffect(() => {
    setSelectedModel('');
    // Clear potential error when provider changes
    setErrorMessage(null); 
  }, [selectedProvider]);

  // --- Handlers --- 
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    // No need to set default model here, handled by reset effect
  };

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
  };

  // Renamed handleStartProcessing to handleSubmit to match parent expectation better
  const handleSubmit = () => { 
    if (!selectedProvider || !selectedModel) {
      setErrorMessage('Please select a provider and model.');
      return;
    }
    setErrorMessage(null); // Clear error on successful validation

    const keywordsList = keywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k !== '');

    const config: ProcessingConfig = {
      provider: selectedProvider,
      model: selectedModel,
      systemPrompt: systemPrompt || undefined, // Send undefined if empty
      keywords: keywordsList.length > 0 ? keywordsList : undefined, // Send undefined if empty
      temperature: temperature,
      maxTokens: maxTokens
    };

    console.log("Submitting processing configuration:", config);
    onSubmit(config); // Call the actual onSubmit prop
  };

  // Renamed onCancel prop handler for clarity
  const handleCancel = () => { 
    onCancel();
  };

  // --- Render Logic --- 
  // Use isLoadingModels prop directly
  if (isLoadingModels) { 
    return <div className="text-center p-10">Loading model configuration...</div>;
  }

  // Handle error state based on props and internal state
  if (!availableModels && !isLoadingModels) { // Check only if not loading and models are null
      // Use internal errorMessage if set, otherwise show generic message
      return <div className="text-center p-10 text-red-600">Error loading configuration: {errorMessage || 'Model data is unavailable.'}</div>;
  }
  
  // Ensure availableModels is not null before proceeding (TypeScript guard)
  if (!availableModels) {
      return <div className="text-center p-10 text-gray-500">Model configuration data is missing.</div>;
  }


  const providerOptions = Object.keys(availableModels); // Simpler now
  
  // Use the CORRECTED logic based on logs (array of strings)
  const modelOptions: string[] = (selectedProvider && availableModels[selectedProvider]?.models)
                                 ? availableModels[selectedProvider].models as string[] // Assuming backend sends string[] now
                                 : [];


  return (
    <div className="p-6 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-850 shadow-md">
      <h2 className="text-xl font-semibold mb-6 text-center border-b dark:border-gray-700 pb-3 text-gray-800 dark:text-gray-200">2. Configure Processing</h2>

      {/* Display internal error message if any */}
      {errorMessage && (
         <div className="mb-4 p-3 border border-red-200 bg-red-50 dark:bg-red-900/20 rounded text-red-600 dark:text-red-400 text-sm">
            Error: {errorMessage}
         </div>
      )}

      {/* File Info */} 
      <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 border dark:border-gray-700 rounded">
          <p className="text-sm text-gray-700 dark:text-gray-300"><strong>File:</strong> {originalFilename}</p>
      </div>

      {/* Model Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="provider-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Provider</label>
          <Select 
             value={selectedProvider} 
             onValueChange={handleProviderChange}
             disabled={providerOptions.length === 0}
          >
            <SelectTrigger id="provider-select" className="w-full text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder="Select a provider..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              {providerOptions.length === 0 ? (
                  <SelectItem value="" disabled>No providers available</SelectItem>
              ) : (
                  providerOptions.map(key => (
                      <SelectItem key={key} value={key}>
                          {availableModels[key]?.name || key} {/* Display name or key */}
                      </SelectItem>
                  ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="model-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
          <Select 
            value={selectedModel} 
            onValueChange={handleModelChange}
            disabled={!selectedProvider || modelOptions.length === 0}
          >
            <SelectTrigger id="model-select" className="w-full text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectValue placeholder={!selectedProvider ? "Select provider first" : "Select a model..."} /> {/* Updated placeholder */}
            </SelectTrigger>
            <SelectContent> {/* Removed extra classes, use default shadcn styling */}
              {modelOptions.length > 0 ? (
                // Use the CORRECTED mapping
                modelOptions.map((modelString) => (
                  <SelectItem key={modelString} value={modelString}>
                    {modelString}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-models" disabled>No models available</SelectItem> /* Simplified message */
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* AI Suggestions Button */}
      <div className="mb-6 flex justify-end">
        <SuggestionButton 
          backendUrl={backendUrl}
          fileId={fileId}
          onSuggestionsReceived={(suggestedKeywords, suggestedPrompt) => {
            if (suggestedKeywords.length > 0) {
              setKeywords(suggestedKeywords.join(', '));
            }
            if (suggestedPrompt) {
              setSystemPrompt(suggestedPrompt);
            }
          }}
        />
      </div>

      {/* System Prompt - USE STANDARD TEXTAREA */}
      <div className="mb-4">
        <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt (Optional)</label>
        <textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSystemPrompt(e.target.value)}
          placeholder="Enter custom instructions for the AI... (uses default if blank)"
          className="w-full border dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
        />
      </div>

      {/* Keywords - USE STANDARD INPUT */}
      <div className="mb-4">
        <label htmlFor="keywords" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keywords (Optional, comma-separated)</label>
        <input
          id="keywords"
          type="text"
          value={keywords}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeywords(e.target.value)}
          placeholder="e.g., ai, dataset, veterinary"
          className="w-full border dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* Generation Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="temperature" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature</label>
          <input
            id="temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full border dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Controls randomness (0.0-2.0)</p>
        </div>
        <div>
          <label htmlFor="maxTokens" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Tokens</label>
          <input
            id="maxTokens"
            type="number"
            min="100"
            max="100000"
            step="100"
            value={maxTokens || ''}
            onChange={(e) => setMaxTokens(e.target.value ? parseInt(e.target.value, 10) : undefined)}
            placeholder="Default: Model-specific"
            className="w-full border dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Maximum response length</p>
        </div>
      </div>

      {/* Action Buttons - USE STANDARD BUTTONS */}
      <div className="mt-8 flex justify-end gap-4">
        <button
          type="button"
          onClick={handleCancel} // Use the correct handler name
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          // Removed disabled={isProcessing} as isProcessing state was removed
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit} // Use the correct handler name
          className="px-4 py-2 border border-transparent rounded text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          // Disable button if loading, or no provider/model selected
          disabled={isLoadingModels || !selectedProvider || !selectedModel} 
        >
          {/* Simplified button text */}
          Submit Configuration 
        </button>
      </div>

    </div>
  );
};

export default ProcessingConfigurator;


// Helper function to get display name for provider ID - KEEP THIS
function getProviderDisplayName(providerId: string): string {
  // Check if availableModels prop has the provider data
  // This function needs access to availableModels, maybe pass it as arg or define inside component?
  // For now, use a static map as before, but this is less dynamic
  const staticMap: { [key: string]: string } = {
    anthropic: "Claude (Anthropic)",
    openai: "OpenAI (GPT)",
    deepseek: "DeepSeek",
    lmstudio: "LM Studio (Local)",
    xai: "xAI (Grok)",
    openrouter: "OpenRouter (Various)"
    // Add other providers as needed
  };
  // Ideally fetch name from availableModels[providerId]?.name if possible
  return staticMap[providerId] || providerId; 
}
