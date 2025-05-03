import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AvailableModels } from '../types/models';

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
  onSubmit,
  onCancel,
  backendUrl,
  availableModels: modelData,
  isLoadingModels: isLoading,
  fileId
}) => {
  // Create internal config state
  const [config, setConfig] = useState<ProcessingConfig>({
    provider: '',
    model: '',
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

  // Processing type options
  const [processingType, setProcessingType] = useState<string>('standard');
  console.log('ProcessingConfigurator initialized with backendUrl:', backendUrl);
  const [language, setLanguage] = useState<string>(initialLanguage || 'pl');
  const [addReasoning, setAddReasoning] = useState<boolean>(false);
  const [outputFormat, setOutputFormat] = useState<string>('json');

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

  // Update available models when provider changes or modelData loads
  useEffect(() => {
    if (modelData && config.provider) {
      const providerInfo = modelData[config.provider];
      if (providerInfo && Array.isArray(providerInfo.models)) {
        setModelOptions(providerInfo.models.map(model => ({
          id: model.id || model.model_id || model,
          name: model.name || model.model_name || model
        })));
        
        // If we haven't selected a model yet, or the selected model isn't available
        // for this provider, select the first available model
        const modelExists = providerInfo.models.some(m => (m.id || m.model_id || m) === config.model);
        if (!config.model || !modelExists) {
          if (providerInfo.models.length > 0) {
            const firstModel = providerInfo.models[0];
            setConfig(prev => ({
              ...prev,
              model: firstModel.id || firstModel.model_id || firstModel
            }));
          }
        }
      } else {
        setModelOptions([]);
      }
    }
  }, [config.provider, modelData]);

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
              modelOptions.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name}
                </SelectItem>
              ))
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
            <SelectValue placeholder="Select processing type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="article">Article</SelectItem>
            <SelectItem value="translate">Translate</SelectItem>
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
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pl">Polish</SelectItem>
            <SelectItem value="en">English</SelectItem>
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
            <SelectValue placeholder="Select output format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="jsonl">JSONL</SelectItem>
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
        <label htmlFor="addReasoning" className="text-sm font-medium">Add Reasoning</label>
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
              Apply Suggestion
            </button>
          )}
        </div>
        <textarea
          id="systemPrompt"
          value={config.systemPrompt || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={3}
          placeholder="Enter instructions for the model"
        />
        {suggestedPrompt && (
          <div className="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
            Suggestion: {suggestedPrompt}
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
              Apply Suggestion
            </button>
          )}
        </div>
        <input
          id="keywords"
          type="text"
          value={keywordsInput}
          onChange={handleKeywordsChange}
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="Enter keywords separated by commas"
        />
        {suggestedKeywords.length > 0 && (
          <div className="text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
            Suggestions: {suggestedKeywords.join(', ')}
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
          placeholder="Leave empty for model default"
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
            {isSuggesting ? 'Getting Suggestions...' : 'Get Suggestions'}
          </button>
          
          {(suggestedKeywords.length > 0 || suggestedPrompt) && (
            <button
              onClick={applyAllSuggestions}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
              type="button"
            >
              Apply All
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
          Cancel
        </button>
        <button
          onClick={() => onSubmit(config)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          type="button"
        >
          Process File
        </button>
      </div>
    </div>
  );
};

export default ProcessingConfigurator;