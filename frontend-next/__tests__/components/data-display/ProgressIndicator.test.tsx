import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressIndicator } from '../../../components/data-display/ProgressIndicator';
import * as apiClient from '../../../lib/api/client';
import { webSocketService } from '../../../lib/api/websocket';
import { ProgressStatus } from '../../../types/models';

// Mock API client
jest.mock('../../../lib/api/client');
const mockedGetJobProgress = apiClient.getJobProgress as jest.MockedFunction<typeof apiClient.getJobProgress>;
const mockedDownloadResults = apiClient.downloadResults as jest.MockedFunction<typeof apiClient.downloadResults>;

// Mock WebSocketService
jest.mock('../../../lib/api/websocket', () => ({
  webSocketService: {
    subscribe: jest.fn().mockImplementation((jobId, callback) => {
      // Store the callback for later use in tests
      (window as any).wsCallback = callback;
      return jest.fn(); // Return unsubscribe function
    })
  }
}));

describe('ProgressIndicator Component', () => {
  const mockJobId = 'job-123';
  const mockOnComplete = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders loading state initially', () => {
    mockedGetJobProgress.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    
    render(<ProgressIndicator jobId={mockJobId} />);
    
    expect(screen.getByText('Loading progress...')).toBeInTheDocument();
  });
  
  it('renders progress when data is loaded', async () => {
    const mockProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 3,
      total: 10,
      status: 'in_progress'
    };
    
    mockedGetJobProgress.mockResolvedValueOnce(mockProgress);
    
    render(<ProgressIndicator jobId={mockJobId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Progress: 30%')).toBeInTheDocument();
      expect(screen.getByText('3 of 10')).toBeInTheDocument();
      expect(screen.getByText('Processing files... This may take a few minutes.')).toBeInTheDocument();
    });
    
    expect(mockedGetJobProgress).toHaveBeenCalledWith(mockJobId);
  });
  
  it('renders completed state and download button', async () => {
    const mockProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 10,
      total: 10,
      status: 'completed'
    };
    
    mockedGetJobProgress.mockResolvedValueOnce(mockProgress);
    
    render(<ProgressIndicator jobId={mockJobId} onComplete={mockOnComplete} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing complete!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download results/i })).toBeInTheDocument();
    });
    
    expect(mockOnComplete).toHaveBeenCalled();
  });
  
  it('renders failed state with error message', async () => {
    const errorMessage = 'Processing failed due to invalid file format';
    const mockProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 5,
      total: 10,
      status: 'failed',
      error: errorMessage
    };
    
    mockedGetJobProgress.mockResolvedValueOnce(mockProgress);
    
    render(<ProgressIndicator jobId={mockJobId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Processing failed')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
  
  it('updates progress when websocket sends an update', async () => {
    // Initial progress
    const initialProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 3,
      total: 10,
      status: 'in_progress'
    };
    
    // Updated progress via WebSocket
    const updatedProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 7,
      total: 10,
      status: 'in_progress'
    };
    
    mockedGetJobProgress.mockResolvedValueOnce(initialProgress);
    
    render(<ProgressIndicator jobId={mockJobId} />);
    
    await waitFor(() => {
      expect(screen.getByText('Progress: 30%')).toBeInTheDocument();
    });
    
    // Simulate WebSocket update
    const wsCallback = (window as any).wsCallback;
    wsCallback(updatedProgress);
    
    await waitFor(() => {
      expect(screen.getByText('Progress: 70%')).toBeInTheDocument();
      expect(screen.getByText('7 of 10')).toBeInTheDocument();
    });
  });
  
  it('downloads results when button is clicked', async () => {
    const mockProgress: ProgressStatus = {
      job_id: mockJobId,
      current: 10,
      total: 10,
      status: 'completed'
    };
    
    mockedGetJobProgress.mockResolvedValueOnce(mockProgress);
    
    render(<ProgressIndicator jobId={mockJobId} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download results/i })).toBeInTheDocument();
    });
    
    await userEvent.click(screen.getByRole('button', { name: /download results/i }));
    
    expect(mockedDownloadResults).toHaveBeenCalledWith(mockJobId);
  });
});