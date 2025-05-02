import { useEffect, useState } from 'react';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { webSocketService } from '../../lib/api/websocket';
import { downloadResults, getJobProgress } from '../../lib/api/client';
import { ProgressStatus } from '../../types/models';

interface ProgressIndicatorProps {
  jobId: string;
  onComplete?: () => void;
}

export function ProgressIndicator({ jobId, onComplete }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState<ProgressStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchInitialProgress = async () => {
      try {
        const initialProgress = await getJobProgress(jobId);
        setProgress(initialProgress);
        
        if (initialProgress.status === 'completed' && onComplete) {
          onComplete();
        }
      } catch (error: any) {
        console.error('Error fetching initial progress:', error);
        setError('Failed to load processing status: ' + (error.message || 'Unknown error'));
      }
    };
    
    fetchInitialProgress();
    
    const unsubscribe = webSocketService.subscribe(jobId, (updatedProgress) => {
      setProgress(updatedProgress);
      
      if (updatedProgress.status === 'completed' && onComplete) {
        onComplete();
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [jobId, onComplete]);
  
  const handleDownload = async () => {
    try {
      await downloadResults(jobId);
    } catch (error: any) {
      console.error('Error downloading results:', error);
      setError('Failed to download results: ' + (error.message || 'Unknown error'));
    }
  };
  
  if (!progress) {
    return <div className="text-center py-4">Loading progress...</div>;
  }
  
  if (error) {
    return <div className="text-destructive text-center py-4">{error}</div>;
  }
  
  const progressPercentage = progress.total > 0
    ? Math.floor((progress.current / progress.total) * 100)
    : 0;
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Processing Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress: {progressPercentage}%</span>
            <span>{progress.current} of {progress.total}</span>
          </div>
          <Progress value={progressPercentage} />
        </div>
        
        {progress.status === 'in_progress' && (
          <div className="text-center text-muted-foreground">
            Processing files... This may take a few minutes.
          </div>
        )}
        
        {progress.status === 'completed' && (
          <div className="text-center text-green-600 font-medium">
            Processing complete!
          </div>
        )}
        
        {progress.status === 'failed' && (
          <div className="text-center text-destructive">
            <div className="font-medium">Processing failed</div>
            {progress.error && <div className="text-sm mt-1">{progress.error}</div>}
          </div>
        )}
      </CardContent>
      
      {progress.status === 'completed' && (
        <CardFooter>
          <Button className="w-full" onClick={handleDownload}>
            Download Results
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}