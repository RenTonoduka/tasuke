'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Check,
  CheckSquare,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Inbox,
  Sun,
  Moon,
  GripVertical,
  Lock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ProjectCreateDialog } from '@/components/project/project-create-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Project {
  id: string;
  name: string;
  color: string;
  isPrivate: boolean;
}

interface SortableProjectItemProps {
  project: Project;
  href: string;
  isActive: boolean;
}

function SortableProjectItem({ project, href, isActive }: SortableProjectItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center rounded-md text-sm text-g-text-secondary hover:bg-g-border hover:text-g-text',
        isActive && 'bg-g-border font-medium text-g-text',
        isDragging && 'z-50 opacity-50'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="flex shrink-0 cursor-grab items-center self-stretch px-1 text-g-text-muted hover:text-g-text-secondary active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3"
      >
        <FolderKanban className="h-4 w-4 shrink-0" style={{ color: project.color }} />
        <span className="truncate">{project.name}</span>
        {project.isPrivate && <Lock className="ml-auto h-3 w-3 shrink-0 text-g-text-muted" />}
      </Link>
    </div>
  );
}

interface SidebarProps {
  projects?: Project[];
  workspaceName?: string;
  currentWorkspaceSlug?: string;
  workspaceId?: string;
}

export function Sidebar({ projects: initialProjects = [], workspaceName = 'マイワークスペース', currentWorkspaceSlug = '', workspaceId = '' }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const { theme, setTheme } = useTheme();

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [wsLoaded, setWsLoaded] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    if (wsLoaded) return;
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.map((w: { id: string; name: string; slug: string }) => ({ id: w.id, name: w.name, slug: w.slug })));
        setWsLoaded(true);
      }
    } catch {}
  }, [wsLoaded]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    const proj = projects.find((p) => p.id === event.active.id);
    if (proj) setActiveProject(proj);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveProject(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(projects, oldIndex, newIndex);
    setProjects(reordered);

    try {
      await fetch(`/api/workspaces/${workspaceId}/projects/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: reordered.map((p) => p.id) }),
      });
    } catch {
      setProjects(initialProjects);
    }
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
      label: '設定',
      href: `/${currentWorkspaceSlug}/settings/members`,
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-full w-[240px] flex-col border-r border-g-border bg-g-surface">
      {/* Workspace header */}
      <div className="flex h-12 items-center gap-2 border-b border-g-border px-4">
        <DropdownMenu onOpenChange={(open) => { if (open) fetchWorkspaces(); }}>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-g-text hover:bg-g-border">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#4285F4] text-xs font-bold text-white">
                {workspaceName.charAt(0)}
              </div>
              <span className="truncate">{workspaceName}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-g-text-secondary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {workspaces.length > 1 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-g-text-muted">ワークスペース</div>
                {workspaces.map((ws) => (
                  <DropdownMenuItem key={ws.id} asChild>
                    <Link href={`/${ws.slug}`} className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded bg-[#4285F4] text-[10px] font-bold text-white">
                        {ws.name.charAt(0)}
                      </div>
                      <span className="flex-1 truncate">{ws.name}</span>
                      {ws.slug === currentWorkspaceSlug && <Check className="h-4 w-4 text-[#34A853]" />}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem asChild>
              <Link href={`/${currentWorkspaceSlug}/settings/members`}>
                <Settings className="mr-2 h-4 w-4" />
                メンバー管理
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

        {/* Projects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-g-text-muted">
              プロジェクト
            </span>
            <ProjectCreateDialog workspaceId={workspaceId} workspaceSlug={currentWorkspaceSlug} />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {projects.map((project) => (
                <SortableProjectItem
                  key={project.id}
                  project={project}
                  href={`/${currentWorkspaceSlug}/projects/${project.id}`}
                  isActive={!!pathname?.includes(project.id)}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeProject ? (
                <div className="flex items-center gap-2 rounded-md bg-g-bg px-3 py-1.5 text-sm font-medium text-g-text shadow-lg ring-1 ring-g-border">
                  <FolderKanban className="h-4 w-4" style={{ color: activeProject.color }} />
                  <span className="truncate">{activeProject.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {projects.length === 0 && (
            <p className="px-3 py-2 text-xs text-g-text-muted">
              プロジェクトがありません
            </p>
          )}
        </div>
      </ScrollArea>

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
    </div>
  );
}
