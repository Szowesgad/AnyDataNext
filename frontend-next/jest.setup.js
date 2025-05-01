// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

import '@testing-library/jest-dom';

// Mock next/router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  usePathname: () => '',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock window.URL.createObjectURL
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'URL', {
    value: {
      createObjectURL: jest.fn(),
    },
  });
}

// Mock IntersectionObserver which isn't available in test environment
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {
    return null;
  }
  observe() {
    return null;
  }
  takeRecords() {
    return null;
  }
  unobserve() {
    return null;
  }
};

// Mock WebSocket
global.WebSocket = class WebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // Open
  }
  
  send() {
    return null;
  }
  
  close() {
    return null;
  }
};