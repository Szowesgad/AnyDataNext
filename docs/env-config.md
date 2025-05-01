# Environment Variables and Deployment Configuration

This document describes the environment variables used in the AnyDataset frontend and the deployment configuration for GitHub Pages.

## Environment Variables

### Frontend Environment Variables

The Next.js frontend uses the following environment variables:

| Variable | Description | Default Value | Required |
|----------|-------------|---------------|----------|
| `NEXT_PUBLIC_BACKEND_URL` | URL of the FastAPI backend API | `http://localhost:8000` | Yes |

### Configuration Files

- `.env.local` - Local development environment variables (not committed to Git)
- `.env.example` - Example environment variables for reference (committed to Git)

### Setting Up Environment Variables

1. Copy `.env.example` to `.env.local` for local development:
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

2. Edit `.env.local` to set the appropriate values for your environment.

3. For production deployment, set the environment variables in your deployment platform or in the CI/CD pipeline.

## GitHub Pages Deployment

The Next.js application is configured for static export and deployment to GitHub Pages.

### Configuration Files

- `next.config.ts` - Next.js configuration for static export
- `.github/workflows/build.yml` - GitHub Actions workflow for CI/CD
- `frontend/public/.nojekyll` - Prevent Jekyll processing on GitHub Pages
- `frontend/public/404.html` - Handle SPA routing on GitHub Pages

### Deployment Process

1. When changes are pushed to the `main` branch, the GitHub Actions workflow is triggered.
2. The workflow builds the Next.js application with static export and deploys it to GitHub Pages.
3. The application is accessible at `https://<username>.github.io/<repository>/`.

### Manual Deployment

For manual deployment:

1. Build the application:
   ```bash
   cd frontend
   npm run build
   ```

2. The build output is in the `out` directory, which can be deployed to any static hosting service.

3. For GitHub Pages, you can use the `gh-pages` package:
   ```bash
   npm run deploy
   ```

## Configuration Notes

- The `basePath` in `next.config.ts` is configured for repository-based GitHub Pages URLs.
- Static assets are stored in the `public` directory and will be available at the root of the deployed site.
- The `404.html` page handles client-side routing for SPA on GitHub Pages.

## Troubleshooting

- If the frontend cannot connect to the backend, check that the `NEXT_PUBLIC_BACKEND_URL` is correctly set.
- For CORS issues, ensure the backend has the correct CORS configuration.
- For routing issues on GitHub Pages, check that the `basePath` in `next.config.ts` matches your repository name.

---

Last updated: May 1, 2025