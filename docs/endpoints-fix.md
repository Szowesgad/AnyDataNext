# AnyDataNext API Endpoints Redesign

## Current State Analysis

### Processing Types

Currently, AnyDataNext has four theoretical processing types, but only one is fully implemented:

1. **STANDARD** - Fully implemented in `process_file` function. This is the default processing type.

2. **ARTICLE** - Exists as a conditional branch in `process_file` but is currently a placeholder:
   ```python
   elif processing_type == 'article':
       # Placeholder: Implement logic for article processing
       logger.warning(f"Processing type '{processing_type}' not fully implemented, using standard logic as fallback.")
       # Fallback to standard logic for now
       # TODO: Call or implement article-specific logic from scripts/articles.py idea
       final_system_prompt = f"{base_system_prompt}\n\nDetailed instructions for article processing would go here."
       # Need to adapt the expected JSON structure as well
       pass
   ```

3. **TRANSLATE** - Similar to ARTICLE, exists as a placeholder:
   ```python
   elif processing_type == 'translate':
       # Placeholder: Implement logic for translation
       logger.warning(f"Processing type '{processing_type}' not fully implemented, using standard logic as fallback.")
       # Fallback to standard logic for now
       # TODO: Call or implement translation-specific logic from scripts/translate.py idea
       final_system_prompt = f"{base_system_prompt}\n\nDetailed instructions for translation processing would go here."
       # Need to adapt the expected JSON structure as well
       pass
   ```

4. **BATCH** - This is handled by the `process_files` function rather than being a `processing_type` parameter value. It's implemented as a separate function that calls `process_file` multiple times with concurrency controls.

### API Endpoints

The current API endpoints related to file processing are:

1. `POST /api/upload` - Uploads a file and returns a file_id
2. `POST /api/process` - Processes a single file with various parameters including processing_type
3. `GET /api/status/{job_id}` - Gets the status of a processing job
4. `GET /api/datasets` - Lists all available datasets
5. `GET /api/datasets/{dataset_id}` - Gets a complete dataset
6. `GET /api/datasets/{dataset_id}/preview` - Gets a preview of a dataset
7. `GET /api/results/{job_id}` - Downloads the results of a processing job
8. `WS /ws/{client_id}` - WebSocket for real-time progress updates

There is no dedicated endpoint for batch processing - it's unclear how batch processing is triggered from the frontend.

### Format Inconsistencies

There is a critical format inconsistency between what our parsers now generate and what the API endpoints return:

**Required Standard Format (as per nextsteps.md):**
```json
{
  "instruction": "PODSUMOWANY konkretny fragment/kontekst z dokumentu...",
  "prompt": "Pytanie o pojęcia, definicje lub metody z dokumentu",
  "completion": "Wyczerpująca odpowiedź uwzględniająca pełny kontekst",
  "metadata": {
    "source_file": "plik_źródłowy.pdf",
    "chunk_index": 3,
    "total_chunks": 12,
    "model_used": "claude-3-7-20250219",
    "processing_time": "1.23s",
    "confidence_score": 0.94,
    "keywords": ["hemodializa", "ultrafiltracja", "dyfuzja", "weterynaria"],
    "extracted_entities": ["hemodializa", "dializator", "osocze"]
  }
}
```

**Current Format Seen in API Responses:**
```json
{
  "instruction": "Przeanalizuj fragment 1/30 dokumentu PDF",
  "input": "Przyjazna lecznica\n\nCZY SI SIĘ MYLI?...",
  "output": "Dokument PDF zawiera istotne informacje...",
  "metadata": {
    "chunk_index": 0,
    "total_chunks": 30,
    "source_file": "1746277837_5977507b9a8341a2a08b36623adda789.pdf"
  }
}
```

Key differences:
- Uses "input" instead of "prompt"
- Uses "output" instead of "completion"
- Missing several metadata fields
- Content of fields doesn't match the requirements (e.g., instruction is generic rather than a summary)

### Frontend-Backend Integration Issues

The frontend components are likely built to expect the old format with "input"/"output". When we changed the parsers to generate "prompt"/"completion", we didn't update:

1. The API endpoints that read and return the data
2. The frontend components that display the data
3. Existing data that was already saved in the old format

This creates a situation where:
- New data is generated in the new format but then either transformed back to the old format or causes errors
- The frontend can't properly display data in the new format
- There's no clear UI for selecting between the different processing types

## Standardized Format Requirements

### Data Format Specification

All processing types should produce data in this standardized format:

```json
{
  "instruction": "PODSUMOWANY konkretny fragment/kontekst z dokumentu...",
  "prompt": "Pytanie o pojęcia, definicje lub metody z dokumentu",
  "completion": "Wyczerpująca odpowiedź uwzględniająca pełny kontekst",
  "metadata": {
    "source_file": "plik_źródłowy.pdf",
    "chunk_index": 3,
    "total_chunks": 12,
    "model_used": "claude-3-7-20250219",
    "processing_time": "1.23s",
    "confidence_score": 0.94,
    "keywords": ["hemodializa", "ultrafiltracja", "dyfuzja", "weterynaria"],
    "extracted_entities": ["hemodializa", "dializator", "osocze"]
  }
}
```

### Migration Strategy

For existing data, we have two options:

1. **On-The-Fly Transformation**: Modify API endpoints to transform old format to new format when reading data.
2. **One-Time Migration**: Create a script to update all existing JSON files to the new format.

The on-the-fly transformation is simpler but less performant, while the one-time migration requires more effort but results in a more consistent database.

## Processing Types Implementation Plan

### STANDARD Processing

Current implementation needs enhancement:
- Ensure proper population of all metadata fields
- Improve instruction to be a proper summary
- Ensure prompt is a relevant question
- Set completion to be a comprehensive answer

### ARTICLE Processing

Implement proper article processing:
1. Develop the actual functionality in scripts/articles.py
2. Update the conditional branch in process_file to use this functionality
3. Ensure it produces data in the standardized format
4. Create a dedicated UI element for article processing

Article processing should focus on extracting structured information from articles:
- Title, authors, publication date
- Abstract, introduction, methodology, results, conclusion
- Citations and references

### TRANSLATE Processing

Implement proper translation processing:
1. Develop the actual functionality in scripts/translate.py
2. Update the conditional branch in process_file to use this functionality
3. Ensure it produces data in the standardized format
4. Create a dedicated UI element for translation processing

Translation processing should handle:
- Source language detection or selection
- Target language selection
- Preservation of formatting and structure
- Handling of specialized terminology

### BATCH Processing

Formalize batch processing as a proper processing type:
1. Create a dedicated endpoint for batch processing
2. Ensure it calls process_files with appropriate parameters
3. Create a dedicated UI for batch processing with:
   - Multiple file upload
   - Batch processing options
   - Progress tracking for multiple files

## API Endpoints Redesign

### Single File Processing

Update the `POST /api/process` endpoint:
- Ensure processing_type parameter is properly handled
- Validate and enforce the standardized format
- Properly populate all metadata fields
- Add options specific to each processing type

### Batch Processing

Create a new `POST /api/process-batch` endpoint:
- Accept multiple file_ids
- Accept batch-specific parameters (e.g., concurrency)
- Call the process_files function
- Return a batch_job_id for status tracking

### Dataset Endpoints

Modify the dataset endpoints to ensure they return data in the standardized format:
- `GET /api/datasets/{dataset_id}` - Transform data to new format if needed
- `GET /api/datasets/{dataset_id}/preview` - Transform preview data to new format if needed

### WebSocket Improvements

Enhance WebSocket messages to provide more detailed progress information:
- Current processing step
- Per-file progress in batch processing
- Estimated time remaining
- Current operation (parsing, LLM processing, saving)

## Frontend Implementation Recommendations

### Processing Type Selection

Create a prominent UI element with four main buttons for processing types:
- STANDARD - For general document processing
- ARTICLE - For article-specific processing
- TRANSLATE - For translation processing
- BATCH - For processing multiple files

Each button should lead to a form with processing type-specific options.

### Updated Components

Update frontend components to handle the standardized format:
- Replace references to "input" with "prompt"
- Replace references to "output" with "completion"
- Add display of additional metadata fields
- Add visualization of keywords and extracted entities

### Backward Compatibility

Implement backward compatibility for existing datasets:
- Add detection of old format (presence of "input"/"output" instead of "prompt"/"completion")
- Transform old format to new format before display
- Add warning for datasets in the old format

## Testing Strategy

### Unit Tests

Create unit tests for:
- Each processing type
- Format transformation functions
- API endpoints

### Integration Tests

Create integration tests for:
- Frontend-backend communication
- WebSocket progress updates
- File upload and processing workflow
- Dataset viewing and downloading

### End-to-End Tests

Create end-to-end tests for complete workflows:
- Upload and process a file using each processing type
- View and download processed datasets
- Batch process multiple files

## Implementation Roadmap

1. **Phase 1: Format Standardization**
   - Update parsers to generate standardized format (already done)
   - Modify API endpoints to ensure standardized format
   - Update frontend components to handle standardized format

2. **Phase 2: Processing Types Implementation**
   - Implement ARTICLE processing
   - Implement TRANSLATE processing
   - Formalize BATCH processing

3. **Phase 3: UI Redesign**
   - Create four main processing type buttons
   - Create processing type-specific forms
   - Enhance results display with new metadata fields

4. **Phase 4: Testing and Refinement**
   - Create comprehensive test suite
   - Refine based on test results
   - Document API changes for frontend developers

## Conclusion

The current implementation of processing types and API endpoints in AnyDataNext is incomplete and inconsistent. By implementing the recommendations in this document, we can create a more robust, consistent, and user-friendly system with four clearly defined processing types (STANDARD, ARTICLE, TRANSLATE, BATCH) and a standardized data format that meets the requirements defined in nextsteps.md.

This will require significant changes to both the backend and frontend, but the result will be a more maintainable and extensible system that better serves user needs.