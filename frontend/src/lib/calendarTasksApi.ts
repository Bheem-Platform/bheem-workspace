/**
 * Bheem Calendar Tasks API Client
 * Handles task lists, tasks, and people search
 */

import { api } from './api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaskList {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_default: boolean;
  sort_order: number;
  task_count: number;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  due_date?: string;
  due_time?: string;
  status: 'needsAction' | 'completed';
  completed_at?: string;
  is_starred: boolean;
  priority: 'low' | 'normal' | 'high';
  sort_order: number;
  task_list_id?: string;
  task_list_name?: string;
  parent_task_id?: string;
  source: 'personal' | 'erp';
  erp_task_id?: string;
  erp_project_id?: string;
  erp_project_name?: string;
  subtasks: Task[];
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  email: string;
  name?: string;
  role?: string;
  department?: string;
  avatar_url?: string;
}

export interface CreateTaskList {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateTaskList {
  name?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}

export interface CreateTask {
  title: string;
  notes?: string;
  due_date?: string;
  due_time?: string;
  task_list_id?: string;
  priority?: string;
  parent_task_id?: string;
}

export interface UpdateTask {
  title?: string;
  notes?: string;
  due_date?: string;
  due_time?: string;
  status?: string;
  is_starred?: boolean;
  priority?: string;
  task_list_id?: string;
  sort_order?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEOPLE SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchPeople(query: string, limit = 20): Promise<Person[]> {
  const response = await api.get('/calendar/people/search', {
    params: { q: query, limit }
  });
  return response.data;
}

export async function listPeople(limit = 50, offset = 0): Promise<Person[]> {
  const response = await api.get('/calendar/people', {
    params: { limit, offset }
  });
  return response.data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASK LISTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getTaskLists(): Promise<TaskList[]> {
  const response = await api.get('/calendar/task-lists');
  return response.data;
}

export async function createTaskList(data: CreateTaskList): Promise<TaskList> {
  const response = await api.post('/calendar/task-lists', data);
  return response.data;
}

export async function updateTaskList(id: string, data: UpdateTaskList): Promise<TaskList> {
  const response = await api.patch(`/calendar/task-lists/${id}`, data);
  return response.data;
}

export async function deleteTaskList(id: string): Promise<void> {
  await api.delete(`/calendar/task-lists/${id}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════

export interface GetTasksParams {
  list_id?: string;
  starred?: boolean;
  status?: string;
  include_erp?: boolean;
}

export async function getTasks(params?: GetTasksParams): Promise<Task[]> {
  const response = await api.get('/calendar/tasks', { params });
  return response.data;
}

export async function createTask(data: CreateTask): Promise<Task> {
  const response = await api.post('/calendar/tasks', data);
  return response.data;
}

export async function updateTask(id: string, data: UpdateTask): Promise<Task> {
  const response = await api.patch(`/calendar/tasks/${id}`, data);
  return response.data;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/calendar/tasks/${id}`);
}

export async function toggleTaskStar(id: string): Promise<{ is_starred: boolean }> {
  const response = await api.post(`/calendar/tasks/${id}/toggle-star`);
  return response.data;
}

export async function completeTask(id: string): Promise<void> {
  await api.post(`/calendar/tasks/${id}/complete`);
}

export async function uncompleteTask(id: string): Promise<void> {
  await api.post(`/calendar/tasks/${id}/uncomplete`);
}
