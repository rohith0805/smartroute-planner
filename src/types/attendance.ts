export interface Class {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  student_id: string;
  name: string;
  email: string | null;
  face_image_url: string | null;
  face_encoding: string | null;
  class_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  status: 'present' | 'absent' | 'late';
  marked_at: string;
  confidence_score: number | null;
  created_at: string;
}

export interface StudentWithClass extends Student {
  classes?: Class;
}

export interface AttendanceWithStudent extends AttendanceRecord {
  students?: Student;
}
