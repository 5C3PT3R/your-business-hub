import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useTasks, TaskStatus, TaskPriority } from '@/hooks/useTasks';
import { useContacts } from '@/hooks/useContacts';
import { useDeals } from '@/hooks/useDeals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, SortDesc, Plus, Loader2, Calendar, Flag, MoreHorizontal, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const priorityConfig = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'High' },
  medium: { color: 'text-warning', bg: 'bg-warning/10', label: 'Medium' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Low' },
};

const statusConfig = {
  pending: { color: 'bg-muted text-muted-foreground', label: 'Pending' },
  in_progress: { color: 'bg-info/10 text-info', label: 'In Progress' },
  completed: { color: 'bg-success/10 text-success', label: 'Completed' },
};

export default function Tasks() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { tasks, loading, addTask, updateTask, deleteTask } = useTasks();
  const { contacts } = useContacts();
  const { deals } = useDeals();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as TaskPriority,
    status: 'pending' as TaskStatus,
    due_date: '',
    related_contact_id: '',
    related_deal_id: '',
  });

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = filter === 'all' || task.status === filter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const handleAddTask = async () => {
    if (!newTask.title) return;
    
    await addTask({
      title: newTask.title,
      description: newTask.description || null,
      priority: newTask.priority,
      status: newTask.status,
      due_date: newTask.due_date || null,
      related_contact_id: newTask.related_contact_id === 'none' || !newTask.related_contact_id ? null : newTask.related_contact_id,
      related_deal_id: newTask.related_deal_id === 'none' || !newTask.related_deal_id ? null : newTask.related_deal_id,
    });
    
    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending',
      due_date: '',
      related_contact_id: '',
      related_deal_id: '',
    });
    setIsAddDialogOpen(false);
  };

  const toggleComplete = async (taskId: string, currentStatus: TaskStatus) => {
    const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    await updateTask(taskId, { status: newStatus });
  };

  return (
    <MainLayout>
      <Header
        title="Tasks"
        subtitle="Manage your activities and to-dos"
        action={{
          label: 'Add Task',
          onClick: () => setIsAddDialogOpen(true),
        }}
        onSearch={setSearchQuery}
        searchPlaceholder="Search tasks..."
      />
      
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Priority</Label>
                    <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setPriorityFilter('all')}
                  >
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as typeof filter)}
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Add Task Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Follow up with client"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Add more details..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <Select value={newTask.priority} onValueChange={(value) => setNewTask({ ...newTask, priority: value as TaskPriority })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-status">Status</Label>
                  <Select value={newTask.status} onValueChange={(value) => setNewTask({ ...newTask, status: value as TaskStatus })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-due-date">Due Date</Label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              {contacts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="task-contact">Related Contact</Label>
                  <Select value={newTask.related_contact_id} onValueChange={(value) => setNewTask({ ...newTask, related_contact_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {deals.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="task-deal">Related Deal</Label>
                  <Select value={newTask.related_deal_id} onValueChange={(value) => setNewTask({ ...newTask, related_deal_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select deal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button className="w-full" variant="gradient" onClick={handleAddTask}>
                Add Task
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Task List */}
        {!loading && (
          <div className="space-y-3 animate-slide-up">
            {filteredTasks.map((task, index) => {
              const priority = priorityConfig[task.priority];
              const status = statusConfig[task.status];

              return (
                <div
                  key={task.id}
                  className={cn(
                    'group flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/30 animate-fade-in',
                    task.status === 'completed' && 'opacity-60'
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => toggleComplete(task.id, task.status)}
                    className="mt-1"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className={cn(
                          'font-medium text-foreground',
                          task.status === 'completed' && 'line-through'
                        )}>
                          {task.title}
                        </h4>
                        {task.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => updateTask(task.id, { status: 'in_progress' })}
                          >
                            Mark In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => updateTask(task.id, { priority: task.priority === 'high' ? 'low' : 'high' as TaskPriority })}
                          >
                            Change Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteTask(task.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                      <span className={cn('rounded-full px-2.5 py-1 font-medium', status.color)}>
                        {status.label}
                      </span>
                      <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', priority.bg, priority.color)}>
                        <Flag className="h-3 w-3" />
                        {priority.label}
                      </span>
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery || filter !== 'all' || priorityFilter !== 'all'
                    ? 'No tasks found matching your filters.'
                    : 'No tasks yet. Add your first task!'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
