import { useState, useRef } from 'react';
import { useStudents, useCreateStudent, useDeleteStudent } from '@/hooks/useStudents';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Plus, Trash2, Upload, User } from 'lucide-react';
import { toast } from 'sonner';

interface StudentRegistrationProps {
  classId: string | null;
  className?: string;
}

export function StudentRegistration({ classId, className }: StudentRegistrationProps) {
  const { data: students, isLoading } = useStudents(classId || undefined);
  const createStudent = useCreateStudent();
  const deleteStudent = useDeleteStudent();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setIsCapturing(true);
    } catch (error) {
      toast.error('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setFaceImage(imageData);
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setFaceImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToStorage = async (base64Image: string): Promise<string | null> => {
    try {
      const base64Data = base64Image.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });
      
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      
      const { data, error } = await supabase.storage
        .from('face-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('face-images')
        .getPublicUrl(data.path);
      
      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleCreateStudent = async () => {
    if (!studentId.trim() || !studentName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!classId) {
      toast.error('Please select a class first');
      return;
    }

    try {
      let faceImageUrl = null;
      if (faceImage) {
        faceImageUrl = await uploadImageToStorage(faceImage);
      }

      await createStudent.mutateAsync({
        student_id: studentId.trim(),
        name: studentName.trim(),
        email: studentEmail.trim() || undefined,
        class_id: classId,
        face_image_url: faceImageUrl || undefined,
      });
      
      toast.success('Student registered successfully');
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('A student with this ID already exists');
      } else {
        toast.error('Failed to register student');
      }
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    
    try {
      await deleteStudent.mutateAsync(id);
      toast.success('Student deleted');
    } catch (error) {
      toast.error('Failed to delete student');
    }
  };

  const resetForm = () => {
    setStudentId('');
    setStudentName('');
    setStudentEmail('');
    setFaceImage(null);
    stopCamera();
  };

  if (!classId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a class to manage students
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          Students {className && `- ${className}`}
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Face Photo</Label>
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden max-w-[200px] mx-auto">
                  {faceImage ? (
                    <img src={faceImage} alt="Face" className="w-full h-full object-cover" />
                  ) : isCapturing ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <User className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div className="flex gap-2 justify-center">
                  {!isCapturing && !faceImage && (
                    <>
                      <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                        <Camera className="w-4 h-4 mr-2" />
                        Camera
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload
                      </Button>
                    </>
                  )}
                  {isCapturing && (
                    <Button type="button" onClick={capturePhoto}>
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </Button>
                  )}
                  {faceImage && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setFaceImage(null)}>
                      Retake
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="student-id">Student ID *</Label>
                <Input
                  id="student-id"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g., STU001"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="student-name">Full Name *</Label>
                <Input
                  id="student-name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g., John Doe"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="student-email">Email (optional)</Label>
                <Input
                  id="student-email"
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="e.g., john@example.com"
                />
              </div>
              
              <Button 
                onClick={handleCreateStudent} 
                className="w-full"
                disabled={createStudent.isPending}
              >
                {createStudent.isPending ? 'Registering...' : 'Register Student'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : students?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No students registered in this class yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Photo</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={student.face_image_url || undefined} />
                      <AvatarFallback>
                        {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">{student.student_id}</TableCell>
                  <TableCell>{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.email || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteStudent(student.id, student.name)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
