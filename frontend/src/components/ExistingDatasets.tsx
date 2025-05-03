'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Dataset {
  dataset_id: string;
  job_id?: string; // For backward compatibility with job API
  name: string;
  status?: string; // For backward compatibility with job API
  created_at?: string | number;
  created_at_formatted?: string;
  record_count?: number;
  source_file?: string;
  model_used?: string;
  format?: string;
  download_url?: string;
  preview_url?: string;
  file_type?: string; // For backward compatibility with job API
}

interface ExistingDatasetsProps {
  backendUrl: string;
  onSelectDataset?: (datasetId: string) => void;
}

const ExistingDatasets: React.FC<ExistingDatasetsProps> = ({ backendUrl, onSelectDataset }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // First try the dedicated datasets API endpoint
        try {
          const response = await axios.get(`${backendUrl}/api/datasets`);
          if (response.status === 200) {
            console.log("Datasets loaded from dedicated API:", response.data);
            setDatasets(response.data);
            return;
          }
        } catch (e) {
          console.warn("Datasets API not available, falling back to job status API:", e);
        }
        
        // Fallback to job status API if the datasets API is not available
        const response = await axios.get(`${backendUrl}/api/status`);
        
        if (response.status === 200) {
          // Filter for completed datasets
          const completedDatasets = response.data.filter(
            (job: any) => job.completed && job.status === 'completed'
          );
          console.log("Datasets loaded from job status API:", completedDatasets);
          setDatasets(completedDatasets);
        } else {
          throw new Error('Failed to fetch datasets');
        }
      } catch (err: any) {
        console.error('Error fetching datasets:', err);
        setError('Failed to load existing datasets');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDatasets();
  }, [backendUrl]);

  if (isLoading) {
    return <div className="text-center p-4">Loading existing datasets...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">{error}</div>;
  }

  if (datasets.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        No existing datasets found. Process a file to create your first dataset.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-medium mb-3">Existing Datasets</h3>
      <div className="grid gap-3">
        {datasets.map((dataset) => {
          // Handle both API formats (datasets API and job API)
          const datasetId = dataset.dataset_id || dataset.job_id;
          const createdDate = dataset.created_at_formatted || 
            (dataset.created_at ? new Date(dataset.created_at).toLocaleString() : 'Unknown date');
          const recordCount = dataset.record_count ? `${dataset.record_count} records` : '';
          const sourceFile = dataset.source_file ? `Source: ${dataset.source_file}` : '';
            
          return (
            <div
              key={datasetId}
              className="p-3 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectDataset && onSelectDataset(datasetId)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-medium">{dataset.name || `Dataset ${datasetId.substring(0, 8)}`}</p>
                  <div className="text-xs text-gray-500 flex flex-col">
                    <span>Created: {createdDate}</span>
                    {recordCount && <span>{recordCount}</span>}
                    {sourceFile && <span className="truncate max-w-[200px]">{sourceFile}</span>}
                    {dataset.model_used && <span>Model: {dataset.model_used}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 mb-2">
                    {dataset.status || 'Ready'}
                  </span>
                  {dataset.download_url && (
                    <a 
                      href={`${backendUrl}${dataset.download_url}`} 
                      className="text-xs text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                      download
                    >
                      Download
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExistingDatasets;