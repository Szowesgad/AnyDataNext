export interface DatasetItem {
  id: string;
  name: string;
  metadata: Record<string, any>;
  processed: boolean;
  created_at: string;
  file_type: string;
  size: number;
}

export interface ProcessingOptions {
  model_provider: string;
  model_name: string;
  processing_type: string;
  processing_options: Record<string, any>;
  parallel_processing: boolean;
  max_workers?: number;
}

export interface ProcessingResult {
  success: boolean;
  job_id?: string;
  error_message?: string;
  processed_files?: number;
  total_files?: number;
}

export interface ProgressStatus {
  job_id: string;
  current: number;
  total: number;
  status: 'in_progress' | 'completed' | 'failed';
  error?: string;
  result?: any;
}

export interface ModelProvider {
  id: string;
  name: string;
  models: Model[];
  available: boolean;
}

export interface Model {
  id: string;
  name: string;
  max_tokens: number;
  context_window: number;
  available: boolean;
}