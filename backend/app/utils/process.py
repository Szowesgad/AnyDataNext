"""
File processing utilities for AnyDataset.
"""

import os
import json
import time
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from .client import get_llm_client
from .logging import setup_logging
from .models import get_default_provider, get_default_model

logger = setup_logging()

async def process_file(
    file_path: str,
    model_provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = 4000,
    system_prompt: Optional[str] = None,
    keywords: Optional[List[str]] = None,
    add_reasoning: bool = False,
    processing_type: str = "standard",
    language: str = "pl",
    start_time: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Process a file using LLM-based document processing.
    Handles different processing types based on `processing_type`.

    Args:
        file_path: Path to the file to process.
        model_provider: The model provider to use.
        model: The specific model to use.
        temperature: Temperature setting for model generation.
        max_tokens: Max tokens for the LLM response.
        system_prompt: Custom system prompt to use (overrides default).
        keywords: Optional list of keywords to guide processing.
        add_reasoning: Whether to ask the model to add a reasoning field.
        processing_type: Type of processing ('standard', 'article', 'translate').
        language: Target language for processing ('pl', 'en', etc.).
        start_time: Start time for metrics.

    Returns:
        List of generated records in the standard format.
    """
    if not start_time:
        start_time = time.time()
        
    if not model_provider:
        model_provider = get_default_provider()
    
    if not model:
        model = get_default_model(model_provider)
        
    logger.info(f"Processing file: {file_path} with type '{processing_type}' using {model_provider}/{model}, temp={temperature}")
    
    # --- Determine Base System Prompt --- 
    if not system_prompt: # Use default only if no specific one provided
        if language == "pl":
            base_system_prompt = (
                "Jesteś ekspertem AI tworzącym wysokiej jakości zbiory danych treningowych. "
                "Twoim celem jest przetworzenie dostarczonego dokumentu. "
                "Odpowiedzi MUSZĄ być w języku polskim."
            )
        else:
            base_system_prompt = (
                "You are an expert AI assistant that generates high-quality training datasets. "
                "Your goal is to process the provided document. "
                "Responses MUST be in English unless specified otherwise."
            )
    else:
        base_system_prompt = system_prompt # Use provided system prompt

    # --- Logic based on processing_type --- 
    # TODO: Implement proper routing to different processing functions/logics
    # For now, modify the existing logic (standard) based on new params
    if processing_type == "standard":
        # --- FIX: Construct the detailed instructions step-by-step ---
        
        # Part 1: Base Instructions
        instructions_part1 = (
            "Generuj zestawy instrukcja-pytanie-odpowiedź na podstawie treści dokumentu. "
            "Każda instrukcja powinna być jasna i skoncentrowana, a odpowiedzi powinny być wyczerpujące i dokładne. "
            "1. Przeanalizuj całą treść pliku, aby zrozumieć jego strukturę, temat i powiązania. "
            "2. Sam zdecyduj o odpowiedniej liczbie rekordów (mniej dla krótkich, więcej dla długich). "
            "3. Dla każdego rekordu utwórz: "
            "   a) Instrukcję (bardzo szczegółowy kontekst z dokumentu, zachowaj powiązania). "
            "   b) Pytanie (dotyczące pojęć, definicji, metod). "
            "   c) Odpowiedź (wyczerpująca, uwzględniająca kontekst). "
        )
        instructions_part1_en = (
            "Generate instruction-prompt-completion trios based on the document content. "
            "Each instruction should be clear and focused, and completions comprehensive and accurate. "
            "1. Analyze the entire content (structure, topic, relationships). "
            "2. Decide the appropriate number of records (fewer for short, more for long). "
            "3. For each record create: "
            "   a) Instruction (VERY DETAILED context from the doc, preserve relationships). "
            "   b) Prompt (relevant question about concepts, definitions, methods). "
            "   c) Completion (comprehensive answer considering context). "
        )

        # Part 2: Conditional Reasoning part
        reasoning_part = "   d) Uzasadnienie (wyjaśnienie poprawności odpowiedzi w danym kontekście). " if add_reasoning else ""
        reasoning_part_en = "   d) Reasoning (explanation why the completion is correct given the instruction). " if add_reasoning else ""
        
        # Part 3: Keyword Extraction part
        keyword_extraction_part = "   e) Wyodrębnij słowa kluczowe i encje. "
        keyword_extraction_part_en = "   e) Extract relevant keywords and entities. "

        # Part 4: Conditional Keyword Attention part
        keyword_attention_part = f"\nZwróć szczególną uwagę na następujące słowa kluczowe: {', '.join(keywords)}." if keywords else ""
        keyword_attention_part_en = f"\nPay special attention to the following keywords: {', '.join(keywords)}." if keywords else ""
        
        # Part 5: Importance and JSON Structure part
        json_reasoning_example = "'reasoning': '...', " if add_reasoning else ""
        importance_json_part = (
            "WAŻNE: Nie dziel krótkich dokumentów. Grupuj powiązane informacje. "
            "Zwróć odpowiedź jako PRAWIDŁOWĄ tablicę JSON obiektów (bez dodatkowych wyjaśnień) o strukturze: "
            f"[{{ 'instruction': '...', 'prompt': '...', 'completion': '...', {json_reasoning_example}'metadata': {{ 'source_file': '...', 'chunk_index': n, 'total_chunks': m, 'model_used': '...', 'processing_time': '...', 'confidence_score': 0.xx, 'keywords': [...], 'extracted_entities': [...] }} }}]."
        )
        importance_json_part_en = (
            "IMPORTANT: Do not divide short documents. Group related info. "
            "Return response as a VALID JSON array of objects (no extra explanations) with structure: "
            f"[{{ 'instruction': '...', 'prompt': '...', 'completion': '...', {json_reasoning_example}'metadata': {{ 'source_file': '...', 'chunk_index': n, 'total_chunks': m, 'model_used': '...', 'processing_time': '...', 'confidence_score': 0.xx, 'keywords': [...], 'extracted_entities': [...] }} }}]."
        )

        # Combine all parts based on language
        if language == "pl":
            detailed_instructions = (
                instructions_part1 +
                reasoning_part +
                keyword_extraction_part +
                keyword_attention_part + "\n" +
                importance_json_part
            )
        else: # English
            detailed_instructions = (
                instructions_part1_en +
                reasoning_part_en +
                keyword_extraction_part_en +
                keyword_attention_part_en + "\n" +
                importance_json_part_en
            )
        
        final_system_prompt = f"{base_system_prompt}\n\n{detailed_instructions}"

    elif processing_type == 'article':
        # Placeholder: Implement logic for article processing
        logger.warning(f"Processing type '{processing_type}' not fully implemented, using standard logic as fallback.")
        # Fallback to standard logic for now
        # TODO: Call or implement article-specific logic from scripts/articles.py idea
        final_system_prompt = f"{base_system_prompt}\n\nDetailed instructions for article processing would go here."
        # Need to adapt the expected JSON structure as well
        pass 
    elif processing_type == 'translate':
        # Placeholder: Implement logic for translation
        logger.warning(f"Processing type '{processing_type}' not fully implemented, using standard logic as fallback.")
        # Fallback to standard logic for now
        # TODO: Call or implement translation-specific logic from scripts/translate.py idea
        final_system_prompt = f"{base_system_prompt}\n\nDetailed instructions for translation processing would go here."
        # Need to adapt the expected JSON structure as well
        pass
    else:
        logger.error(f"Unknown processing type: {processing_type}")
        raise ValueError(f"Unsupported processing type: {processing_type}")

    # --- Common Processing Logic --- 
    try:
        # Read the file content
        # Use Path object for consistency
        file_path_obj = Path(file_path)
        basename = file_path_obj.name
        extension = file_path_obj.suffix.lower()

        try:
            # Check for binary file types first
            extension = file_path_obj.suffix.lower()
            if extension == '.pdf':
                # For PDF files, delegate to the appropriate parser
                from .parsers import parse_pdf
                records = parse_pdf(str(file_path_obj), logger)
                return records
            elif extension in ['.wav', '.mp3', '.ogg', '.m4a', '.flac']:
                # For audio files, we'll need special handling
                logger.info(f"Detected audio file ({extension}). Delegating to multimedia processor.")
                from .multimedia_processor import create_audio_text_dataset
                # This would typically be handled differently - for now, return an informative message
                return [{
                    "instruction": f"Process audio file {basename}",
                    "prompt": "Please use the audio processing endpoint for audio files.",
                    "completion": f"This is an audio file ({extension}) and should be processed with the dedicated audio processing API endpoint.",
                    "metadata": {
                        "source_file": basename,
                        "file_type": "audio",
                        "extension": extension,
                        "error": "Standard text processing not suitable for audio files"
                    }
                }]
            elif extension == '.docx':
                # For DOCX files, delegate to the appropriate parser
                from .parsers import parse_docx
                records = parse_docx(str(file_path_obj), logger)
                return records
            else:
                # Text-based files can be opened with UTF-8 encoding
                with file_path_obj.open('r', encoding='utf-8') as f:
                    content = f.read()
        except Exception as read_error:
             logger.error(f"Failed to read file {file_path}: {read_error}")
             raise # Re-raise to be caught by the outer try-except

        # Initialize the client
        client = get_llm_client(model_provider)

        # Create the message for the LLM - WITHOUT including system as a role
        messages = [
            # System prompt goes as a parameter, not as a message with role="system"
            {"role": "user", "content": f"Document content ({extension} format):\n\n{content}"}
        ]

        # Call the LLM
        try:
            response = await client.generate(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens or 4000, # Use provided max_tokens or default
                system=final_system_prompt
            )
            
            # Jeśli nie ma odpowiedzi (None), obsłuż błąd
            if response is None:
                logger.error(f"LLM returned None response for {file_path}")
                return [{
                    "instruction": f"Analiza dokumentu {basename}",
                    "prompt": "Nie udało się przetworzyć dokumentu.",
                    "completion": "API nie zwróciło odpowiedzi. Sprawdź logi błędów.",
                    "metadata": {
                        "source_file": basename,
                        "model_used": model,
                        "processing_time": f"{time.time() - start_time:.2f}s",
                        "confidence_score": 0.1,
                        "error": "API returned None response",
                        "keywords": [],
                        "extracted_entities": []
                    }
                }]
        except Exception as e:
            logger.error(f"Error calling LLM API: {e}")
            return [{
                "instruction": f"Analiza dokumentu {basename}",
                "prompt": "Wystąpił błąd podczas przetwarzania.",
                "completion": f"Błąd API: {str(e)}",
                "metadata": {
                    "source_file": basename,
                    "model_used": model,
                    "processing_time": f"{time.time() - start_time:.2f}s",
                    "confidence_score": 0.1,
                    "error": f"API Exception: {str(e)}",
                    "keywords": [],
                    "extracted_entities": []
                }
            }]

        # Parse the response with enhanced resilience (addressing HOTFIX point 2)
        try:
            # First, attempt to parse the entire response as JSON directly
            # This works when the model returns clean JSON without text wrappers
            try:
                direct_parse = json.loads(response)
                if isinstance(direct_parse, list):
                    logger.info(f"Successfully parsed direct JSON response for {basename}")
                    records = direct_parse
                else:
                    # If it parsed but isn't a list, it might be a JSON object with a data field
                    logger.debug(f"Response parsed as JSON but not a list. Looking for data field.")
                    if isinstance(direct_parse, dict) and 'data' in direct_parse and isinstance(direct_parse['data'], list):
                        logger.info(f"Found data field in JSON response object for {basename}")
                        records = direct_parse['data']
                    else:
                        # Will try other methods below
                        raise ValueError("Direct JSON parse succeeded but result is not a list or data object")
            except json.JSONDecodeError:
                # If direct parse fails, try to extract JSON array from text
                logger.debug(f"Direct JSON parse failed, attempting to extract JSON array from text")
                
                # Attempt to find and parse the JSON array with smarter boundary detection
                json_start = response.find('[')
                # Look for balanced closing bracket by counting open/close brackets
                if json_start != -1:
                    open_count = 1
                    for i in range(json_start + 1, len(response)):
                        if response[i] == '[':
                            open_count += 1
                        elif response[i] == ']':
                            open_count -= 1
                            if open_count == 0:
                                json_end = i + 1
                                break
                else:
                    json_end = 0  # No starting bracket found
                
                if json_start == -1 or json_end == 0:
                    logger.warning(f"No JSON array found in LLM response for {basename}. Attempting alternative formats.")
                    
                    # Try to find JSON objects - maybe it's a sequence of JSON objects without array brackets
                    # This handles newline-delimited JSON format (JSONL)
                    jsonl_pattern = r'\{(?:[^{}]|"(?:\\.|[^"\\])*"|\{(?:[^{}]|"(?:\\.|[^"\\])*")*\})*\}'
                    import re
                    jsonl_matches = re.finditer(jsonl_pattern, response)
                    jsonl_objects = []
                    
                    for match in jsonl_matches:
                        try:
                            obj = json.loads(match.group(0))
                            jsonl_objects.append(obj)
                        except:
                            pass
                    
                    if jsonl_objects:
                        logger.info(f"Parsed {len(jsonl_objects)} JSONL objects from response for {basename}")
                        records = jsonl_objects
                    else:
                        # Last resort - try to create a very basic structured output from unstructured text
                        logger.error(f"Failed to parse response as JSON or JSONL. Creating basic fallback record.")
                        fallback_record = {
                            "instruction": f"Analyze content of {basename} (fallback parsing)",
                            "prompt": "What information can be extracted from this document?",
                            "completion": response[:2000] + ("..." if len(response) > 2000 else ""),
                            "metadata": {
                                "source_file": basename,
                                "parser_fallback": True,
                                "model_used": model,
                                "processing_time": f"{time.time() - start_time:.2f}s",
                                "confidence_score": 0.4,
                                "error": "Failed to parse as JSON or JSONL",
                                "keywords": []
                            }
                        }
                        return [fallback_record]
                else:
                    # Standard JSON array extraction logic
                    json_str = response[json_start:json_end]
                    records = json.loads(json_str)
            
            # Validate the parsed records
            if not isinstance(records, list):
                logger.error(f"Parsed JSON is not a list for {basename}. Type: {type(records)}")
                raise ValueError("Parsed JSON is not a list")
            
            # Add/update processing time and ensure all metadata is present
            processing_time = time.time() - start_time
            record_count = len(records)

            for i, record in enumerate(records):
                if not isinstance(record, dict): # Basic validation
                    logger.warning(f"Skipping invalid record (not a dict) at index {i} for {basename}")
                    continue 
                
                if "metadata" not in record or not isinstance(record["metadata"], dict):
                    record["metadata"] = {}

                # Overwrite or set essential metadata
                record["metadata"] = {
                    # Preserve existing fields if needed, but ensure these are set
                    **record.get("metadata", {}), # Keep existing metadata first
                    "source_file": basename,
                    "model_used": model,
                    "processing_time": f"{processing_time:.2f}s",
                    "chunk_index": record.get("metadata", {}).get("chunk_index", i), # Use model's if provided
                    "total_chunks": record.get("metadata", {}).get("total_chunks", record_count), # Use model's if provided
                    "confidence_score": record.get("metadata", {}).get("confidence_score", 0.95), # Default confidence
                    # Keep existing keywords/entities if they exist, otherwise init empty
                    "keywords": record.get("metadata", {}).get("keywords", []), 
                    "extracted_entities": record.get("metadata", {}).get("extracted_entities", [])
                }

            logger.info(f"Successfully processed {file_path}, generated {record_count} records")
            return records

        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Failed to parse LLM response for {basename}: {e}")
            logger.debug(f"Raw response snippet: {response[:1000]}...")

            # Create a basic fallback record on parsing error
            fallback_record = {
                "instruction": f"Analyze the content of {basename}",
                "prompt": f"What are the key points in this {extension[1:]} document? Failed to parse AI output.",
                "completion": f"Error processing document. Failed to parse AI response: {e}",
                "metadata": {
                    "source_file": basename,
                    "model_used": model,
                    "processing_time": f"{time.time() - start_time:.2f}s",
                    "confidence_score": 0.3, # Low confidence due to parsing error
                    "error": f"JSON Parsing Error: {e}",
                    "raw_response_snippet": response[:500] # Include snippet for debugging
                }
            }
            if add_reasoning:
                fallback_record['reasoning'] = "AI response could not be parsed."
            return [fallback_record]

    except Exception as e:
        error_message = f"Error processing file {file_path}: {type(e).__name__}: {e}"
        logger.error(error_message, exc_info=True)
        # Create a fallback record for general processing errors
        return [{
            "instruction": f"Review the {extension[1:]} file: {basename}",
            "prompt": f"An error occurred while trying to process this file.",
            "completion": f"Processing failed: {error_message}",
            "metadata": {
                "source_file": basename,
                "error": error_message,
                "model_used": model,
                "processing_time": f"{time.time() - start_time:.2f}s",
                "confidence_score": 0.1, # Very low confidence
                "keywords": [],
                "extracted_entities": []
            }
        }]

async def process_files(
    file_paths: List[str],
    model_provider: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = 4000,
    system_prompt: Optional[str] = None,
    keywords: Optional[List[str]] = None,
    add_reasoning: bool = False,
    processing_type: str = "standard",
    language: str = "pl",
    concurrent_limit: int = 3, # Default concurrency limit
    batch_size: int = 5,  # Default batch size for rate limiting
    batch_delay: float = 0.5  # Default delay between batches in seconds
) -> List[Dict[str, Any]]:
    """
    Process multiple files concurrently with advanced rate limiting and error handling.

    Args:
        file_paths: List of paths to files to process.
        model_provider: The model provider to use.
        model: The specific model to use.
        temperature: Temperature setting for model generation.
        max_tokens: Max tokens for the LLM response.
        system_prompt: Custom system prompt to use.
        keywords: Optional list of keywords.
        add_reasoning: Whether to add reasoning.
        processing_type: Type of processing.
        language: Target language.
        concurrent_limit: Maximum number of concurrent processing tasks.
        batch_size: Number of files to process per batch for rate limiting.
        batch_delay: Delay between batches in seconds.

    Returns:
        List of all generated records from all processed files.
    """
    from .logging import log_exception
    
    start_time = time.time()
    logger.info(f"Starting batch processing of {len(file_paths)} files with concurrency {concurrent_limit}")
    
    # Store statistics for reporting
    stats = {
        "total_files": len(file_paths),
        "successful_files": 0,
        "failed_files": 0,
        "api_errors": 0,
        "total_records": 0,
        "start_time": start_time,
        "provider": model_provider,
        "model": model
    }

    # Determine optimal batch size based on API rate limits for provider
    # Default conservative limits by provider
    rate_limits = {
        "openai": {"requests_per_min": 60, "tokens_per_min": 90000},
        "anthropic": {"requests_per_min": 50, "tokens_per_min": 100000},
        "mistral": {"requests_per_min": 40, "tokens_per_min": 80000},
        "deepseek": {"requests_per_min": 20, "tokens_per_min": 50000},
        "libraxis": {"requests_per_min": 100, "tokens_per_min": 120000},
        "local": {"requests_per_min": 200, "tokens_per_min": 500000}
    }
    
    # Get rate limits for the provider
    provider_key = model_provider.lower() if model_provider else "openai"
    provider_limits = rate_limits.get(provider_key, {"requests_per_min": 30, "tokens_per_min": 50000})
    
    # Adjust concurrent_limit based on API limits if needed
    max_requests_per_min = provider_limits["requests_per_min"]
    adjusted_concurrent_limit = min(concurrent_limit, max(1, max_requests_per_min // 10))
    if adjusted_concurrent_limit < concurrent_limit:
        logger.warning(f"Adjusted concurrent_limit from {concurrent_limit} to {adjusted_concurrent_limit} based on provider limits")
        concurrent_limit = adjusted_concurrent_limit
    
    # Create semaphore for concurrency control
    semaphore = asyncio.Semaphore(concurrent_limit)
    
    # Process files with retry logic, rate limiting and advanced error handling
    async def process_with_semaphore(file_path, retries=3):
        retry_count = 0
        backoff_factor = 1.5  # Exponential backoff multiplier
        
        while retry_count <= retries:
            try:
                async with semaphore:
                    # Add jitter to prevent thundering herd problem
                    await asyncio.sleep(0.1 * random.random())
                    
                    logger.info(f"Processing file: {os.path.basename(file_path)} (attempt {retry_count + 1}/{retries + 1})")
                    
                    # Ensure all necessary parameters are passed down
                    result = await process_file(
                        file_path=file_path,
                        model_provider=model_provider,
                        model=model,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        system_prompt=system_prompt,
                        keywords=keywords,
                        add_reasoning=add_reasoning,
                        processing_type=processing_type,
                        language=language,
                        start_time=time.time()  # Use fresh start time for each file
                    )
                    
                    # Success case - log and return results
                    logger.info(f"Successfully processed {os.path.basename(file_path)}: {len(result)} records")
                    return result
                    
            except Exception as e:
                retry_count += 1
                
                # Check if exception indicates a rate limit
                is_rate_limit = False
                if hasattr(e, "__module__") and "openai" in getattr(e, "__module__", ""):
                    is_rate_limit = "rate" in str(e).lower() and "limit" in str(e).lower()
                elif "rate limit" in str(e).lower() or "too many requests" in str(e).lower():
                    is_rate_limit = True
                
                # Handle based on error type and retry count
                if is_rate_limit and retry_count <= retries:
                    # Calculate backoff with jitter for rate limits
                    wait_time = (backoff_factor ** retry_count) * 2 + random.uniform(0, 1)
                    logger.warning(f"Rate limit hit processing {os.path.basename(file_path)}. Retrying in {wait_time:.2f}s ({retry_count}/{retries})")
                    await asyncio.sleep(wait_time)
                    continue
                elif retry_count <= retries:
                    # Other errors - log and retry with shorter backoff
                    wait_time = (backoff_factor ** retry_count) * 1 + random.uniform(0, 0.5)
                    logger.error(f"Error processing {os.path.basename(file_path)}: {e}. Retrying in {wait_time:.2f}s ({retry_count}/{retries})")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    # All retries failed - log detailed error for debugging
                    log_exception(
                        logger, 
                        context={
                            "file": file_path,
                            "provider": model_provider,
                            "model": model,
                            "retries": retry_count - 1
                        }
                    )
                    
                    # Create error record
                    error_message = f"Failed after {retry_count} retries: {type(e).__name__}: {str(e)}"
                    logger.error(f"Final error processing {os.path.basename(file_path)}: {error_message}")
                    
                    # Structured error record
                    return [{
                        "instruction": f"Review error for file: {os.path.basename(file_path)}",
                        "prompt": "What went wrong during processing this specific file?",
                        "completion": f"An exception occurred: {error_message}",
                        "metadata": {
                            "source_file": os.path.basename(file_path),
                            "error": error_message,
                            "exception_type": type(e).__name__,
                            "model_used": model or get_default_model(model_provider or get_default_provider()),
                            "processing_time": f"{time.time() - start_time:.2f}s",
                            "retry_attempts": retry_count
                        }
                    }]
    
    # Process files in batches to control rate limiting
    all_records = []
    total_batches = (len(file_paths) + batch_size - 1) // batch_size  # Ceiling division
    
    for batch_index in range(total_batches):
        batch_start = batch_index * batch_size
        batch_end = min(batch_start + batch_size, len(file_paths))
        current_batch = file_paths[batch_start:batch_end]
        
        logger.info(f"Processing batch {batch_index + 1}/{total_batches} ({len(current_batch)} files)")
        
        # Process current batch in parallel
        batch_tasks = [process_with_semaphore(file_path) for file_path in current_batch]
        batch_results = await asyncio.gather(*batch_tasks, return_exceptions=False)
        
        # Process batch results
        for i, result in enumerate(batch_results):
            file_basename = os.path.basename(current_batch[i])
            
            # Check if result is a list of records (success case)
            if isinstance(result, list):
                if any("error" in record.get("metadata", {}) for record in result):
                    # This was an error record from the retry mechanism
                    stats["failed_files"] += 1
                    all_records.extend(result)
                else:
                    # Regular success case
                    stats["successful_files"] += 1
                    stats["total_records"] += len(result)
                    all_records.extend(result)
                    
        # Add delay between batches to prevent rate limiting
        if batch_index < total_batches - 1:
            logger.info(f"Batch {batch_index + 1} complete. Waiting {batch_delay}s before next batch...")
            await asyncio.sleep(batch_delay)
    
    # Calculate final statistics
    elapsed_time = time.time() - start_time
    stats["elapsed_time"] = f"{elapsed_time:.2f}s"
    stats["throughput"] = f"{stats['total_files'] / elapsed_time:.2f} files/sec"
    stats["success_rate"] = f"{stats['successful_files'] / stats['total_files'] * 100:.1f}%"
    
    logger.info(
        f"Completed batch processing in {elapsed_time:.2f}s: "
        f"{stats['successful_files']}/{stats['total_files']} files successful, "
        f"{stats['total_records']} total records"
    )
    
    return all_records

def save_results(records: List[Dict[str, Any]], output_path: str, format: str = 'json') -> str:
    """
    Save processing results to a file in the specified format.

    Args:
        records: List of record dictionaries to save.
        output_path: Base path to save the results (extension will be added/checked).
        format: Output format ('json', 'jsonl', etc.).

    Returns:
        Path to the saved file.
    """
    output_path_obj = Path(output_path)
    # Ensure the directory exists
    output_path_obj.parent.mkdir(parents=True, exist_ok=True)

    # Adjust filename based on format if necessary
    if not output_path_obj.name.endswith(f'.{format}'):
        output_path_obj = output_path_obj.with_suffix(f'.{format}')

    try:
        with output_path_obj.open('w', encoding='utf-8') as f:
            if format == 'json':
                json.dump(records, f, indent=2, ensure_ascii=False)
            elif format == 'jsonl':
                for record in records:
                    f.write(json.dumps(record, ensure_ascii=False) + '\n')
            # Add other formats here if needed
            else:
                # Fallback to JSON if format is unknown
                logger.warning(f"Unknown output format '{format}', saving as JSON.")
                json.dump(records, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved {len(records)} records to {output_path_obj} in {format} format")
        return str(output_path_obj)
    except Exception as e:
        logger.error(f"Failed to save results to {output_path_obj}: {e}", exc_info=True)
        raise # Re-raise the exception after logging

async def process_text_content(
    text_content: str,
    model_provider: str,
    model: str,
    temperature: float,
    max_tokens: Optional[int],
    system_prompt: Optional[str],
    language: str,
    keywords: List[str],
    add_reasoning: bool,
    processing_type: str,
    start_time: float
) -> Dict[str, Any]:
    """
    Processes a single chunk of text content using the specified LLM.
    Handles API calls, error catching, and structuring the output.
    """
    logger.debug(f"Processing text chunk (first 100 chars): {text_content[:100]}...")

    # --- Prepare LLM Client and Default System Prompt ---
    client = get_llm_client(model_provider)
    if client is None:
        raise ValueError(f"Unsupported or unconfigured model provider: {model_provider}")

    # Base system prompt definition (modify as needed)
    # Assuming line 86 was somewhere above or inside this definition
    default_system_prompt = (
        f"Jesteś asystentem AI. Przeanalizuj poniższy tekst w języku '{language}' "
        f"i wykonaj zadanie zgodnie z typem przetwarzania: '{processing_type}'. "
        f"{'Dodaj swoje rozumowanie krok po kroku.' if add_reasoning else ''}"
        # Specific instructions based on processing_type could go here
    )

    # Use provided system prompt or default
    final_system_prompt = system_prompt if system_prompt else default_system_prompt

    # --- FIX: Construct the conditional keyword part separately ---
    keyword_prompt_part = f"\\nZwróć szczególną uwagę na następujące słowa kluczowe: {', '.join(keywords)}." if keywords else ""
    final_system_prompt += keyword_prompt_part # Append the keyword part

    # --- Construct Messages ---
    messages = [
        # System prompt goes as a parameter, not as a message with role="system" 
        {"role": "user", "content": text_content}
    ]

    # --- Call LLM ---
    try:
        response_content = await client.generate(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            system=final_system_prompt,
            # Pass other relevant parameters if the client supports them
        )

        # --- Structure Output ---
        # (Keep the existing logic for structuring output, reasoning etc.)
        output_record = {
            "instruction": final_system_prompt, # Or potentially summarize user query
            "input": text_content,
            "output": response_content,
            "metadata": {
                "language": language,
                "keywords_used": keywords,
                "model_provider": model_provider,
                "model": model,
                "temperature": temperature,
                "processing_type": processing_type,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
        }
        if add_reasoning:
            # Assuming reasoning might be part of response_content or handled differently
            output_record["reasoning"] = "Reasoning placeholder..." # Adjust based on actual LLM output

        return output_record

    except Exception as e:
        logger.error(f"Error during LLM processing: {e}", exc_info=True)
        # Return an error record instead of raising an exception here
        # to allow batch processing to potentially continue
        return {
            "instruction": final_system_prompt,
            "input": text_content,
            "output": None,
            "metadata": {
                "error": f"LLM Processing Error: {type(e).__name__}: {e}",
                "language": language,
                "keywords_used": keywords,
                "model_provider": model_provider,
                "model": model,
                "temperature": temperature,
                "processing_type": processing_type,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
        }