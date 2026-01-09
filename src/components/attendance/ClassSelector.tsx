import { useState } from 'react';
import { useClasses, useCreateClass } from '@/hooks/useClasses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface ClassSelectorProps {
  selectedClassId: string | null;
  onClassSelect: (classId: string) => void;
}

export function ClassSelector({ selectedClassId, onClassSelect }: ClassSelectorProps) {
  const { data: classes, isLoading } = useClasses();
  const createClass = useCreateClass();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      toast.error('Please enter a class name');
      return;
    }

    try {
      const newClass = await createClass.mutateAsync({
        name: newClassName.trim(),
        description: newClassDescription.trim() || undefined,
      });
      
      toast.success('Class created successfully');
      setIsDialogOpen(false);
      setNewClassName('');
      setNewClassDescription('');
      onClassSelect(newClass.id);
    } catch (error) {
      toast.error('Failed to create class');
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <Label htmlFor="class-select">Select Class</Label>
        <Select value={selectedClassId || ''} onValueChange={onClassSelect}>
          <SelectTrigger id="class-select">
            <SelectValue placeholder={isLoading ? 'Loading...' : 'Select a class'} />
          </SelectTrigger>
          <SelectContent>
            {classes?.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon">
            <Plus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Class Name</Label>
              <Input
                id="class-name"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="e.g., Computer Science 101"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-desc">Description (optional)</Label>
              <Input
                id="class-desc"
                value={newClassDescription}
                onChange={(e) => setNewClassDescription(e.target.value)}
                placeholder="e.g., Monday/Wednesday 9:00 AM"
              />
            </div>
            <Button 
              onClick={handleCreateClass} 
              className="w-full"
              disabled={createClass.isPending}
            >
              {createClass.isPending ? 'Creating...' : 'Create Class'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
