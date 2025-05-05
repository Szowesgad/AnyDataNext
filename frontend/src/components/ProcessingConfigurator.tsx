import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AvailableModels } from '../types/models';

// Interface for recent model history
interface RecentModel {
  provider: string;
  model: string;
  timestamp: number;
}

interface ProcessingConfig {
  provider: string;
  model: string;
  systemPrompt?: string;
  keywords?: string[];
  temperature?: number;
  maxTokens?: number;
  language?: string;
  processingType?: string;
  addReasoning?: boolean;
  outputFormat?: string;
}

interface ProviderModel {
  id: string;
  name: string;
  maxTokens?: number;
}

interface ModelData {
  [provider: string]: {
    name: string;
    models: ProviderModel[];
  };
}

interface ProcessingConfiguratorProps {
  originalFilename: string;
  initialKeywords?: string[];
  initialLanguage?: string;
  initialProvider?: string;
  initialModel?: string;
  onSubmit: (config: any) => void;
  onCancel: () => void;
  backendUrl: string;
  availableModels: AvailableModels | null;
  isLoadingModels: boolean;
  fileId: string;
}

const ProcessingConfigurator: React.FC<ProcessingConfiguratorProps> = ({
  originalFilename,
  initialKeywords,
  initialLanguage,
  initialProvider,
  initialModel,
  onSubmit,
  onCancel,
  backendUrl,
  availableModels: modelData,
  isLoadingModels: isLoading,
  fileId
}) => {
  // Create internal config state
  const [config, setConfig] = useState<ProcessingConfig>({
    provider: initialProvider || '',
    model: initialModel || '',
    keywords: initialKeywords || [],
    language: initialLanguage || 'pl',
    temperature: 0.7,
    processingType: 'standard',
    addReasoning: false,
    outputFormat: 'json'
  });

  const [modelOptions, setModelOptions] = useState<ProviderModel[]>([]);
  const [keywordsInput, setKeywordsInput] = useState<string>(initialKeywords?.join(', ') || '');
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string>('');
  const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
  const [recentModels, setRecentModels] = useState<RecentModel[]>([]);

  // Processing type options
  const [processingType, setProcessingType] = useState<string>('standard');
  console.log('ProcessingConfigurator initialized with backendUrl:', backendUrl);
  const [language, setLanguage] = useState<string>(initialLanguage || 'pl');
  const [addReasoning, setAddReasoning] = useState<boolean>(false);
  const [outputFormat, setOutputFormat] = useState<string>('json');

  // Load recent models from localStorage
  useEffect(() => {
    try {
      const storedModels = localStorage.getItem('recentModels');
      if (storedModels) {
        const parsedModels = JSON.parse(storedModels) as RecentModel[];
        setRecentModels(parsedModels);
      }
    } catch (error) {
      console.error('Error loading recent models from localStorage:', error);
    }
  }, []);

  // Initialize provider when component mounts
  useEffect(() => {
    if (modelData && Object.keys(modelData).length > 0) {
      // Select the first provider by default
      const firstProvider = Object.keys(modelData)[0];
      setConfig(prev => ({
        ...prev,
        provider: firstProvider
      }));
    }
  }, [modelData]);

  // Function to save a model to recent history
  const saveModelToRecent = (provider: string, model: string) => {
    // Create new recent model entry
    const newEntry: RecentModel = {
      provider,
      model,
      timestamp: Date.now()
    };
    
    // Filter out any existing entry with the same provider/model pair
    const filtered = recentModels.filter(item => 
      !(item.provider === provider && item.model === model)
    );
    
    // Add new entry and sort by timestamp (newest first)
    const updated = [newEntry, ...filtered].slice(0, 10); // Keep only 10 most recent
    
    // Save to state and localStorage
    setRecentModels(updated);
    try {
      localStorage.setItem('recentModels', JSON.stringify(updated));
    } catch (error) {
      console.error('Error saving recent models to localStorage:', error);
    }
  };

  // Update available models when provider changes or modelData loads
  useEffect(() => {
    if (modelData && config.provider) {
      const providerInfo = modelData[config.provider];
      if (providerInfo && Array.isArray(providerInfo.models)) {
        // Map models to standard format
        const standardizedModels = providerInfo.models.map(model => ({
          id: model.id || model.model_id || model,
          name: model.name || model.model_name || model
        }));
        
        // Get recent models for this provider
        const recentForProvider = recentModels
          .filter(rm => rm.provider === config.provider)
          .map(rm => {
            // Find the full model info for this recent model
            const modelInfo = standardizedModels.find(m => m.id === rm.model);
            return modelInfo ? { ...modelInfo, isRecent: true } : null;
          })
          .filter(Boolean) as ProviderModel[];
          
        // Filter out recent models from the full list to avoid duplicates
        const recentModelIds = recentForProvider.map(m => m.id);
        const regularModels = standardizedModels.filter(m => !recentModelIds.includes(m.id));
        
        // Combine recent models at the top with the rest of the models
        setModelOptions([...recentForProvider, ...regularModels]);
        
        // If we haven't selected a model yet, or the selected model isn't available
        // for this provider, select the first available model
        const modelExists = standardizedModels.some(m => m.id === config.model);
        if (!config.model || !modelExists) {
          if (standardizedModels.length > 0) {
            // First try to use the most recent model for this provider
            const mostRecentModel = recentForProvider.length > 0 ? recentForProvider[0] : null;
            const modelToSelect = mostRecentModel || standardizedModels[0];
            
            setConfig(prev => ({
              ...prev,
              model: modelToSelect.id
            }));
          }
        }
      } else {
        setModelOptions([]);
      }
    }
  }, [config.provider, modelData, recentModels]);

  // Update processingType, language, addReasoning, and outputFormat config values when they change
  useEffect(() => {
    setConfig(prev => ({
      ...prev,
      processingType,
      language,
      addReasoning,
      outputFormat
    }));
  }, [processingType, language, addReasoning, outputFormat]);

  // Parse keywords from comma-separated string to array when updating
  const handleKeywordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeywordsInput(value);
    
    // Parse comma-separated keywords into array
    const keywordsArray = value
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    setConfig(prev => ({
      ...prev,
      keywords: keywordsArray
    }));
  };

  // Set keywords from suggestion
  const applySuggestedKeywords = () => {
    if (suggestedKeywords.length > 0) {
      const keywordsString = suggestedKeywords.join(', ');
      setKeywordsInput(keywordsString);
      setConfig(prev => ({
        ...prev,
        keywords: suggestedKeywords
      }));
    }
  };

  // Set system prompt from suggestion
  const applySuggestedPrompt = () => {
    if (suggestedPrompt) {
      setConfig(prev => ({
        ...prev,
        systemPrompt: suggestedPrompt
      }));
    }
  };

  // Apply all suggestions
  const applyAllSuggestions = () => {
    applySuggestedKeywords();
    applySuggestedPrompt();
  };

  // Get suggestions from the backend
  const getSuggestions = async () => {
    if (!fileId || !backendUrl) return;

    setIsSuggesting(true);
    try {
      const response = await fetch(`${backendUrl}/api/suggest-params`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: fileId,
          max_preview_chars: 5000
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedKeywords(data.suggested_keywords || []);
        setSuggestedPrompt(data.suggested_system_prompt || '');
      } else {
        console.error('Failed to get suggestions:', await response.text());
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
    } finally {
      setIsSuggesting(false);
    }
  };

  // Save model to recent history when Process button is clicked
  const handleProcessWithModelTracking = (config: ProcessingConfig) => {
    if (config.provider && config.model) {
      saveModelToRecent(config.provider, config.model);
    }
    onSubmit(config);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-card shadow">
      <h3 className="text-lg font-medium">Processing Configuration</h3>
      
      {/* Provider Selection */}
      <div className="space-y-2">
        <label htmlFor="provider" className="block text-sm font-medium">Provider</label>
        <Select
          disabled={isLoading}
          value={config.provider}
          onValueChange={(value) => setConfig(prev => ({ ...prev, provider: value }))}
        >
          <SelectTrigger id="provider" className="w-full">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {modelData ? (
              Object.keys(modelData).map((providerKey) => (
                <SelectItem key={providerKey} value={providerKey}>
                  {modelData[providerKey].name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="loading" disabled>Loading providers...</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <label htmlFor="model" className="block text-sm font-medium">Model</label>
        <Select
          disabled={isLoading || modelOptions.length === 0}
          value={config.model}
          onValueChange={(value) => setConfig(prev => ({ ...prev, model: value }))}
        >
          <SelectTrigger id="model" className="w-full">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.length > 0 ? (
              <>
                {/* Check if we have any recent models */}
                {modelOptions.some((model: any) => model.isRecent) && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      Recently Used
                    </div>
                    {modelOptions
                      .filter((model: any) => model.isRecent)
                      .map((model) => (
                        <SelectItem key={`recent-${model.id}`} value={model.id}>
                          {model.name} ★
                        </SelectItem>
                      ))
                    }
                    <div className="h-px my-1 bg-gray-200 dark:bg-gray-700" />
                    <div className="px-2 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                      All Models
                    </div>
                  </>
                )}
                
                {/* Regular models (or all models if no recent ones) */}
                {modelOptions
                  .filter((model: any) => !model.isRecent)
                  .map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))
                }
              </>
            ) : (
              <SelectItem value="loading" disabled>
                {isLoading ? 'Loading models...' : 'No models available'}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Processing Type Selection */}
      <div className="space-y-2">
        <label htmlFor="processingType" className="block text-sm font-medium">Processing Type</label>
        <Select
          value={processingType}
          onValueChange={setProcessingType}
        >
          <SelectTrigger id="processingType" className="w-full">
            <SelectValue placeholder="Wybierz typ przetwarzania" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standardowy</SelectItem>
            <SelectItem value="article">Artykuł naukowy</SelectItem>
            <SelectItem value="translate">Tłumaczenie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Language Selection */}
      <div className="space-y-2">
        <label htmlFor="language" className="block text-sm font-medium">Language</label>
        <Select
          value={language}
          onValueChange={setLanguage}
        >
          <SelectTrigger id="language" className="w-full">
            <SelectValue placeholder="Wybierz język" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pl">Polski</SelectItem>
            <SelectItem value="en">Angielski</SelectItem>
            <SelectItem value="de">Niemiecki</SelectItem>
            <SelectItem value="fr">Francuski</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Output Format Selection */}
      <div className="space-y-2">
        <label htmlFor="outputFormat" className="block text-sm font-medium">Output Format</label>
        <Select
          value={outputFormat}
          onValueChange={setOutputFormat}
        >
          <SelectTrigger id="outputFormat" className="w-full">
            <SelectValue placeholder="Wybierz format wyjściowy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON (jeden plik)</SelectItem>
            <SelectItem value="jsonl">JSONL (linia po linii)</SelectItem>
            <SelectItem value="csv">CSV (wartości rozdzielone)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Add Reasoning Toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="addReasoning"
          checked={addReasoning}
          onChange={(e) => setAddReasoning(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="addReasoning" className="text-sm font-medium">Dodaj uzasadnienie (reasoning)</label>
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label htmlFor="systemPrompt" className="block text-sm font-medium">System Prompt</label>
          {suggestedPrompt && (
            <button 
              onClick={applySuggestedPrompt}
              className="text-xs text-blue-600 hover:text-blue-800"
              type="button"
            >
              Zastosuj sugestię
            </button>
          )}
        </div>
        <textarea
          id="systemPrompt"
          value={config.systemPrompt || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={3}
          placeholder="Wprowadź instrukcje dla modelu (opcjonalnie)"
        />
        {suggestedPrompt && (
          <div className="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
            Sugestia: {suggestedPrompt}
          </div>
        )}
      </div>

      {/* Keywords */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label htmlFor="keywords" className="block text-sm font-medium">Keywords</label>
          {suggestedKeywords.length > 0 && (
            <button 
              onClick={applySuggestedKeywords}
              className="text-xs text-blue-600 hover:text-blue-800"
              type="button"
            >
              Zastosuj sugestię
            </button>
          )}
        </div>
        <input
          id="keywords"
          type="text"
          value={keywordsInput}
          onChange={handleKeywordsChange}
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="Wprowadź słowa kluczowe oddzielone przecinkami"
        />
        {suggestedKeywords.length > 0 && (
          <div className="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
            Sugestie: {suggestedKeywords.join(', ')}
          </div>
        )}
      </div>

      {/* Temperature Slider */}
      <div className="space-y-2">
        <label htmlFor="temperature" className="block text-sm font-medium">
          Temperature: {config.temperature?.toFixed(1)}
        </label>
        <input
          id="temperature"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={config.temperature || 0.7}
          onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
          className="w-full"
        />
      </div>

      {/* Max Tokens */}
      <div className="space-y-2">
        <label htmlFor="maxTokens" className="block text-sm font-medium">Max Tokens</label>
        <input
          id="maxTokens"
          type="number"
          value={config.maxTokens || ''}
          onChange={(e) => {
            const value = e.target.value ? parseInt(e.target.value) : undefined;
            setConfig(prev => ({ ...prev, maxTokens: value }));
          }}
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="Zostaw puste dla domyślnego limitu tokenu modelu"
        />
      </div>

      {/* Suggestions buttons */}
      {fileId && (
        <div className="pt-2 flex space-x-2 justify-end">
          <button
            onClick={getSuggestions}
            disabled={isSuggesting || !fileId}
            className={`px-3 py-1 text-sm rounded-md ${
              isSuggesting 
                ? 'bg-gray-200 text-gray-500' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            type="button"
          >
            {isSuggesting ? 'Pobieranie sugestii...' : 'Pobierz sugestie'}
          </button>
          
          {(suggestedKeywords.length > 0 || suggestedPrompt) && (
            <button
              onClick={applyAllSuggestions}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              type="button"
            >
              Zastosuj wszystkie
            </button>
          )}
        </div>
      )}

      {/* Submit and Cancel buttons */}
      <div className="pt-4 mt-4 border-t border-gray-200 flex justify-end space-x-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          type="button"
        >
          Anuluj
        </button>
        <button
          onClick={() => handleProcessWithModelTracking(config)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          type="button"
        >
          Przetwórz plik
        </button>
      </div>
    </div>
  );
};

export default ProcessingConfigurator;