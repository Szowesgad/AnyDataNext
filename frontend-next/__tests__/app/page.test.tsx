import React from 'react';
import { render, screen } from '@testing-library/react';
import Home from '../../app/page';

// Mock Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe('Home Page', () => {
  it('renders correctly', () => {
    render(<Home />);
    
    // Check title and description
    expect(screen.getByText('AnyDataset')).toBeInTheDocument();
    expect(screen.getByText(/Process any dataset with AI/i)).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByRole('button', { name: /Upload Single File/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Batch Processing/i })).toBeInTheDocument();
    
    // Check links
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/upload');
    expect(links[1]).toHaveAttribute('href', '/batch');
  });
});