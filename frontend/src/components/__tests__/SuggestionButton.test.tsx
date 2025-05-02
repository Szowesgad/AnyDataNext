import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SuggestionButton from '../SuggestionButton';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SuggestionButton', () => {
  const mockProps = {
    backendUrl: 'http://localhost:8000',
    fileId: 'test-file-id',
    onSuggestionsReceived: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<SuggestionButton {...mockProps} />);
    expect(screen.getByText('Get AI Suggestions')).toBeInTheDocument();
  });

  it('shows loading state when clicked', async () => {
    // Setup axios mock to return a promise that never resolves
    mockedAxios.post.mockImplementation(() => new Promise(() => {}));
    
    render(<SuggestionButton {...mockProps} />);
    
    fireEvent.click(screen.getByText('Get AI Suggestions'));
    
    await waitFor(() => {
      expect(screen.getByText('Getting suggestions...')).toBeInTheDocument();
    });
  });

  it('calls onSuggestionsReceived with data when successful', async () => {
    // Setup axios mock to return successful response
    const mockResponse = {
      status: 200,
      data: {
        suggested_keywords: ['test', 'keywords'],
        suggested_system_prompt: 'Test system prompt'
      }
    };
    mockedAxios.post.mockResolvedValue(mockResponse);
    
    render(<SuggestionButton {...mockProps} />);
    
    fireEvent.click(screen.getByText('Get AI Suggestions'));
    
    await waitFor(() => {
      expect(mockProps.onSuggestionsReceived).toHaveBeenCalledWith(
        ['test', 'keywords'],
        'Test system prompt'
      );
    });
  });

  it('shows error message when request fails', async () => {
    // Setup axios mock to return error
    const errorMessage = 'API Error';
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      message: errorMessage
    });
    
    render(<SuggestionButton {...mockProps} />);
    
    fireEvent.click(screen.getByText('Get AI Suggestions'));
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});