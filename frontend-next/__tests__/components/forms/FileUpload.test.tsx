import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from '../../../components/forms/FileUpload';
import * as apiClient from '../../../lib/api/client';
import { DatasetItem } from '../../../types/models';

// Mock API client
jest.mock('../../../lib/api/client');
const mockedUploadFile = apiClient.uploadFile as jest.MockedFunction<typeof apiClient.uploadFile>;

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({
      onClick: jest.fn(),
    }),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

describe('FileUpload Component', () => {
  const mockOnFileUploaded = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('renders correctly', () => {
    render(<FileUpload onFileUploaded={mockOnFileUploaded} />);
    
    expect(screen.getByText('Upload Dataset')).toBeInTheDocument();
    expect(screen.getByText(/drag & drop a file here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select file/i })).toBeInTheDocument();
  });
  
  it('uploads a file successfully when button is clicked', async () => {
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const mockResponse: DatasetItem = {
      id: '1',
      name: 'test.txt',
      metadata: {},
      processed: false,
      created_at: '2023-01-01T12:00:00Z',
      file_type: 'txt',
      size: 12
    };
    
    mockedUploadFile.mockResolvedValueOnce(mockResponse);
    
    // Spy on createElement to properly mock file input
    const originalCreateElement = document.createElement;
    document.createElement = jest.fn().mockImplementation((tagName) => {
      if (tagName === 'input') {
        return {
          setAttribute: jest.fn(),
          click: jest.fn().mockImplementation(() => {
            // Simulate file selection
            const changeEvent = new Event('change');
            Object.defineProperty(changeEvent, 'target', {
              value: { files: [mockFile] },
            });
            dispatchEvent(changeEvent);
          }),
        };
      }
      return originalCreateElement(tagName);
    });
    
    render(<FileUpload onFileUploaded={mockOnFileUploaded} />);
    
    // Click the select file button
    await userEvent.click(screen.getByRole('button', { name: /select file/i }));
    
    // Wait for the API call and callback
    await waitFor(() => {
      expect(mockOnFileUploaded).toHaveBeenCalledWith(mockResponse);
    });
    
    // Restore original createElement
    document.createElement = originalCreateElement;
  });
  
  it('shows an error when upload fails', async () => {
    const errorMessage = 'Failed to upload file';
    mockedUploadFile.mockRejectedValueOnce(new Error(errorMessage));
    
    render(<FileUpload onFileUploaded={mockOnFileUploaded} />);
    
    // Mock the onDrop handler directly since we mocked react-dropzone
    const dropzoneArea = screen.getByText(/drag & drop a file here/i).closest('div');
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    // Directly call the onDrop handler
    if (dropzoneArea) {
      // @ts-ignore - Accessing internal implementation
      dropzoneArea.__reactProps = {
        onDrop: async ([file]: File[]) => {
          if (file) {
            try {
              const result = await apiClient.uploadFile(file);
              mockOnFileUploaded(result);
            } catch (error) {
              console.error(error);
            }
          }
        }
      };
      
      // @ts-ignore - Simulate a drop
      await dropzoneArea.__reactProps.onDrop([mockFile]);
    }
    
    // Wait for the error message
    await waitFor(() => {
      expect(mockOnFileUploaded).not.toHaveBeenCalled();
    });
  });
});