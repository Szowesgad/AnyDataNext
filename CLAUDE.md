# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# AnyDataset Development Guide

## Build/Test Commands
- **Backend Start**: `cd backend && source .venv/bin/activate && uvicorn app.app:app --host 0.0.0.0 --port 8000 --reload`
- **Frontend Start**: `cd frontend && npm run dev`
- **Full Dev Environment**: `./start_dev.sh` (starts both backend and frontend)
- **Install Backend Dependencies**: `cd backend && uv pip install -r requirements.txt`
- **Install Frontend Dependencies**: `cd frontend && npm install`
- **Frontend Lint**: `cd frontend && npm run lint`
- **Backend Format**: Follow PEP 8 with 4 spaces indentation and 100-char line limit
- **Backend Testing**: No formal test suite yet. Future implementation should use pytest

## Code Style Guidelines
- **Imports**: Standard library → third-party → local packages (grouped by type)
- **Formatting**: 4 spaces indentation; 100-char line limit
- **Naming**: `snake_case` for variables/functions, `CamelCase` for classes; React components use `PascalCase`
- **Type Annotations**: Use typing module (`List`, `Dict`, `Optional`) in Python; strict TypeScript in frontend
- **Documentation**: Docstrings for all functions with Args/Returns sections
- **Error Handling**: Use specific exception types; log errors with `logger` instance
- **API Structure**: Use FastAPI for backend routes; follow RESTful practices
- **Frontend Components**: React components in `frontend/src/components`; use shadcn/ui components
- **Async/Await**: Use asyncio-based patterns throughout the backend codebase
- **File Processing**: For new file format support, focus on robust parsing with proper error handling rather than rigid regex patterns. Refer to HOTFIX.MD for implementation guidance
- **WebSocket Updates**: Use the WebSocket connection manager for real-time progress updates
- **Parallel Processing**: Control parallel operations with `max_workers` parameter
- **Multimedia Processing**: Audio/video file processing in utils/multimedia_processor.py
- **Error Handling**: Use granular try/except blocks with specific exception types; use logging module for detailed error reporting