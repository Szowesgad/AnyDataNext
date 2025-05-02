'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface JobStatusRecoveryProps {
  backendUrl: string;
  onJobRecovered: (jobId: string, status: any) => void;
  className?: string;
}

const JobStatusRecovery: React.FC<JobStatusRecoveryProps> = ({
  backendUrl,
  onJobRecovered,
  className = '',
}) => {
  const [jobId, setJobId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJobId(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!jobId.trim()) {
      setError('Please enter a valid job ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${backendUrl}/api/status/${jobId.trim()}`);
      
      if (response.status === 200 && response.data) {
        onJobRecovered(jobId.trim(), response.data);
        setJobId(''); // Clear input after successful recovery
      } else {
        setError('Could not retrieve job information.');
      }
    } catch (err: any) {
      console.error('Error retrieving job status:', err);
      const errorMsg = axios.isAxiosError(err)
        ? (err.response?.status === 404 
            ? 'Job not found. Please check the ID and try again.' 
            : err.response?.data?.detail || err.message)
        : 'Failed to retrieve job status. Please try again.';
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Recover Job Status</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Enter a job ID to recover its status or results
      </p>
      
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-grow">
          <label htmlFor="jobIdInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Job ID
          </label>
          <input
            id="jobIdInput"
            type="text"
            value={jobId}
            onChange={handleInputChange}
            placeholder="Enter job ID..."
            className="w-full border dark:border-gray-600 rounded-md shadow-sm p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isLoading}
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !jobId.trim()}
          className="px-4 py-2 border border-transparent rounded text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading
            </span>
          ) : 'Recover'}
        </button>
      </form>
      
      {error && (
        <div className="mt-2 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default JobStatusRecovery;