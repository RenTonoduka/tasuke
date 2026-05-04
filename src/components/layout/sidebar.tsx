'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Check,
  CheckSquare,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Inbox,
  Trash2,
  MoreHorizontal,
  Sun,
  Moon,
  GripVertical,
  Lock,
  Download,
  Key,
  Github,
  Plus,
  Pencil,
  UserPlus,
  PanelLeftClose,
  MessageCircle,
  Bot,
  ShieldCheck,
  FolderOpen,
  Palette,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  rectIntersection,
  closestCenter,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { useDragToProjectStore } from '@/stores/drag-to-project-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { ProjectCreateDialog } from '@/components/project/project-create-dialog';
import { eventBus, EVENTS } from '@/lib/event-bus';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Project {
  id: string;
  name: string;
  color: string;
  isPrivate: boolean;
  groupId?: string | null;
}

interface ProjectGroupType {
  id: string;
  name: string;
  color: string;
  position: number;
}

function WorkspaceDropZone({ ws, disabled = false }: { ws: { id: string; name: string; slug: string }; disabled?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: `ws-drop-${ws.id}`, disabled });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border-2 border-dashed transition-all',
        isOver
          ? 'border-[#4285F4] bg-[#4285F4]/20 text-[#4285F4] scale-[1.02] shadow-md'
          : 'border-[#4285F4]/40 bg-[#4285F4]/5 text-g-text'
      )}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#4285F4] text-xs font-bold text-white">
        {ws.name.charAt(0)}
      </div>
      {ws.name}
    </div>
  );
}

function GroupDropZone({ groupId, children }: { groupId: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: `group-drop-${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md transition-all',
        isOver && 'ring-2 ring-[#4285F4] bg-[#4285F4]/10',
      )}
    >
      {children}
    </div>
  );
}

function UngroupedDropZone({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'group-drop-ungrouped' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-md transition-all',
        isOver && 'ring-2 ring-orange-400 bg-orange-400/10',
      )}
    >
      {children}
    </div>
  );
}

interface SortableProjectItemProps {
  project: Project;
  href: string;
  isActive: boolean;
  onDelete: (projectId: string) => void;
  onMoveToGroup?: (project: Project) => void;
  indented?: boolean;
}

function SortableProjectItem({ project, href, isActive, onDelete, onMoveToGroup, indented }: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });
  const { isDraggingTask, sourceProjectId } = useDragToProjectStore();
  const isDropCandidate = isDraggingTask && project.id !== sourceProjectId;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-project-drop-id={project.id}
      className={cn(
        'group/proj flex items-center rounded-md text-sm text-g-text-secondary hover:bg-g-border hover:text-g-text',
        isActive && 'bg-g-border font-medium text-g-text',
        isDragging && 'z-50 opacity-50',
        isDropCandidate && 'animate-pulse border-2 border-dashed border-[#4285F4] bg-[#4285F4]/10 shadow-[0_0_8px_rgba(66,133,244,0.4)]',
      )}
    >
      {!isDropCandidate && (
        <button
          {...attributes}
          {...listeners}
          className="flex shrink-0 cursor-grab items-center self-stretch px-1 text-g-text-muted hover:text-g-text-secondary active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <Link
        href={href}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-1',
          isDropCandidate && 'pl-2',
          indented && !isDropCandidate && 'pl-1',
        )}
      >
        <FolderKanban className={cn('h-4 w-4 shrink-0', isDropCandidate && 'h-5 w-5')} style={{ color: project.color }} />
        <span className={cn('truncate', isDropCandidate && 'font-medium text-[#4285F4]')}>{project.name}</span>
        {project.isPrivate && !isDropCandidate && <Lock className="ml-auto h-3 w-3 shrink-0 text-g-text-muted" />}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="mr-1 hidden shrink-0 rounded p-0.5 text-g-text-muted hover:bg-g-bg hover:text-g-text group-hover/proj:block"
            tabIndex={-1}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {onMoveToGroup && (
            <DropdownMenuItem onClick={() => onMoveToGroup(project)}>
              <ArrowRight className="mr-2 h-3.5 w-3.5" />
              グループに移動
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-red-500 focus:text-red-500"
            onClick={() => onDelete(project.id)}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface SidebarProps {
  projects?: Project[];
  projectGroups?: ProjectGroupType[];
  workspaceName?: string;
  currentWorkspaceSlug?: string;
  workspaceId?: string;
}

export function Sidebar({ projects: initialProjects = [], projectGroups: initialGroups = [], workspaceName = 'マイワークスペース', currentWorkspaceSlug = '', workspaceId = '' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const { theme, setTheme } = useTheme();
  const closeSidebar = useSidebarStore((s) => s.close);

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  useEffect(() => { setProjects(initialProjects); }, [initialProjects]);

  const [groups, setGroups] = useState<ProjectGroupType[]>(initialGroups);
  useEffect(() => { setGroups(initialGroups); }, [initialGroups]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  // グループ CRUD
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupCreateName, setGroupCreateName] = useState('');
  const [groupRenameTarget, setGroupRenameTarget] = useState<ProjectGroupType | null>(null);
  const [groupRenameName, setGroupRenameName] = useState('');
  const [groupDeleteTarget, setGroupDeleteTarget] = useState<ProjectGroupType | null>(null);
  const [groupColorTarget, setGroupColorTarget] = useState<ProjectGroupType | null>(null);
  const [groupColorValue, setGroupColorValue] = useState('#6B7280');
  const [moveToGroupProject, setMoveToGroupProject] = useState<Project | null>(null);

  const GROUP_COLORS = ['#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  const refetchProjects = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.map((p: Project & { isPrivate?: boolean; groupId?: string | null }) => ({
          id: p.id, name: p.name, color: p.color, isPrivate: p.isPrivate ?? false, groupId: p.groupId ?? null,
        })));
      }
    } catch {
      console.warn('Failed to fetch projects');
    }
  }, [workspaceId]);

  const refetchGroups = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/project-groups`);
      if (res.ok) {
        const data = await res.json();
        setGroups(data.map((g: ProjectGroupType) => ({ id: g.id, name: g.name, color: g.color, position: g.position })));
      }
    } catch {
      console.warn('Failed to fetch groups');
    }
  }, [workspaceId]);

  useEffect(() => {
    const unsub = eventBus.on(EVENTS.PROJECTS_CHANGED, () => { refetchProjects(); refetchGroups(); });
    return unsub;
  }, [refetchProjects, refetchGroups]);

  const handleGroupCreate = async () => {
    if (!groupCreateName.trim() || !workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/project-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupCreateName.trim() }),
      });
      if (res.ok) { await refetchGroups(); }
      else { toast({ title: 'グループの作成に失敗', variant: 'destructive' }); }
    } catch { toast({ title: 'グループの作成に失敗', variant: 'destructive' }); }
    setGroupCreateOpen(false);
    setGroupCreateName('');
  };

  const handleGroupRename = async () => {
    if (!groupRenameTarget || !groupRenameName.trim() || !workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/project-groups/${groupRenameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupRenameName.trim() }),
      });
      if (res.ok) { await refetchGroups(); }
      else { toast({ title: 'グループ名の変更に失敗', variant: 'destructive' }); }
    } catch { toast({ title: 'グループ名の変更に失敗', variant: 'destructive' }); }
    setGroupRenameTarget(null);
  };

  const handleGroupDelete = async () => {
    if (!groupDeleteTarget || !workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/project-groups/${groupDeleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) { await refetchGroups(); await refetchProjects(); }
      else { toast({ title: 'グループの削除に失敗', variant: 'destructive' }); }
    } catch { toast({ title: 'グループの削除に失敗', variant: 'destructive' }); }
    setGroupDeleteTarget(null);
  };

  const handleGroupColorChange = async (color: string) => {
    if (!groupColorTarget || !workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/project-groups/${groupColorTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      });
      if (res.ok) { await refetchGroups(); }
    } catch { /* ignore */ }
    setGroupColorTarget(null);
  };

  const handleMoveToGroup = async (groupId: string | null) => {
    if (!moveToGroupProject) return;
    try {
      const res = await fetch(`/api/projects/${moveToGroupProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId }),
      });
      if (res.ok) {
        setProjects(prev => prev.map(p => p.id === moveToGroupProject.id ? { ...p, groupId } : p));
      } else { toast({ title: 'グループ移動に失敗', variant: 'destructive' }); }
    } catch { toast({ title: 'グループ移動に失敗', variant: 'destructive' }); }
    setMoveToGroupProject(null);
  };
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);
  const [wsRenameTarget, setWsRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [wsRenameName, setWsRenameName] = useState('');
  const [wsDeleteTarget, setWsDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [wsCreateOpen, setWsCreateOpen] = useState(false);
  const [wsCreateName, setWsCreateName] = useState('');

  const fetchWorkspaces = useCallback(async (force = false) => {
    if (wsLoaded && !force) return;
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.map((w: { id: string; name: string; slug: string }) => ({ id: w.id, name: w.name, slug: w.slug })));
        setWsLoaded(true);
      }
    } catch {
      console.warn('Failed to fetch workspaces');
    }
  }, [wsLoaded]);

  // マウント時にワークスペース一覧をプリロード
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const handleWsRename = async () => {
    if (!wsRenameTarget || !wsRenameName.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${wsRenameTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsRenameName.trim() }),
      });
      if (res.ok) {
        setWsLoaded(false);
        if (workspaces.find((ws) => ws.id === wsRenameTarget.id)?.slug === currentWorkspaceSlug) {
          window.location.reload();
        }
      } else {
        toast({ title: 'ワークスペース名の変更に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'ワークスペース名の変更に失敗', variant: 'destructive' });
    }
    setWsRenameTarget(null);
  };

  const handleWsDelete = async () => {
    if (!wsDeleteTarget) return;
    try {
      const res = await fetch(`/api/workspaces/${wsDeleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setWsLoaded(false);
        const isCurrentWs = workspaces.find((ws) => ws.id === wsDeleteTarget.id)?.slug === currentWorkspaceSlug;
        if (isCurrentWs) {
          window.location.href = '/';
        }
      } else {
        toast({ title: 'ワークスペースの削除に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'ワークスペースの削除に失敗', variant: 'destructive' });
    }
    setWsDeleteTarget(null);
  };

  const handleWsCreate = async () => {
    if (!wsCreateName.trim()) return;
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsCreateName.trim() }),
      });
      if (res.ok) {
        const ws = await res.json();
        window.location.href = `/${ws.slug}`;
      } else {
        toast({ title: 'ワークスペースの作成に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'ワークスペースの作成に失敗', variant: 'destructive' });
    }
    setWsCreateOpen(false);
    setWsCreateName('');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // カスタム衝突検出: WSドロップ > sortable > グループドロップ
  // sortableを先にチェックし、プロジェクト上なら sortable を返す
  // グループヘッダー（プロジェクトがない空白部分）なら group-drop を返す
  const collisionDetection: CollisionDetection = useMemo(() => (args) => {
    const wsDropZones = args.droppableContainers.filter(c => String(c.id).startsWith('ws-drop-'));
    const groupDropZones = args.droppableContainers.filter(c => String(c.id).startsWith('group-drop-'));
    const sortables = args.droppableContainers.filter(c =>
      !String(c.id).startsWith('ws-drop-') && !String(c.id).startsWith('group-drop-')
    );

    // 1. WSドロップゾーンを最優先
    if (wsDropZones.length > 0) {
      const hits = args.pointerCoordinates
        ? pointerWithin({ ...args, droppableContainers: wsDropZones })
        : rectIntersection({ ...args, droppableContainers: wsDropZones });
      if (hits.length > 0) return hits;
    }

    // 2. sortable（プロジェクトアイテム）を先にチェック
    if (sortables.length > 0) {
      const sortableHits = pointerWithin({ ...args, droppableContainers: sortables });
      if (sortableHits.length > 0) return sortableHits;
    }

    // 3. グループドロップゾーン（ヘッダー部分や空グループ）
    if (groupDropZones.length > 0) {
      const hits = pointerWithin({ ...args, droppableContainers: groupDropZones });
      if (hits.length > 0) return hits;
    }

    // 4. フォールバック: closestCenter で最も近い sortable
    return closestCenter({ ...args, droppableContainers: sortables });
  }, []);

  const DROP_ANIMATION: DropAnimation = useMemo(() => ({
    duration: 200,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
  }), []);

  const otherWorkspaces = workspaces.filter(ws => ws.slug !== currentWorkspaceSlug);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const proj = projects.find((p) => p.id === event.active.id);
    if (proj) setActiveProject(proj);
  }, [projects]);

  const handleDragOver = useCallback((event: { over: { id: string | number } | null }) => {
    const overId = event.over ? String(event.over.id) : '';
    setIsOverDropZone(overId.startsWith('ws-drop-') || overId.startsWith('group-drop-'));
  }, []);

  // グループ移動の共通ロジック
  const moveProjectToGroup = useCallback((project: Project, newGroupId: string | null) => {
    if ((project.groupId ?? null) === newGroupId) return;
    const prevProjects = [...projects];
    setProjects(prev => prev.map(p =>
      p.id === project.id ? { ...p, groupId: newGroupId } : p
    ));
    const targetGroup = newGroupId ? groups.find(g => g.id === newGroupId) : null;
    fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: newGroupId }),
    })
      .then(res => {
        if (!res.ok) throw new Error();
        toast({ title: `「${project.name}」を${targetGroup?.name ?? '未分類'}に移動しました` });
      })
      .catch(() => {
        setProjects(prevProjects);
        toast({ title: 'グループ移動に失敗しました', variant: 'destructive' });
      });
  }, [projects, groups]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const draggedProject = activeProject;
    const currentPath = pathname;
    setActiveProject(null);
    setIsOverDropZone(false);

    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);

    // ★ グループドロップゾーンへのドロップ（ヘッダーや空グループ）
    if (overId.startsWith('group-drop-') && draggedProject) {
      const targetGroupId = overId.replace('group-drop-', '');
      const newGroupId = targetGroupId === 'ungrouped' ? null : targetGroupId;
      moveProjectToGroup(draggedProject, newGroupId);
      return;
    }

    // ★ ワークスペースドロップゾーンへのドロップ
    if (overId.startsWith('ws-drop-') && draggedProject) {
      const targetWsId = overId.replace('ws-drop-', '');
      const targetWs = workspaces.find(ws => ws.id === targetWsId);
      const prevProjects = [...projects];
      setProjects(prev => prev.filter(p => p.id !== draggedProject.id));

      fetch(`/api/projects/${draggedProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: targetWsId }),
      })
        .then(res => {
          if (!res.ok) throw new Error();
          toast({ title: `「${draggedProject.name}」を${targetWs?.name ?? '別のWS'}に移動しました` });
          if (currentPath?.includes(draggedProject.id) && targetWs) {
            router.push(`/${targetWs.slug}/projects/${draggedProject.id}`);
          }
        })
        .catch(() => {
          setProjects(prevProjects);
          toast({ title: '移動に失敗しました', variant: 'destructive' });
        });
      return;
    }

    // ★ sortable（プロジェクトアイテム）上にドロップ
    if (draggedProject) {
      const targetProject = projects.find(p => p.id === overId);
      if (targetProject) {
        const dragGroupId = draggedProject.groupId ?? null;
        const targetGroupId = targetProject.groupId ?? null;

        // 異なるグループ → グループ移動
        if (dragGroupId !== targetGroupId) {
          moveProjectToGroup(draggedProject, targetGroupId);
          return;
        }
      }
    }

    // ★ 同一グループ内の並べ替え
    if (active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const prevProjects = [...projects];
    const reordered = arrayMove(projects, oldIndex, newIndex);
    setProjects(reordered);

    fetch(`/api/workspaces/${workspaceId}/projects/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectIds: reordered.map((p) => p.id) }),
    }).catch(() => {
      setProjects(prevProjects);
      toast({ title: '並べ替えに失敗しました', variant: 'destructive' });
    });
  }, [activeProject, projects, workspaces, workspaceId, pathname, router, moveProjectToGroup]);

  const handleDragCancel = useCallback(() => {
    setActiveProject(null);
    setIsOverDropZone(false);
  }, []);

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } else {
        toast({ title: 'プロジェクトの削除に失敗', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'プロジェクトの削除に失敗', variant: 'destructive' });
    }
    setDeleteTarget(null);
  };

  const navItems = [
    {
      label: 'マイタスク',
      href: `/${currentWorkspaceSlug}/my-tasks`,
      icon: CheckSquare,
    },
    {
      label: 'ダッシュボード',
      href: `/${currentWorkspaceSlug}`,
      icon: LayoutDashboard,
    },
    {
      label: 'インボックス',
      href: `/${currentWorkspaceSlug}/inbox`,
      icon: Inbox,
    },
    {
      label: '議事録',
      href: `/${currentWorkspaceSlug}/meetings`,
      icon: FileText,
    },
    {
      label: 'AI秘書 (LINE)',
      href: `/${currentWorkspaceSlug}/settings/line`,
      icon: Bot,
    },
    {
      label: 'タスク取り込み',
      href: `/${currentWorkspaceSlug}/import-tasks`,
      icon: Download,
    },
    {
      label: 'GitHub Issues',
      href: `/${currentWorkspaceSlug}/import-github`,
      icon: Github,
    },
    {
      label: '設定',
      href: `/${currentWorkspaceSlug}/settings/members`,
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-full w-[240px] flex-col border-r border-g-border bg-g-surface">
      {/* Workspace header */}
      <div className="flex h-12 items-center gap-2 border-b border-g-border px-2">
        <DropdownMenu onOpenChange={(open) => { if (open) fetchWorkspaces(); }}>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-g-text hover:bg-g-border">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#4285F4] text-xs font-bold text-white">
                {workspaceName.charAt(0)}
              </div>
              <span className="truncate">{workspaceName}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-g-text-secondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <div className="px-2 py-1.5 text-xs font-medium text-g-text-muted">ワークスペース</div>
            {workspaces.map((ws) => (
              <div key={ws.id} className="group/ws flex items-center">
                <DropdownMenuItem asChild className="flex-1 min-w-0">
                  <Link href={`/${ws.slug}`} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#4285F4] text-[10px] font-bold text-white">
                      {ws.name.charAt(0)}
                    </div>
                    <span className="flex-1 truncate">{ws.name}</span>
                    {ws.slug === currentWorkspaceSlug && <Check className="h-4 w-4 shrink-0 text-[#34A853]" />}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="mr-1 shrink-0 rounded p-1 text-g-text-muted opacity-0 hover:bg-g-border hover:text-g-text group-hover/ws:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem asChild>
                      <Link href={`/${ws.slug}/settings/members`}>
                        <UserPlus className="mr-2 h-3.5 w-3.5" />
                        メンバー管理
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setWsRenameTarget({ id: ws.id, name: ws.name }); setWsRenameName(ws.name); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      名前を変更
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-500 focus:text-red-500"
                      onClick={() => setWsDeleteTarget({ id: ws.id, name: ws.name })}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setWsCreateOpen(true); setWsCreateName(''); }}>
              <Plus className="mr-2 h-4 w-4" />
              新規ワークスペース
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/${currentWorkspaceSlug}/settings/members`}>
                <Settings className="mr-2 h-4 w-4" />
                メンバー管理
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${currentWorkspaceSlug}/settings/projects`}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                プロジェクト権限
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${currentWorkspaceSlug}/settings/api-tokens`}>
                <Key className="mr-2 h-4 w-4" />
                APIトークン
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/${currentWorkspaceSlug}/settings/github`}>
                <Github className="mr-2 h-4 w-4" />
                GitHub連携
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={closeSidebar}
          className="shrink-0 rounded-md p-1.5 text-g-text-muted hover:bg-g-border hover:text-g-text"
          title="サイドバーを閉じる"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      >
        <ScrollArea className="flex-1 px-2 py-2">
          {/* Navigation */}
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-g-text-secondary hover:bg-g-border hover:text-g-text',
                  pathname === item.href && 'bg-g-border font-medium text-g-text'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Separator className="my-3 bg-g-border" />

          {/* Projects (grouped) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-g-text-muted">
                プロジェクト
              </span>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => { setGroupCreateOpen(true); setGroupCreateName(''); }}
                  className="rounded p-0.5 text-g-text-muted hover:bg-g-border hover:text-g-text"
                  title="グループ作成"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
                <ProjectCreateDialog workspaceId={workspaceId} workspaceSlug={currentWorkspaceSlug} />
              </div>
            </div>

            <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {/* Groups */}
              {groups.map((group) => {
                const groupProjects = projects.filter(p => p.groupId === group.id);
                const isCollapsed = collapsedGroups.has(group.id);
                return (
                  <GroupDropZone key={group.id} groupId={group.id}>
                    <div className="space-y-0.5">
                      <div className="group/grp flex items-center rounded-md text-sm hover:bg-g-border">
                        <button
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="shrink-0 p-1 text-g-text-muted"
                        >
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                        <Link
                          href={`/${currentWorkspaceSlug}/groups/${group.id}`}
                          className={cn(
                            'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-1 text-g-text-secondary hover:text-g-text',
                            pathname?.includes(`/groups/${group.id}`) && 'font-medium text-g-text',
                          )}
                        >
                          <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
                          <span className="truncate font-medium">{group.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-g-text-muted">{groupProjects.length}</span>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="mr-1 hidden shrink-0 rounded p-0.5 text-g-text-muted hover:bg-g-bg hover:text-g-text group-hover/grp:block" tabIndex={-1}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => { setGroupRenameTarget(group); setGroupRenameName(group.name); }}>
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              名前を変更
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setGroupColorTarget(group); setGroupColorValue(group.color); }}>
                              <Palette className="mr-2 h-3.5 w-3.5" />
                              色を変更
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => setGroupDeleteTarget(group)}>
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {!isCollapsed && groupProjects.map((project) => (
                        <div key={project.id} className="pl-4">
                          <SortableProjectItem
                            project={project}
                            href={`/${currentWorkspaceSlug}/projects/${project.id}`}
                            isActive={!!pathname?.includes(project.id)}
                            indented
                            onDelete={(id) => {
                              const p = projects.find((pr) => pr.id === id);
                              if (p) setDeleteTarget(p);
                            }}
                            onMoveToGroup={setMoveToGroupProject}
                          />
                        </div>
                      ))}
                    </div>
                  </GroupDropZone>
                );
              })}

              {/* Ungrouped projects */}
              {(() => {
                const ungrouped = projects.filter(p => !p.groupId);
                if (ungrouped.length === 0 && groups.length > 0) {
                  // グループがあるが未分類が空 → ドロップ先としては残す
                  return (
                    <UngroupedDropZone>
                      <div className="px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-g-text-muted">未分類</span>
                      </div>
                    </UngroupedDropZone>
                  );
                }
                return (
                  <UngroupedDropZone>
                    {groups.length > 0 && (
                      <div className="px-3 pt-2 pb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-g-text-muted">未分類</span>
                      </div>
                    )}
                    {ungrouped.map((project) => (
                      <SortableProjectItem
                        key={project.id}
                        project={project}
                        href={`/${currentWorkspaceSlug}/projects/${project.id}`}
                        isActive={!!pathname?.includes(project.id)}
                        onDelete={(id) => {
                          const p = projects.find((pr) => pr.id === id);
                          if (p) setDeleteTarget(p);
                        }}
                        onMoveToGroup={groups.length > 0 ? setMoveToGroupProject : undefined}
                      />
                    ))}
                  </UngroupedDropZone>
                );
              })()}
            </SortableContext>

            {projects.length === 0 && (
              <p className="px-3 py-2 text-xs text-g-text-muted">
                プロジェクトがありません
              </p>
            )}
          </div>
        </ScrollArea>

        {/* ワークスペースドロップゾーン: ScrollArea外・DndContext内に常時配置 */}
        {otherWorkspaces.length > 0 && (
          <div
            className={cn(
              'border-t border-g-border px-2 py-2 transition-opacity duration-150',
              activeProject
                ? 'opacity-100'
                : 'opacity-0 pointer-events-none'
            )}
          >
            <span className="block px-1 pb-1.5 text-[11px] font-semibold text-[#4285F4]">
              ↓ ワークスペースに移動
            </span>
            <div className="space-y-1.5">
              {otherWorkspaces.map(ws => (
                <WorkspaceDropZone key={ws.id} ws={ws} disabled={!activeProject} />
              ))}
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={isOverDropZone ? null : DROP_ANIMATION}>
          {activeProject ? (
            <div className="flex items-center gap-2 rounded-md bg-g-bg px-3 py-1.5 text-sm font-medium text-g-text shadow-xl ring-2 ring-[#4285F4]/30 scale-[1.02]">
              <FolderKanban className="h-4 w-4" style={{ color: activeProject.color }} />
              <span className="truncate">{activeProject.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Theme toggle + User menu */}
      <div className="border-t border-g-border p-2">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-g-text-secondary hover:bg-g-border hover:text-g-text"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'ライトモード' : 'ダークモード'}
        </button>
      </div>
      <div className="border-t border-g-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-g-border">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image ?? ''} />
                <AvatarFallback className="bg-[#4285F4] text-xs text-white">
                  {user?.name?.charAt(0) ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-g-text">{user?.name ?? 'ユーザー'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem className="text-xs text-g-text-secondary">
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
              <LogOut className="mr-2 h-4 w-4" />
              ログアウト
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Project delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プロジェクトを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteTarget && handleDeleteProject(deleteTarget.id)}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace rename dialog */}
      <AlertDialog open={!!wsRenameTarget} onOpenChange={(open) => { if (!open) setWsRenameTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ワークスペース名を変更</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            value={wsRenameName}
            onChange={(e) => setWsRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleWsRename(); }}
            className="w-full rounded border border-g-border px-3 py-2 text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleWsRename} disabled={!wsRenameName.trim()}>
              変更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace delete dialog */}
      <AlertDialog open={!!wsDeleteTarget} onOpenChange={(open) => { if (!open) setWsDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ワークスペースを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{wsDeleteTarget?.name}」を削除しますか？含まれるプロジェクト・タスクも全て削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={handleWsDelete}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workspace create dialog */}
      <AlertDialog open={wsCreateOpen} onOpenChange={setWsCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新規ワークスペース</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            value={wsCreateName}
            onChange={(e) => setWsCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleWsCreate(); }}
            placeholder="ワークスペース名"
            className="w-full rounded border border-g-border px-3 py-2 text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleWsCreate} disabled={!wsCreateName.trim()}>
              作成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group create dialog */}
      <AlertDialog open={groupCreateOpen} onOpenChange={setGroupCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>新規グループ</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            value={groupCreateName}
            onChange={(e) => setGroupCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGroupCreate(); }}
            placeholder="グループ名"
            className="w-full rounded border border-g-border px-3 py-2 text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleGroupCreate} disabled={!groupCreateName.trim()}>
              作成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group rename dialog */}
      <AlertDialog open={!!groupRenameTarget} onOpenChange={(open) => { if (!open) setGroupRenameTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グループ名を変更</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            value={groupRenameName}
            onChange={(e) => setGroupRenameName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGroupRename(); }}
            className="w-full rounded border border-g-border px-3 py-2 text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleGroupRename} disabled={!groupRenameName.trim()}>
              変更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group delete dialog */}
      <AlertDialog open={!!groupDeleteTarget} onOpenChange={(open) => { if (!open) setGroupDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グループを削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{groupDeleteTarget?.name}」を削除しますか？グループ内のプロジェクトは未分類になります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={handleGroupDelete}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group color dialog */}
      <AlertDialog open={!!groupColorTarget} onOpenChange={(open) => { if (!open) setGroupColorTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グループの色を変更</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="flex flex-wrap gap-2">
            {GROUP_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => handleGroupColorChange(c)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform hover:scale-110',
                  groupColorValue === c ? 'border-g-text scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>閉じる</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to group dialog */}
      <AlertDialog open={!!moveToGroupProject} onOpenChange={(open) => { if (!open) setMoveToGroupProject(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{moveToGroupProject?.name}」をグループに移動</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-1">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleMoveToGroup(g.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-g-border',
                  moveToGroupProject?.groupId === g.id && 'bg-g-border font-medium',
                )}
              >
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: g.color }} />
                {g.name}
                {moveToGroupProject?.groupId === g.id && <Check className="ml-auto h-4 w-4 text-green-500" />}
              </button>
            ))}
            <button
              onClick={() => handleMoveToGroup(null)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-g-border',
                !moveToGroupProject?.groupId && 'bg-g-border font-medium',
              )}
            >
              <div className="h-3 w-3 rounded-sm bg-gray-300" />
              未分類
              {!moveToGroupProject?.groupId && <Check className="ml-auto h-4 w-4 text-green-500" />}
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
