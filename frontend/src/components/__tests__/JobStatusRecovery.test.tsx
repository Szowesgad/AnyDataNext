import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JobStatusRecovery from '../JobStatusRecovery';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('JobStatusRecovery', () => {
  const mockProps = {
    backendUrl: 'http://localhost:8000',
    onJobRecovered: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<JobStatusRecovery {...mockProps} />);
    expect(screen.getByText('Recover Job Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Job ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recover' })).toBeInTheDocument();
  });

  it('validates empty job ID', async () => {
    render(<JobStatusRecovery {...mockProps} />);
    
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    
    expect(screen.getByText('Please enter a valid job ID')).toBeInTheDocument();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('shows loading state when submitting', async () => {
    // Setup axios mock to return a promise that never resolves
    mockedAxios.get.mockImplementation(() => new Promise(() => {}));
    
    render(<JobStatusRecovery {...mockProps} />);
    
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'test-job-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    
    await waitFor(() => {
      expect(screen.getByText('Loading')).toBeInTheDocument();
    });
  });

  it('calls onJobRecovered with data when successful', async () => {
    const mockJobId = 'test-job-id';
    const mockJobStatus = {
      job_id: mockJobId,
      status: 'completed',
      progress: 100
    };
    
    // Setup axios mock to return successful response
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data: mockJobStatus
    });
    
    render(<JobStatusRecovery {...mockProps} />);
    
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: mockJobId } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    
    await waitFor(() => {
      expect(mockProps.onJobRecovered).toHaveBeenCalledWith(mockJobId, mockJobStatus);
    });
  });

  it('shows error message when job not found', async () => {
    // Setup axios mock to return 404 error
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404
      }
    });
    
    render(<JobStatusRecovery {...mockProps} />);
    
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'non-existent-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    
    await waitFor(() => {
      expect(screen.getByText('Job not found. Please check the ID and try again.')).toBeInTheDocument();
    });
  });

  it('shows general error message for other errors', async () => {
    // Setup axios mock to return general error
    mockedAxios.get.mockRejectedValue({
      isAxiosError: true,
      message: 'Network Error'
    });
    
    render(<JobStatusRecovery {...mockProps} />);
    
    fireEvent.change(screen.getByLabelText('Job ID'), { target: { value: 'test-job-id' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));
    
    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });
  });
});