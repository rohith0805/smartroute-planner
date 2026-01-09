import { useState } from 'react';
import { useStudents } from '@/hooks/useStudents';
import { useMarkAttendance } from '@/hooks/useAttendance';
import { CameraCapture } from './CameraCapture';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, AlertCircle, Scan } from 'lucide-react';
import { toast } from 'sonner';

interface FaceRecognitionPanelProps {
  classId: string | null;
  className?: string;
}

interface RecognitionResult {
  detected: boolean;
  faces_count: number;
  recognized_students: Array<{
    student_id: string;
    name: string;
    confidence: number;
  }>;
  message: string;
}

export function FaceRecognitionPanel({ classId, className }: FaceRecognitionPanelProps) {
  const { data: students } = useStudents(classId || undefined);
  const markAttendance = useMarkAttendance();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<RecognitionResult | null>(null);

  const handleCapture = async (imageBase64: string) => {
    if (!classId) {
      toast.error('Please select a class first');
      return;
    }

    setIsProcessing(true);
    setLastResult(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recognize-face`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            imageBase64,
            classId,
            registeredStudents: students?.map(s => ({
              student_id: s.student_id,
              name: s.name,
              face_image_url: s.face_image_url,
            })),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Recognition failed');
      }

      const result: RecognitionResult = await response.json();
      setLastResult(result);

      if (result.detected && result.recognized_students.length > 0) {
        // Mark attendance for recognized students
        for (const recognized of result.recognized_students) {
          const student = students?.find(s => s.student_id === recognized.student_id);
          if (student) {
            await markAttendance.mutateAsync({
              student_id: student.id,
              class_id: classId,
              status: 'present',
              confidence_score: recognized.confidence,
            });
            toast.success(`Attendance marked for ${recognized.name}`);
          }
        }
      } else {
        toast.info(result.message || 'No students recognized');
      }
    } catch (error: any) {
      console.error('Recognition error:', error);
      toast.error(error.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!classId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Scan className="w-12 h-12 mx-auto mb-4 opacity-50" />
          Please select a class to start face recognition
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Scan className="w-5 h-5" />
            Face Recognition
          </CardTitle>
          {className && (
            <p className="text-sm text-muted-foreground">{className}</p>
          )}
        </CardHeader>
        <CardContent>
          <CameraCapture onCapture={handleCapture} isProcessing={isProcessing} />
        </CardContent>
      </Card>

      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recognition Result</CardTitle>
          </CardHeader>
          <CardContent>
            {lastResult.detected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {lastResult.faces_count} face(s) detected
                  </Badge>
                </div>
                
                {lastResult.recognized_students.length > 0 ? (
                  <div className="space-y-3">
                    {lastResult.recognized_students.map((student, index) => {
                      const fullStudent = students?.find(s => s.student_id === student.student_id);
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                        >
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={fullStudent?.face_image_url || undefined} />
                            <AvatarFallback>
                              {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{student.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ID: {student.student_id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {Math.round(student.confidence * 100)}% match
                            </Badge>
                            <div className="p-1.5 rounded-full bg-green-500">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <p className="text-sm">
                      Face detected but no matching student found in this class.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {lastResult.message || 'No face detected in the image'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
