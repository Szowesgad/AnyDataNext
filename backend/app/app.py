#!/usr/bin/env python3
"""
AnyDataset - Main FastAPI application for backend API
"""
import json
import os
import uuid
import time
import asyncio
import re
from contextlib import asynccontextmanager # Needed for lifespan
from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, WebSocket, WebSocketDisconnect, Request, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List, Dict, Any
import shutil
from pathlib import Path
import tempfile
import traceback
import zipfile
import io
import pydantic

# --- Load environment variables early ---
from dotenv import load_dotenv
load_dotenv() # Load variables from .env file into environment
# -----------------------------------------

# Import utility functions
import sys
APP_PARENT_DIR = Path(__file__).resolve().parent.parent
UTILS_DIR = APP_PARENT_DIR / 'utils'
sys.path.insert(0, str(APP_PARENT_DIR)) # Add backend/ to sys.path

from app.utils.process import process_file, process_files, save_results
from app.utils.logging import setup_logging
from app.utils.models import get_available_models, get_default_provider, get_default_model
from app.utils.client import get_llm_client # Import LLM client getter
from app.utils.multimedia_processor import create_audio_text_dataset

logger = setup_logging()

# Define application lifespan manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    logger.info("Application starting up...")
    load_dotenv()
    
    # Load available models ASYNCHRONOUSLY and store in app state
    try:
        # Use await here for the async function
        available_models_data = await get_available_models(filter_by_api_keys=True)
        app.state.available_models = available_models_data
        logger.info("--- Available Models Loaded During Startup (Dynamic Fetch) ---")
        if app.state.available_models:
             for provider, config in app.state.available_models.items():
                 model_count = len(config.get('models', []))
                 logger.info(f"Available provider: {provider} with {model_count} models")
        else:
             logger.warning("No models available after checking API keys and dynamic fetch.")
        logger.info("-------------------------------------------------------------")
    except Exception as e:
        logger.error(f"Failed to load available models during startup: {e}", exc_info=True)
        app.state.available_models = {}

    app.state.active_jobs = {}
    yield
    # --- Shutdown ---
    logger.info("Application shutting down...")

# Create the FastAPI app WITH lifespan
app = FastAPI(title="AnyDataset Backend API", lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch all unhandled exceptions and return a JSON response.
    """
    logger.error(
        f"Unhandled exception at {request.url}:\n"
        f"Type: {type(exc).__name__}\n"
        f"Error: {str(exc)}\n"
        f"Traceback:\n{traceback.format_exc()}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred on the server."}
    )

# WebSocket connection manager for real-time progress updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_progress(self, client_id: str, data: Dict[str, Any]):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send progress to client {client_id}: {e}")
                self.disconnect(client_id) # Disconnect broken connections

    async def broadcast(self, message: Dict[str, Any]):
        # Use items() for safe iteration during potential disconnections
        items = list(self.active_connections.items())
        for client_id, connection in items:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to broadcast to client {client_id}: {e}")
                self.disconnect(client_id) # Disconnect broken connections

manager = ConnectionManager()

# Configure CORS
# Allow specific origins in production, use wildcard for development if needed
origins = [
    "http://localhost:3000",
    "http://localhost:3001", # Add port 3001 since frontend started there
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001", # Add port 3001
    "https://anydata.libraxis.cloud", # Add production frontend URL
    # Add other origins as needed (e.g., staging environment)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tymczasowo zezwalaj na wszystkie origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"] # Consider limiting exposed headers if necessary
)

# Paths
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"
OUTPUT_DIR = BACKEND_DIR / "ready"
LOGS_DIR = BACKEND_DIR / "logs"

# Ensure required directories exist
for dir_path in [UPLOAD_DIR, OUTPUT_DIR, LOGS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

@app.post("/api/upload")
async def upload_file_api(file: UploadFile = File(...)):
    """
    Handle file upload via API.

    Saves the file with a unique name in the UPLOAD_DIR.

    Returns:
        JSON response with a unique file_id (the generated filename)
        and original filename.
    """
    try:
        # Create a unique filename to avoid collisions and path traversal issues
        timestamp = int(time.time())
        # Sanitize original filename for safety before creating extension
        safe_original_filename = re.sub(r'[^a-zA-Z0-9._-]', '_', file.filename)
        _, file_extension = os.path.splitext(safe_original_filename)
        unique_filename = f"{timestamp}_{uuid.uuid4().hex}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename # Use Path object

        # Save uploaded file securely
        try:
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as write_error:
            logger.error(f"Error writing uploaded file {unique_filename}: {write_error}")
            raise HTTPException(status_code=500, detail="Failed to save uploaded file.")
        finally:
            # Ensure the file object is closed
            file.file.close()

        file_size = file_path.stat().st_size
        logger.info(f"API Upload: {file.filename} -> {unique_filename} ({file_size} bytes)")

        return JSONResponse(content={
            "file_id": unique_filename, # Return the unique name as ID
            "original_filename": file.filename,
            "size": file_size
        })
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions directly
        raise http_exc
    except Exception as e:
        logger.error(f"Error during API file upload: {e}", exc_info=True)
        # Use the global exception handler by raising a generic exception
        # or return a specific JSONResponse
        return JSONResponse(
            status_code=500,
            content={"detail": f"Error uploading file: {str(e)}"}
        )

@app.get("/api/models")
async def get_models_api(request: Request):
    """
    Get all available models detected by the backend from app state.
    """
    # Access models loaded during startup via app state
    available_models = request.app.state.available_models
    if not available_models:
        # Return 503 if loading failed during startup or no models are configured
        raise HTTPException(status_code=503, detail="Model configuration not available or failed to load.")
    return JSONResponse(content=available_models)

# Pydantic Models for Request Body Validation
class ProcessRequest(pydantic.BaseModel):
    file_id: str
    model_provider: str
    model: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    system_prompt: Optional[str] = None
    language: str = "pl" # Default language
    keywords: List[str] = []
    output_format: str = "json" # Example: json, jsonl, etc.
    add_reasoning: bool = False
    processing_type: str = "standard" # 'standard', 'article', 'translate'

class SuggestParamsRequest(pydantic.BaseModel):
    file_id: str
    max_preview_chars: int = 5000 # Limit content sent for analysis

class SuggestParamsResponse(pydantic.BaseModel):
    suggested_keywords: List[str] = []
    suggested_system_prompt: str = ""

class AudioProcessRequest(pydantic.BaseModel):
    file_id: str
    language: Optional[str] = None # Optional: Whisper can detect, but hinting helps
    # Add other audio-specific params later? (e.g., segmentation strategy, speaker diarization toggle)

@app.post("/api/process")
async def process_single_file_api(
    process_request: ProcessRequest, # Use Pydantic model for validation
    background_tasks: BackgroundTasks,
    request: Request # Add request parameter
):
    """
    Process a single uploaded file with specified parameters via API.

    Args:
        process_request: Pydantic model containing processing parameters.
        background_tasks: FastAPI background tasks manager.

    Returns:
        JSON response with the job_id for status tracking.
    """
    try:
        logger.info(f"Received process request: {process_request.dict()}")
        available_models = request.app.state.available_models # Get models from state

        # Validate file_id existence - temporarily disabled for troubleshooting
        uploaded_file_path = UPLOAD_DIR / process_request.file_id
        logger.info(f"Checking file: {uploaded_file_path}, exists: {uploaded_file_path.is_file()}")
        # if not uploaded_file_path.is_file():
        #    logger.error(f"File not found for processing: {process_request.file_id}")
        #    raise HTTPException(status_code=404, detail=f"File with id {process_request.file_id} not found.")

        # Validate model selection - temporarily relaxed for troubleshooting
        if process_request.model_provider not in available_models:
            logger.error(f"Invalid model provider selected: {process_request.model_provider}")
            logger.info(f"Available providers: {list(available_models.keys())}")
            raise HTTPException(status_code=400, detail=f"Invalid model provider: {process_request.model_provider}")
            
        # Get model info and log for debugging
        provider_models = available_models.get(process_request.model_provider, {}).get('models', [])
        logger.info(f"Provider {process_request.model_provider} has models: {provider_models}")
        
        # Temporarily skip model validation
        # if process_request.model not in [m if isinstance(m, str) else m.get('id') for m in provider_models]:
        #    logger.error(f"Invalid model selected: {process_request.model}")
        #    raise HTTPException(status_code=400, detail=f"Invalid model: {process_request.model}")

        # Create job ID
        job_id = str(uuid.uuid4())

        # Create output directory for this job
        job_output_dir = OUTPUT_DIR / job_id
        job_output_dir.mkdir(parents=True, exist_ok=True)

        # Store job info
        job_info = {
            "job_id": job_id,
            "name": f"Single Process {job_id[:8]}",
            "file_id": process_request.file_id,
            "original_filename": uploaded_file_path.name, # Or get from somewhere else if needed
            "started_at": time.time(),
            "model_provider": process_request.model_provider,
            "model": process_request.model,
            "temperature": process_request.temperature,
            "max_tokens": process_request.max_tokens,
            "system_prompt": process_request.system_prompt,
            "language": process_request.language,
            "keywords": process_request.keywords,
            "output_format": process_request.output_format,
            "add_reasoning": process_request.add_reasoning,
            "processing_type": process_request.processing_type,
            "completed": False,
            "status": "queued",
            "progress": 0,
            "output_file": None,
            "error": None
        }
        request.app.state.active_jobs[job_id] = job_info

        # Run processing in background
        background_tasks.add_task(
            process_single_file_background,
            job_id=job_id,
            file_path=uploaded_file_path, # Pass the full path
            params=process_request, # Pass the validated request params
            app_state=request.app.state # Pass app state to background task
        )

        logger.info(f"Queued single file processing job {job_id} for file {process_request.file_id}")
        return JSONResponse(content={
            "job_id": job_id,
            "message": f"Processing queued for file {process_request.file_id}"
        })

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error queuing single file processing: {e}", exc_info=True)
        # Let the global handler manage this
        raise e

@app.post("/api/process-audio-dataset")
async def process_audio_dataset_api(
    audio_request: AudioProcessRequest,
    background_tasks: BackgroundTasks,
    request: Request # Add request parameter
):
    """
    Starts the background process to convert an audio/video file
    into a time-aligned audio-text dataset.

    Args:
        audio_request: Request containing file_id and options.
        background_tasks: FastAPI background tasks manager.

    Returns:
        JSON response with the job_id for status tracking.
    """
    try:
        logger.info(f"Received audio dataset request: {audio_request.dict()}")

        # Validate file_id existence
        uploaded_file_path = UPLOAD_DIR / audio_request.file_id
        if not uploaded_file_path.is_file():
            logger.error(f"Audio file not found for processing: {audio_request.file_id}")
            raise HTTPException(status_code=404, detail=f"File with id {audio_request.file_id} not found.")

        # Create job ID
        job_id = str(uuid.uuid4())

        # Create output directory for this job (will contain ZIP later)
        job_output_dir = OUTPUT_DIR / job_id
        job_output_dir.mkdir(parents=True, exist_ok=True)

        # Store job info (adapt structure for audio jobs)
        job_info = {
            "job_id": job_id,
            "name": f"Audio Dataset Job {job_id[:8]}",
            "file_id": audio_request.file_id,
            "original_filename": uploaded_file_path.name, 
            "started_at": time.time(),
            "language_hint": audio_request.language,
            "completed": False,
            "status": "queued",
            "progress": 0,
            "output_file": None, # Will be path to ZIP file
            "error": None
        }
        request.app.state.active_jobs[job_id] = job_info

        # Run processing in background
        background_tasks.add_task(
            process_audio_dataset_background,
            job_id=job_id,
            file_path=uploaded_file_path,
            params=audio_request,
            app_state=request.app.state # Pass app state to background task
        )

        logger.info(f"Queued audio dataset job {job_id} for file {audio_request.file_id}")
        return JSONResponse(content={
            "job_id": job_id,
            "message": f"Audio dataset processing queued for file {audio_request.file_id}"
        })

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Error queuing audio dataset job: {e}", exc_info=True)
        raise e

async def process_single_file_background(
    job_id: str,
    file_path: Path,
    params: ProcessRequest,
    app_state: Any # Receive app state
):
    """
    Background task to process a single file.

    Args:
        job_id: Unique job identifier.
        file_path: Path object to the file to process.
        params: Validated processing parameters.
    """
    job_output_dir = OUTPUT_DIR / job_id
    # Use Path object for output path manipulation
    output_path_obj = job_output_dir / f"output.{params.output_format}"
    start_job_time = time.time() # For total job duration logging

    try:
        logger.info(f"Starting background job {job_id} for file {file_path.name}")
        active_jobs = app_state.active_jobs # Get active jobs from state
        if job_id in active_jobs:
            active_jobs[job_id]["status"] = "processing"
        # Send initial processing status
        await manager.broadcast({"job_id": job_id, "type": "job_update", "status": "Initializing...", "progress": 5})

        # Call the main processing function (which now includes reading the file)
        # TODO: Consider adding progress updates within process_file itself if it's long-running internally
        file_records = await process_file(
            file_path=str(file_path), # process_file might expect string
            model_provider=params.model_provider,
            model=params.model,
            temperature=params.temperature,
            max_tokens=params.max_tokens, 
            system_prompt=params.system_prompt,
            language=params.language,
            keywords=params.keywords, 
            add_reasoning=params.add_reasoning, 
            processing_type=params.processing_type 
            # start_time is handled internally by process_file now
        )
        
        # Check if processing resulted in an error record
        # (process_file returns a list with a single error record on failure)
        if len(file_records) == 1 and "error" in file_records[0].get("metadata", {}):
             error_info = file_records[0]["metadata"]["error"]
             # Use enhanced structured logging for better error reporting
             from app.utils.logging import log_exception
             logger.error(
                 f"Processing function failed for job {job_id}: {error_info}",
                 extra={
                     "structured_data": {
                         "job_id": job_id,
                         "error_info": error_info,
                         "file_path": str(file_path),
                         "process_params": params.dict(),
                         "error_record": file_records[0]
                     }
                 }
             )
             # Raise a more specific exception for better error handling
             try:
                 raise ValueError(f"Processing failed: {error_info}")
             except ValueError:
                 log_exception(
                     logger,
                     job_id=job_id,
                     context={
                         "file_path": str(file_path),
                         "model_provider": params.model_provider,
                         "model": params.model,
                         "processing_type": params.processing_type
                     }
                 )
                 raise  # Re-raise to trigger error handling

        # If processing successful, send saving status
        await manager.broadcast({"job_id": job_id, "type": "job_update", "status": "Saving results...", "progress": 95})

        # Save results 
        save_results(file_records, str(output_path_obj), format=params.output_format)
        record_count = len(file_records)
        final_output_path = str(output_path_obj) # Get final path after potential extension change

        # --- Job Completion --- 
        job_duration = time.time() - start_job_time
        if job_id in active_jobs:
            active_jobs[job_id].update({
                "completed": True,
                "status": "completed",
                "completed_at": time.time(),
                "duration_seconds": round(job_duration, 2),
                "record_count": record_count,
                "output_file": final_output_path,
                "progress": 100
            })

        # Final progress broadcast
        await manager.broadcast({
            "job_id": job_id,
            "type": "job_update",
            "status": "completed",
            "progress": 100,
            "record_count": record_count,
            "output_file": final_output_path 
        })

        logger.info(f"Job {job_id} completed in {job_duration:.2f}s with {record_count} records. Output: {final_output_path}")

    except Exception as e:
        # --- Job Error Handling --- 
        job_duration = time.time() - start_job_time
        error_message = f"{type(e).__name__}: {e}"
        full_error = f"Error in background job {job_id} after {job_duration:.2f}s: {error_message}"
        logger.error(full_error, exc_info=True)

        if job_id in active_jobs:
            active_jobs[job_id].update({
                "status": "error",
                "error": error_message,
                "completed": False,
                "completed_at": time.time(),
                "duration_seconds": round(job_duration, 2),
                "progress": 100 # Show 100% progress even on error?
            })

        # Error broadcast
        await manager.broadcast({
            "job_id": job_id,
            "type": "job_update",
            "status": "error",
            "progress": 100,
            "error": error_message
        })

async def process_audio_dataset_background(
    job_id: str,
    file_path: Path,
    params: AudioProcessRequest,
    app_state: Any # Receive app state
):
    """
    Background task for the audio/video dataset pipeline.
    Orchestrates ffmpeg, Whisper, segmentation, cutting, JSON creation, zipping.
    """
    job_output_dir = OUTPUT_DIR / job_id
    # Final output will be a zip file
    zip_filename = f"audio_dataset_{job_id}.zip"
    zip_output_path = job_output_dir / zip_filename
    start_job_time = time.time()

    try:
        logger.info(f"Starting audio dataset job {job_id} for {file_path.name}")
        active_jobs = app_state.active_jobs # Get active jobs from state
        if job_id in active_jobs:
            active_jobs[job_id]["status"] = "processing"
        await manager.broadcast({"job_id": job_id, "type": "job_update", "status": "Starting Pipeline...", "progress": 2})

        # --- Call the core processing logic --- 
        # This function will handle all steps: ffmpeg, whisper, segmentation, cutting, json, zip
        # It should internally send progress updates if possible, or we add them here.
        final_zip_path = await create_audio_text_dataset(
            job_id=job_id,
            input_file_path=file_path,
            output_dir=job_output_dir,
            language=params.language,
            websocket_manager=manager # Pass the manager for progress updates
        )

        # Check if the function returned the expected path (it creates the zip itself)
        if not Path(final_zip_path).is_file():
             raise Exception(f"Processing function did not generate the expected output file: {final_zip_path}")

        # --- Job Completion --- 
        job_duration = time.time() - start_job_time
        if job_id in active_jobs:
            active_jobs[job_id].update({
                "completed": True,
                "status": "completed",
                "completed_at": time.time(),
                "duration_seconds": round(job_duration, 2),
                "output_file": str(final_zip_path),
                "progress": 100
                # Add other relevant metadata? e.g., number of segments
            })

        await manager.broadcast({
            "job_id": job_id,
            "type": "job_update",
            "status": "completed",
            "progress": 100,
            "output_file": str(final_zip_path)
        })
        logger.info(f"Audio dataset job {job_id} completed in {job_duration:.2f}s. Output: {final_zip_path}")

    except Exception as e:
        # --- Job Error Handling --- 
        job_duration = time.time() - start_job_time
        error_message = f"{type(e).__name__}: {e}"
        full_error = f"Error in audio dataset job {job_id} after {job_duration:.2f}s: {error_message}"
        logger.error(full_error, exc_info=True)

        if job_id in active_jobs:
            active_jobs[job_id].update({
                "status": "error",
                "error": error_message,
                "completed": False,
                "completed_at": time.time(),
                "duration_seconds": round(job_duration, 2),
                "progress": 100 
            })

        await manager.broadcast({
            "job_id": job_id,
            "type": "job_update",
            "status": "error",
            "progress": 100,
            "error": error_message
        })

@app.get("/api/status")
async def get_all_jobs_status_api(request: Request):
    """
    Get status overview of all jobs from app state.

    Returns:
        JSON response with a list of job information.
    """
    # Return a summary, not necessarily the full detail of every job for performance
    active_jobs = request.app.state.active_jobs
    job_list = [{
        'job_id': jid,
        'name': job.get('name', f'Job {jid[:8]}'),
        'status': job.get('status'),
        'progress': job.get('progress'),
        'started_at': job.get('started_at'),
        'completed': job.get('completed'),
        'error': job.get('error')
        } for jid, job in active_jobs.items()]
    return JSONResponse(content=sorted(job_list, key=lambda x: x.get('started_at', 0), reverse=True))

@app.get("/api/status/{job_id}")
async def get_job_status_api(job_id: str, request: Request):
    """
    Get detailed status information about a specific job from app state.

    Args:
        job_id: Job identifier.

    Returns:
        JSON response with detailed job information.
    """
    active_jobs = request.app.state.active_jobs
    if job_id in active_jobs:
        return JSONResponse(content=active_jobs[job_id])
    else:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

@app.get("/api/results/{job_id}")
async def download_job_results_api(job_id: str, request: Request):
    """
    Download job results file.

    Args:
        job_id: Job identifier.

    Returns:
        File response with job results.
    """
    active_jobs = request.app.state.active_jobs
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = active_jobs[job_id]

    if not job.get("completed", False) or job.get("status") != "completed":
        raise HTTPException(status_code=404, detail=f"Job {job_id} is not completed successfully.")

    output_file_path_str = job.get("output_file")
    if not output_file_path_str:
        raise HTTPException(status_code=404, detail=f"Output file path not found for job {job_id}")

    output_file_path = Path(output_file_path_str)
    if not output_file_path.is_file():
        logger.error(f"Output file missing for job {job_id}: {output_file_path}")
        raise HTTPException(status_code=500, detail=f"Output file missing for job {job_id}")

    # Determine media type based on extension or parameters
    media_type = "application/json" # Default
    if output_file_path.suffix.lower() == '.jsonl':
        media_type = "application/jsonl"
    elif output_file_path.suffix.lower() == '.zip':
        media_type = "application/zip"
    # Add more types if needed

    return FileResponse(
        path=output_file_path,
        media_type=media_type,
        filename=output_file_path.name # Use the actual output filename
    )

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """
    WebSocket connection for real-time progress updates.
    
    Args:
        websocket: WebSocket connection
        client_id: Client identifier
    """
    await manager.connect(websocket, client_id)
    logger.info(f"WebSocket client connected: {client_id}")
    try:
        while True:
            # Keep connection alive, maybe handle client messages if needed
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message from {client_id}: {data}")
            # Example echo or command handling could go here
            # await manager.send_progress(client_id, {"message": f"Echo: {data}"})
            await asyncio.sleep(1) # Prevent busy-waiting
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: {client_id}")
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}", exc_info=True)
        manager.disconnect(client_id)

@app.post("/api/suggest-params", response_model=SuggestParamsResponse)
async def suggest_parameters_api(request: Request, suggest_request: SuggestParamsRequest):
    """
    Analyzes the content of an uploaded file and suggests keywords and a system prompt.

    Args:
        request: Request body containing file_id.

    Returns:
        JSON response with suggested_keywords and suggested_system_prompt.
    """
    logger.info(f"Received suggestion request for file_id: {suggest_request.file_id}")
    file_path = UPLOAD_DIR / suggest_request.file_id
    available_models = request.app.state.available_models # Get models from state

    if not file_path.is_file():
        logger.error(f"File not found for suggestion: {suggest_request.file_id}")
        raise HTTPException(status_code=404, detail=f"File {suggest_request.file_id} not found.")

    try:
        # Read file content (or a preview)
        with file_path.open('r', encoding='utf-8') as f:
            content_preview = f.read(suggest_request.max_preview_chars)
            if len(content_preview) == suggest_request.max_preview_chars:
                 content_preview += "... [truncated]" # Indicate truncation

        if not content_preview.strip():
             logger.warning(f"File {suggest_request.file_id} appears empty or unreadable for suggestions.")
             return SuggestParamsResponse() # Return empty suggestions

        # Pass the already available models dict to helper functions
        provider = get_default_provider(available_models) 
        model = get_default_model(provider, available_models)
        
        if not provider or not model:
            logger.error("Default provider/model not found for generating suggestions.")
            raise HTTPException(status_code=503, detail="AI suggestion service unavailable.")

        client = get_llm_client(provider)

        # Define the prompt for the LLM
        suggestion_system_prompt = (
            "You are an AI assistant specialized in analyzing document content. "
            "Your task is to suggest relevant keywords and a concise system prompt "
            "that could be used to instruct another AI for further processing (like summarization or data extraction) of this document. "
            "Analyze the provided text preview."
        )
        suggestion_user_prompt = (
            f"Based on the following document preview, please suggest 5-10 relevant keywords and a concise system prompt (max 2 sentences). "
            f"Respond ONLY with a valid JSON object containing two keys: 'suggested_keywords' (a list of strings) and 'suggested_system_prompt' (a string).\n\n"
            f"Document Preview:\n---\n{content_preview}\n---\""
        )

        messages = [
            {"role": "system", "content": suggestion_system_prompt},
            {"role": "user", "content": suggestion_user_prompt}
        ]

        logger.info(f"Requesting suggestions from {provider}/{model} for {suggest_request.file_id}")
        # Use a lower temperature for more deterministic suggestions
        llm_response_str = await client.generate(
            messages=messages,
            model=model,
            temperature=0.3, 
            max_tokens=300 # Enough for keywords and a short prompt
        )

        # Parse the LLM response (expected JSON)
        try:
            # Clean potential markdown code fences
            cleaned_response = re.sub(r'^```json\s*|\s*```$', '', llm_response_str, flags=re.MULTILINE).strip()
            suggestions = json.loads(cleaned_response)
            
            keywords = suggestions.get('suggested_keywords', [])
            system_prompt = suggestions.get('suggested_system_prompt', '')
            
            # Basic validation
            if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
                keywords = []
                logger.warning(f"LLM suggestion for keywords was not a list of strings for {suggest_request.file_id}")
            if not isinstance(system_prompt, str):
                system_prompt = ""
                logger.warning(f"LLM suggestion for system_prompt was not a string for {suggest_request.file_id}")

            logger.info(f"Successfully generated suggestions for {suggest_request.file_id}")
            return SuggestParamsResponse(suggested_keywords=keywords, suggested_system_prompt=system_prompt)
        
        except (json.JSONDecodeError, Exception) as parse_error:
            logger.error(f"Failed to parse suggestion JSON from LLM for {suggest_request.file_id}: {parse_error}. Response: {llm_response_str}")
            # Return empty suggestions on parsing failure
            return SuggestParamsResponse()

    except Exception as e:
        logger.error(f"Error generating suggestions for {suggest_request.file_id}: {e}", exc_info=True)
        # Don't crash the whole request, just return empty suggestions
        # raise HTTPException(status_code=500, detail="Failed to generate suggestions.")
        return SuggestParamsResponse()

if __name__ == "__main__":
    import uvicorn
    # Use reload=True for development to automatically reload on code changes
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, reload_dirs=[str(APP_DIR.parent)]) # Reload on changes in backend/