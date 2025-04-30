"""
Logging utilities for AnyDataset.

Enhanced with structured logging, rotation, and better error tracking.
"""

import logging
import logging.handlers
import os
import sys
import traceback
import json
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

# Env variables for configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_MAX_SIZE = int(os.getenv("LOG_MAX_SIZE", 10 * 1024 * 1024))  # 10 MB by default
LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", 5))  # Keep 5 backup logs
ENABLE_JSON_LOGGING = os.getenv("ENABLE_JSON_LOGGING", "false").lower() == "true"

# Global logger registry to avoid duplicate handlers
logger_registry = {}

class StructuredLogRecord(logging.LogRecord):
    """Extended LogRecord with structured data support"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.structured_data = {}
        
    def set_structured_data(self, data: Dict[str, Any]) -> None:
        """Add structured data to the log record"""
        self.structured_data = data


class StructuredLogger(logging.Logger):
    """Logger that supports structured data logging"""
    
    def makeRecord(self, name, level, fn, lno, msg, args, exc_info, func=None, extra=None, sinfo=None):
        """Create a LogRecord with support for structured data"""
        record = StructuredLogRecord(name, level, fn, lno, msg, args, exc_info, func, sinfo)
        if extra:
            for key, value in extra.items():
                if key == "structured_data" and isinstance(value, dict):
                    record.set_structured_data(value)
                else:
                    setattr(record, key, value)
        return record
    
    def structured(self, level, msg, structured_data=None, *args, **kwargs):
        """Log a message with structured data"""
        if structured_data is None:
            structured_data = {}
            
        extra = kwargs.get("extra", {})
        extra["structured_data"] = structured_data
        kwargs["extra"] = extra
        
        if level == "DEBUG":
            self.debug(msg, *args, **kwargs)
        elif level == "INFO":
            self.info(msg, *args, **kwargs)
        elif level == "WARNING":
            self.warning(msg, *args, **kwargs)
        elif level == "ERROR":
            self.error(msg, *args, **kwargs)
        elif level == "CRITICAL":
            self.critical(msg, *args, **kwargs)
        else:
            self.info(msg, *args, **kwargs)


class JSONFormatter(logging.Formatter):
    """
    Formatter that outputs JSON strings after parsing the log record.
    
    Example:
        {"timestamp": "2023-01-01T12:00:00Z", "level": "INFO", "message": "Log message"}
    """
    
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": traceback.format_exception(*record.exc_info)
            }
            
        # Add structured data if present
        if hasattr(record, "structured_data") and record.structured_data:
            log_data.update(record.structured_data)
            
        # Add other record attributes
        log_data["module"] = record.module
        log_data["funcName"] = record.funcName
        log_data["lineno"] = record.lineno
        log_data["pathname"] = record.pathname
        
        return json.dumps(log_data)


def setup_logging(log_level=None, logger_name="anydataset") -> logging.Logger:
    """
    Sets up logging with a consistent format and rotation.
    
    Args:
        log_level: Log level to use. If None, uses LOG_LEVEL from env.
        logger_name: Logger name
        
    Returns:
        Logger instance
    """
    # Check if logger already exists in registry to avoid duplicate handlers
    if logger_name in logger_registry:
        return logger_registry[logger_name]
    
    # Register logger class for structured logging
    if log_level is None:
        log_level = LOG_LEVEL
    
    # Create app logs directory
    app_dir = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    logs_dir = app_dir / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO
    
    # Create logger
    logger = logging.getLogger(logger_name)
    
    # Configure level
    logger.setLevel(numeric_level)
    
    # Remove any existing handlers to avoid duplicates
    if logger.hasHandlers():
        logger.handlers.clear()
    
    # Create rotating file handler
    log_file_path = logs_dir / f"{logger_name}.log"
    file_handler = logging.handlers.RotatingFileHandler(
        log_file_path, 
        maxBytes=LOG_MAX_SIZE, 
        backupCount=LOG_BACKUP_COUNT
    )
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    
    # Create formatters
    if ENABLE_JSON_LOGGING:
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(module)s:%(lineno)d] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    # Set formatters for handlers
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    # Add handlers to logger
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # Add logger to registry
    logger_registry[logger_name] = logger
    
    return logger


def log_exception(logger, exc_info=None, job_id=None, context=None):
    """
    Enhanced exception logging with structured data and context.
    
    Args:
        logger: Logger instance
        exc_info: Exception info tuple (if None, uses sys.exc_info())
        job_id: Optional job ID for context
        context: Optional additional context dict
    """
    if exc_info is None:
        exc_info = sys.exc_info()
        
    if exc_info[0] is None:
        return  # No exception to log
        
    exc_type, exc_value, exc_tb = exc_info
    
    # Format traceback and extract useful info
    tb_formatted = traceback.format_exception(exc_type, exc_value, exc_tb)
    tb_summary = []
    
    for frame in traceback.extract_tb(exc_tb):
        tb_summary.append({
            "filename": frame.filename,
            "line": frame.lineno,
            "function": frame.name,
            "code": frame.line
        })
    
    structured_data = {
        "exception_type": exc_type.__name__,
        "exception_message": str(exc_value),
        "exception_module": getattr(exc_type, "__module__", "unknown"),
        "stack_trace_summary": tb_summary,
        "stack_trace_full": tb_formatted
    }
    
    if job_id:
        structured_data["job_id"] = job_id
        
    if context:
        structured_data["context"] = context
    
    # Standard error logging with full traceback
    logger.error(
        f"Exception: {exc_type.__name__}: {exc_value}",
        exc_info=True,
        extra={"structured_data": structured_data}
    )