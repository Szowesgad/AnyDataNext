import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadPage from '../../../app/upload/page';
import * as apiClient from '../../../lib/api/client';
import { DatasetItem, ProcessingResult } from '../../../types/models';

// Mock API client
jest.mock('../../../lib/api/client');
const mockedProcessFile = apiClient.processFile as jest.MockedFunction<typeof apiClient.processFile>;

// Mock components
jest.mock('../../../components/forms/FileUpload', () => ({
  FileUpload: ({ onFileUploaded }: { onFileUploaded: (file: DatasetItem) => void }) => {
    return (
      <div data-testid="file-upload">
        <button 
          onClick={() => onFileUploaded({
            id: '1',
            name: 'test.txt',
            metadata: {},
            processed: false,
            created_at: '2023-01-01T12:00:00Z',
            file_type: 'txt',
            size: 1024
          })}
        >
          Upload File
        </button>
      </div>
    );
  }
}));

jest.mock('../../../components/data-display/ProgressIndicator', () => ({
  ProgressIndicator: ({ jobId }: { jobId: string }) => {
    return <div data-testid="progress-indicator">Progress for job {jobId}</div>;
  }
}));

describe('Upload Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders the upload form initially', () => {
    render(<UploadPage />);
    
    expect(screen.getByText('Process Single File')).toBeInTheDocument();
    expect(screen.getByTestId('file-upload')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-indicator')).not.toBeInTheDocument();
  });
  
  it('displays file details after upload', async () => {
    render(<UploadPage />);
    
    // Click the upload button in mocked FileUpload
    await userEvent.click(screen.getByRole('button', { name: /upload file/i }));
    
    // File details should be displayed
    expect(screen.getByText('File Details')).toBeInTheDocument();
    expect(screen.getByText(/Name:/)).toBeInTheDocument();
    expect(screen.getByText(/test.txt/)).toBeInTheDocument();
    expect(screen.getByText(/Type:/)).toBeInTheDocument();
    expect(screen.getByText(/txt/)).toBeInTheDocument();
    expect(screen.getByText(/Size:/)).toBeInTheDocument();
    expect(screen.getByText(/1 KB/)).toBeInTheDocument();
    
    // Process button should be visible
    expect(screen.getByRole('button', { name: /process file/i })).toBeInTheDocument();
  });
  
  it('processes a file and shows progress indicator', async () => {
    const mockResult: ProcessingResult = {
      success: true,
      job_id: 'job-123',
      processed_files: 1,
      total_files: 1
    };
    
    mockedProcessFile.mockResolvedValueOnce(mockResult);
    
    render(<UploadPage />);
    
    // Upload file
    await userEvent.click(screen.getByRole('button', { name: /upload file/i }));
    
    // Process file
    await userEvent.click(screen.getByRole('button', { name: /process file/i }));
    
    // Wait for API call to complete
    await waitFor(() => {
      expect(mockedProcessFile).toHaveBeenCalledWith('1', expect.objectContaining({
        model_provider: 'openai',
        model_name: 'gpt-3.5-turbo',
        processing_type: 'standard'
      }));
    });
    
    // Progress indicator should be displayed
    expect(screen.getByTestId('progress-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Progress for job job-123/)).toBeInTheDocument();
  });
  
  it('shows an error when processing fails', async () => {
    const errorMessage = 'API request failed';
    mockedProcessFile.mockRejectedValueOnce(new Error(errorMessage));
    
    render(<UploadPage />);
    
    // Upload file
    await userEvent.click(screen.getByRole('button', { name: /upload file/i }));
    
    // Process file
    await userEvent.click(screen.getByRole('button', { name: /process file/i }));
    
    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to process file:/)).toBeInTheDocument();
    });
    
    // Progress indicator should not be displayed
    expect(screen.queryByTestId('progress-indicator')).not.toBeInTheDocument();
  });
});