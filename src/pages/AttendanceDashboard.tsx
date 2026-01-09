import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClassSelector } from '@/components/attendance/ClassSelector';
import { StudentRegistration } from '@/components/attendance/StudentRegistration';
import { FaceRecognitionPanel } from '@/components/attendance/FaceRecognitionPanel';
import { AttendanceList } from '@/components/attendance/AttendanceList';
import { useClasses } from '@/hooks/useClasses';
import { Camera, Users, ClipboardList, GraduationCap } from 'lucide-react';

export default function AttendanceDashboard() {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const { data: classes } = useClasses();
  
  const selectedClass = classes?.find(c => c.id === selectedClassId);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GraduationCap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Face Attendance System</h1>
              <p className="text-sm text-muted-foreground">
                Automated attendance using face recognition
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <ClassSelector
            selectedClassId={selectedClassId}
            onClassSelect={setSelectedClassId}
          />
        </div>

        <Tabs defaultValue="recognition" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recognition" className="flex items-center gap-2">
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Recognition</span>
            </TabsTrigger>
            <TabsTrigger value="students" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Students</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Attendance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recognition" className="space-y-4">
            <FaceRecognitionPanel
              classId={selectedClassId}
              className={selectedClass?.name}
            />
          </TabsContent>

          <TabsContent value="students">
            <StudentRegistration
              classId={selectedClassId}
              className={selectedClass?.name}
            />
          </TabsContent>

          <TabsContent value="attendance">
            <AttendanceList
              classId={selectedClassId}
              className={selectedClass?.name}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
