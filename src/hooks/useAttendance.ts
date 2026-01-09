import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AttendanceRecord, AttendanceWithStudent } from '@/types/attendance';

export function useAttendance(classId?: string, date?: string) {
  return useQuery({
    queryKey: ['attendance', classId, date],
    queryFn: async () => {
      let query = supabase
        .from('attendance_records')
        .select('*, students(*)')
        .order('marked_at', { ascending: false });
      
      if (classId) {
        query = query.eq('class_id', classId);
      }
      
      if (date) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        query = query.gte('marked_at', startOfDay).lte('marked_at', endOfDay);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as AttendanceWithStudent[];
    },
  });
}

export function useTodayAttendance(classId?: string) {
  const today = new Date().toISOString().split('T')[0];
  return useAttendance(classId, today);
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (record: {
      student_id: string;
      class_id: string;
      status?: 'present' | 'absent' | 'late';
      confidence_score?: number;
    }) => {
      const { data, error } = await supabase
        .from('attendance_records')
        .insert({
          ...record,
          status: record.status || 'present',
          marked_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}
