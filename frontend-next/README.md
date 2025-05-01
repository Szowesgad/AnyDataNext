# AnyDataset Frontend

This is the Next.js frontend for the AnyDataset application.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Testing

The project includes a comprehensive test suite using Jest and React Testing Library.

### Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

To generate a coverage report:

```bash
npm run test:coverage
```

### Test Files Structure

Tests are organized to mirror the application structure:

- `__tests__/components/` - Component tests
- `__tests__/lib/` - Utilities and API client tests
- `__tests__/app/` - Page component tests

## API Integration

The frontend integrates with the AnyDataset backend API. The API URL can be configured via the `NEXT_PUBLIC_API_URL` environment variable.

Default configuration expects the backend to run at `http://localhost:8000`.

## Main Features

- File upload and processing
- Real-time progress tracking via WebSockets
- Batch processing of multiple files
- Support for various file formats (TXT, CSV, PDF, DOCX, etc.)

## Components

The UI is built using a component library based on Tailwind CSS and Radix UI primitives:

- `components/ui/` - Core UI components
- `components/forms/` - Form-related components
- `components/data-display/` - Data display components

## Project Structure

```
frontend-next/
├── app/               # Next.js App Router pages
├── components/        # React components
│   ├── ui/            # Basic UI components
│   ├── forms/         # Form components
│   └── data-display/  # Data visualization components
├── lib/               # Utility functions
│   └── api/           # API clients
├── public/            # Static assets
├── types/             # TypeScript types
└── __tests__/         # Test files
```

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For production, update this to your deployed backend URL.