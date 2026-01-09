import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Student, StudentWithClass } from '@/types/attendance';

export function useStudents(classId?: string) {
  return useQuery({
    queryKey: ['students', classId],
    queryFn: async () => {
      let query = supabase
        .from('students')
        .select('*, classes(*)')
        .order('name');
      
      if (classId) {
        query = query.eq('class_id', classId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as StudentWithClass[];
    },
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (studentData: {
      student_id: string;
      name: string;
      email?: string;
      class_id?: string;
      face_image_url?: string;
    }) => {
      const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Student> & { id: string }) => {
      const { data, error } = await supabase
        .from('students')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (studentId: string) => {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}
