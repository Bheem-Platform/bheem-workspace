/**
 * Bheem Calendar - Tasks Panel
 * Google Tasks-like interface with task lists, starred, and ERP integration
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Star,
  StarOff,
  List,
  ChevronDown,
  ChevronRight,
  Check,
  Circle,
  Calendar,
  MoreVertical,
  Trash2,
  Edit2,
  FolderKanban,
  Briefcase,
  X,
} from 'lucide-react';
import * as tasksApi from '@/lib/calendarTasksApi';
import type { Task, TaskList } from '@/lib/calendarTasksApi';

interface TasksPanelProps {
  onClose?: () => void;
}

type ViewMode = 'all' | 'starred' | 'list' | 'my-tasks';

export default function TasksPanel({ onClose }: TasksPanelProps) {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('my-tasks');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Fetch task lists
  const fetchTaskLists = useCallback(async () => {
    try {
      const lists = await tasksApi.getTaskLists();
      setTaskLists(lists);
      // Set default list if not selected
      if (!selectedListId && lists.length > 0) {
        const defaultList = lists.find(l => l.is_default) || lists[0];
        setSelectedListId(defaultList.id);
      }
    } catch (error) {
      console.error('Failed to fetch task lists:', error);
    }
  }, [selectedListId]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params: tasksApi.GetTasksParams = {};

      if (viewMode === 'starred') {
        params.starred = true;
      } else if (viewMode === 'list' && selectedListId) {
        params.list_id = selectedListId;
      }

      if (!showCompleted) {
        params.status = 'needsAction';
      }

      const fetchedTasks = await tasksApi.getTasks(params);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedListId, showCompleted]);

  useEffect(() => {
    fetchTaskLists();
  }, [fetchTaskLists]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Add new task
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;

    try {
      await tasksApi.createTask({
        title: newTaskTitle,
        task_list_id: selectedListId || undefined,
      });
      setNewTaskTitle('');
      setIsAddingTask(false);
      fetchTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  // Toggle task completion
  const handleToggleComplete = async (task: Task) => {
    try {
      if (task.status === 'completed') {
        await tasksApi.uncompleteTask(task.id);
      } else {
        await tasksApi.completeTask(task.id);
      }
      fetchTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  // Toggle task star
  const handleToggleStar = async (taskId: string) => {
    try {
      await tasksApi.toggleTaskStar(taskId);
      fetchTasks();
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksApi.deleteTask(taskId);
      fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Create new list
  const handleCreateList = async () => {
    if (!newListName.trim()) return;

    try {
      const newList = await tasksApi.createTaskList({ name: newListName });
      setNewListName('');
      setShowNewListModal(false);
      fetchTaskLists();
      setSelectedListId(newList.id);
      setViewMode('list');
    } catch (error) {
      console.error('Failed to create list:', error);
    }
  };

  // Group tasks by source
  const personalTasks = tasks.filter(t => t.source === 'personal');
  const erpTasks = tasks.filter(t => t.source === 'erp');

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'low': return 'text-gray-400';
      default: return 'text-blue-500';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100">
        <button
          onClick={() => setViewMode('my-tasks')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            viewMode === 'my-tasks'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          My Tasks
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setViewMode('starred')}
          className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
            viewMode === 'starred'
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Star size={14} className="inline mr-1" />
          Starred
        </button>
      </div>

      {/* Task Lists Dropdown */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <select
            value={selectedListId || ''}
            onChange={(e) => {
              setSelectedListId(e.target.value || null);
              if (e.target.value) setViewMode('list');
            }}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Lists</option>
            {taskLists.map(list => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.task_count})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewListModal(true)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Create new list"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Add Task Input */}
      <div className="px-4 py-3 border-b border-gray-100">
        {isAddingTask ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') {
                  setIsAddingTask(false);
                  setNewTaskTitle('');
                }
              }}
            />
            <button
              onClick={handleAddTask}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Add
            </button>
            <button
              onClick={() => {
                setIsAddingTask(false);
                setNewTaskTitle('');
              }}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingTask(true)}
            className="flex items-center gap-2 w-full px-3 py-2 text-left text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Plus size={18} />
            <span>Add a task</span>
          </button>
        )}
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12">
            <Check size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No tasks</p>
            <p className="text-sm text-gray-400">Add a task to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Personal Tasks */}
            {personalTasks.length > 0 && (
              <div className="py-2">
                {erpTasks.length > 0 && (
                  <div className="px-4 py-1 text-xs font-medium text-gray-500 uppercase">
                    Personal Tasks
                  </div>
                )}
                {personalTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onToggleStar={handleToggleStar}
                    onDelete={handleDeleteTask}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
              </div>
            )}

            {/* ERP Project Tasks */}
            {erpTasks.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1 flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                  <Briefcase size={12} />
                  Project Tasks
                </div>
                {erpTasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggleComplete={handleToggleComplete}
                    onToggleStar={handleToggleStar}
                    onDelete={handleDeleteTask}
                    formatDueDate={formatDueDate}
                    getPriorityColor={getPriorityColor}
                    isErpTask
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Show Completed Toggle */}
      <div className="px-4 py-3 border-t border-gray-100">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
          />
          Show completed tasks
        </label>
      </div>

      {/* New List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">Create New List</h3>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateList();
                if (e.key === 'Escape') {
                  setShowNewListModal(false);
                  setNewListName('');
                }
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNewListModal(false);
                  setNewListName('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Item Component
interface TaskItemProps {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onToggleStar: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  formatDueDate: (date: string) => string;
  getPriorityColor: (priority: string) => string;
  isErpTask?: boolean;
}

function TaskItem({
  task,
  onToggleComplete,
  onToggleStar,
  onDelete,
  formatDueDate,
  getPriorityColor,
  isErpTask,
}: TaskItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group px-4 py-2 hover:bg-gray-50 flex items-start gap-3">
      {/* Checkbox */}
      <button
        onClick={() => onToggleComplete(task)}
        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.status === 'completed'
            ? 'bg-blue-500 border-blue-500'
            : 'border-gray-300 hover:border-blue-500'
        }`}
      >
        {task.status === 'completed' && <Check size={12} className="text-white" />}
      </button>

      {/* Task Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {isErpTask && task.erp_project_name && (
            <span className="flex items-center gap-1 text-orange-600">
              <FolderKanban size={12} />
              {task.erp_project_name}
            </span>
          )}
          {task.task_list_name && !isErpTask && (
            <span className="flex items-center gap-1">
              <List size={12} />
              {task.task_list_name}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleStar(task.id)}
          className="p-1 hover:bg-gray-200 rounded"
        >
          {task.is_starred ? (
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff size={16} className="text-gray-400" />
          )}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <MoreVertical size={16} className="text-gray-400" />
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <button
                  onClick={() => {
                    onDelete(task.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
