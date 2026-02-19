export interface AppNotification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  taskId: string | null;
}

export interface TaskUser {
  id: string;
  name: string | null;
  image: string | null;
}

export interface TaskLabel {
  id: string;
  label: {
    id: string;
    name: string;
    color: string;
  };
}

export interface TaskAssignee {
  id: string;
  user: TaskUser;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
  position: number;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  sectionId: string | null;
  projectId: string;
  parentId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
  labels: TaskLabel[];
  _count: { subtasks: number };
}

export interface Section {
  id: string;
  name: string;
  position: number;
  color: string | null;
  projectId: string;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
  workspaceId: string;
  sections: Section[];
}
