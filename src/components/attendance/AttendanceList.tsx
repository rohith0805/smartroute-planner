import { useTodayAttendance } from '@/hooks/useAttendance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Check, Clock, X } from 'lucide-react';

interface AttendanceListProps {
  classId: string | null;
  className?: string;
}

const statusConfig = {
  present: { icon: Check, color: 'bg-green-500', label: 'Present' },
  late: { icon: Clock, color: 'bg-yellow-500', label: 'Late' },
  absent: { icon: X, color: 'bg-red-500', label: 'Absent' },
};

export function AttendanceList({ classId, className }: AttendanceListProps) {
  const { data: attendance, isLoading } = useTodayAttendance(classId || undefined);
  
  const today = format(new Date(), 'EEEE, MMMM d, yyyy');

  if (!classId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please select a class to view attendance
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Today's Attendance</span>
          <Badge variant="outline">{today}</Badge>
        </CardTitle>
        {className && (
          <p className="text-sm text-muted-foreground">{className}</p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : attendance?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No attendance records for today yet.
          </div>
        ) : (
          <div className="space-y-3">
            {attendance?.map((record) => {
              const status = statusConfig[record.status];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={record.id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={record.students?.face_image_url || undefined} />
                    <AvatarFallback>
                      {record.students?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{record.students?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {record.students?.student_id} • {format(new Date(record.marked_at), 'h:mm a')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {record.confidence_score && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(record.confidence_score * 100)}%
                      </Badge>
                    )}
                    <div className={`p-1.5 rounded-full ${status.color}`}>
                      <StatusIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
