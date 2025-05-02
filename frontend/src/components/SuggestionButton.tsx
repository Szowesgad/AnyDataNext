'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface SuggestionButtonProps {
  backendUrl: string;
  fileId: string;
  onSuggestionsReceived: (keywords: string[], systemPrompt: string) => void;
  className?: string;
}

const SuggestionButton: React.FC<SuggestionButtonProps> = ({
  backendUrl,
  fileId,
  onSuggestionsReceived,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${backendUrl}/api/suggest-params`, {
        file_id: fileId,
        max_preview_chars: 10000 // Adjust as needed
      });

      // Check if the response contains the expected data
      if (response.data && response.status === 200) {
        const { suggested_keywords, suggested_system_prompt } = response.data;
        
        // Call the callback with the suggestions
        onSuggestionsReceived(
          Array.isArray(suggested_keywords) ? suggested_keywords : [],
          typeof suggested_system_prompt === 'string' ? suggested_system_prompt : ''
        );
      } else {
        setError('Received an invalid response from the server.');
      }
    } catch (err: any) {
      console.error('Error getting suggestions:', err);
      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.detail || err.message
          : 'Failed to get suggestions. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`flex items-center justify-center px-3 py-1 text-sm border border-blue-300 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 ${className}`}
        title="Get AI suggestions for keywords and system prompt based on file content"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Getting suggestions...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
            </svg>
            Get AI Suggestions
          </>
        )}
      </button>
      {error && (
        <div className="mt-2 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default SuggestionButton;