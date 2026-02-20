'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  CheckSquare,
  FolderKanban,
  Settings,
  LogOut,
  ChevronDown,
  LayoutDashboard,
  Inbox,
  Sun,
  Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
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
}

interface SidebarProps {
  projects?: Project[];
  workspaceName?: string;
  currentWorkspaceSlug?: string;
  workspaceId?: string;
}

export function Sidebar({ projects = [], workspaceName = 'マイワークスペース', currentWorkspaceSlug = '', workspaceId = '' }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const { theme, setTheme } = useTheme();

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
        <DropdownMenu>
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
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/${currentWorkspaceSlug}/projects/${project.id}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-g-text-secondary hover:bg-g-border hover:text-g-text',
                pathname?.includes(project.id) && 'bg-g-border font-medium text-g-text'
              )}
            >
              <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
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
