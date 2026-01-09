-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');

-- Create classes table
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create students table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    face_image_url TEXT,
    face_encoding TEXT,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create attendance records table
CREATE TABLE public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    status attendance_status DEFAULT 'present' NOT NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    confidence_score NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create policies for public read (for now, can be restricted later)
CREATE POLICY "Allow public read classes" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Allow public insert classes" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update classes" ON public.classes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete classes" ON public.classes FOR DELETE USING (true);

CREATE POLICY "Allow public read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Allow public delete students" ON public.students FOR DELETE USING (true);

CREATE POLICY "Allow public read attendance" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert attendance" ON public.attendance_records FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_students_class ON public.students(class_id);
CREATE INDEX idx_attendance_student ON public.attendance_records(student_id);
CREATE INDEX idx_attendance_class ON public.attendance_records(class_id);
CREATE INDEX idx_attendance_date ON public.attendance_records(marked_at);

-- Create storage bucket for face images
INSERT INTO storage.buckets (id, name, public) VALUES ('face-images', 'face-images', true);

-- Storage policies for face images
CREATE POLICY "Public can view face images" ON storage.objects FOR SELECT USING (bucket_id = 'face-images');
CREATE POLICY "Public can upload face images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'face-images');
CREATE POLICY "Public can update face images" ON storage.objects FOR UPDATE USING (bucket_id = 'face-images');
CREATE POLICY "Public can delete face images" ON storage.objects FOR DELETE USING (bucket_id = 'face-images');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();