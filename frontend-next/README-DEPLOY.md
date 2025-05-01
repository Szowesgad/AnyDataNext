# AnyDataset Frontend Deployment Guide

This document outlines the deployment process for the AnyDataset frontend application.

## GitHub Pages Deployment

The application is automatically deployed to GitHub Pages using GitHub Actions. The workflow is configured in `.github/workflows/build.yml` and does the following:

1. Checks out the repository
2. Sets up Node.js
3. Installs dependencies
4. Runs tests
5. Runs linting
6. Builds the application for production
7. Uploads the build artifact
8. Deploys to GitHub Pages

The deployment URL will be: `https://[username].github.io/AnyDataset/`

## Configuration for Production

When the application is built for production deployment, the following settings are applied:

1. The API URL is set to `https://api.anydata.libraxis.cloud` (configurable in the workflow file)
2. The base path is set to `/AnyDataset` to match the GitHub Pages URL structure
3. Static export is enabled for GitHub Pages compatibility
4. Image optimization is disabled for static export compatibility

## Manual Deployment

If you need to deploy manually, follow these steps:

1. Configure the environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://api.anydata.libraxis.cloud
   ```

2. Build the application:
   ```bash
   npm run build
   ```

3. The build output will be in the `out` directory, which can be deployed to any static hosting service.

## Updating the Deployment

To update the deployment, simply push changes to the `main` branch, and the GitHub Actions workflow will automatically build and deploy the updated application.

You can also manually trigger the workflow from the GitHub Actions tab in the repository.

## Troubleshooting

If you encounter issues with the deployment:

1. Check the GitHub Actions workflow runs for any errors
2. Verify that your Next.js configuration is compatible with static export
3. Ensure all environment variables are correctly set in the workflow file
4. Check that the basePath is correctly configured for the GitHub Pages URL structure

(c)2025 by M&K