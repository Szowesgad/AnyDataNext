import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface ModelSelectorProps {
  onModelSelect: (provider: string, model: string) => void;
  className?: string;
}

// Interface for recent model in localStorage
interface RecentModel {
  provider: string;
  model: string;
  timestamp: number;
  name?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ onModelSelect, className = '' }) => {
  const [recentModels, setRecentModels] = useState<RecentModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Load recent models from localStorage
  useEffect(() => {
    setLoading(true);
    try {
      const storedModels = localStorage.getItem('recentModels');
      if (storedModels) {
        const parsedModels = JSON.parse(storedModels) as RecentModel[];
        // Sort by timestamp, newest first
        const sortedModels = parsedModels.sort((a, b) => b.timestamp - a.timestamp);
        setRecentModels(sortedModels);
      }
    } catch (error) {
      console.error('Error loading recent models from localStorage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle model selection
  const handleModelSelect = (value: string) => {
    // Value is formatted as "provider:model" to make it unique
    const [provider, model] = value.split(':');
    if (provider && model) {
      onModelSelect(provider, model);
    }
  };

  // Format model for display, with provider name and model name
  const formatModelName = (item: RecentModel): string => {
    return `${item.name || item.model}`;
  };

  // Format provider name
  const formatProviderName = (provider: string): string => {
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  if (recentModels.length === 0 && !loading) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No recent models. Select a model in Processing Configuration.
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <Select
        disabled={loading || recentModels.length === 0}
        onValueChange={handleModelSelect}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Quick select recent model" />
        </SelectTrigger>
        <SelectContent>
          {loading ? (
            <SelectItem value="loading" disabled>
              Loading recent models...
            </SelectItem>
          ) : (
            recentModels.map((item) => (
              <SelectItem 
                key={`${item.provider}:${item.model}`} 
                value={`${item.provider}:${item.model}`}
              >
                <span className="flex items-center">
                  <span className="font-medium mr-2 text-xs text-blue-600 dark:text-blue-400">
                    {formatProviderName(item.provider)}:
                  </span> 
                  {formatModelName(item)}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ModelSelector;