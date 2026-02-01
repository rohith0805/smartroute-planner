-- Drop attendance-related tables (must drop in order due to foreign keys)
DROP TABLE IF EXISTS public.attendance_records;
DROP TABLE IF EXISTS public.students;
DROP TABLE IF EXISTS public.classes;

-- Drop the attendance status enum
DROP TYPE IF EXISTS public.attendance_status;

-- Delete the face-images storage bucket (must delete objects first)
DELETE FROM storage.objects WHERE bucket_id = 'face-images';
DELETE FROM storage.buckets WHERE id = 'face-images';