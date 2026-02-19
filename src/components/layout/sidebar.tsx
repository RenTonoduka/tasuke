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
} from 'lucide-react';
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
  ];

  return (
    <div className="flex h-full w-[240px] flex-col border-r border-[#E8EAED] bg-[#F8F9FA]">
      {/* Workspace header */}
      <div className="flex h-12 items-center gap-2 border-b border-[#E8EAED] px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold text-[#202124] hover:bg-[#E8EAED]">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#4285F4] text-xs font-bold text-white">
                {workspaceName.charAt(0)}
              </div>
              <span className="truncate">{workspaceName}</span>
              <ChevronDown className="ml-auto h-4 w-4 text-[#5F6368]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem disabled>
              <Settings className="mr-2 h-4 w-4" />
              ワークスペース設定（準備中）
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
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[#5F6368] hover:bg-[#E8EAED] hover:text-[#202124]',
                pathname === item.href && 'bg-[#E8EAED] font-medium text-[#202124]'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator className="my-3 bg-[#E8EAED]" />

        {/* Projects */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#80868B]">
              プロジェクト
            </span>
            <ProjectCreateDialog workspaceId={workspaceId} workspaceSlug={currentWorkspaceSlug} />
          </div>
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/${currentWorkspaceSlug}/projects/${project.id}`}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-[#5F6368] hover:bg-[#E8EAED] hover:text-[#202124]',
                pathname?.includes(project.id) && 'bg-[#E8EAED] font-medium text-[#202124]'
              )}
            >
              <FolderKanban className="h-4 w-4" style={{ color: project.color }} />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-xs text-[#80868B]">
              プロジェクトがありません
            </p>
          )}
        </div>
      </ScrollArea>

      {/* User menu */}
      <div className="border-t border-[#E8EAED] p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#E8EAED]">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user?.image ?? ''} />
                <AvatarFallback className="bg-[#4285F4] text-xs text-white">
                  {user?.name?.charAt(0) ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm text-[#202124]">{user?.name ?? 'ユーザー'}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem className="text-xs text-[#5F6368]">
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
