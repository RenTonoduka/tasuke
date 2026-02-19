'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useTaskPanelStore } from '@/stores/task-panel-store';
import {
  CheckSquare,
  Inbox,
  LayoutDashboard,
  Settings,
  FolderOpen,
  Plus,
  FileText,
  Circle,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';

interface SearchTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  project: { name: string; color: string };
}

interface CommandPaletteProps {
  workspaceSlug: string;
  projects: { id: string; name: string; color: string }[];
}

const PAGE_ITEMS = [
  { label: 'マイタスク', icon: CheckSquare, path: '/my-tasks' },
  { label: 'インボックス', icon: Inbox, path: '/inbox' },
  { label: 'ダッシュボード', icon: LayoutDashboard, path: '/dashboard' },
  { label: '設定', icon: Settings, path: '/settings' },
];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'DONE':
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case 'IN_PROGRESS':
      return <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
    case 'CANCELLED':
      return <Ban className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-gray-400 shrink-0" />;
  }
}

export function CommandPalette({ workspaceSlug, projects }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchTask[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const openPanel = useTaskPanelStore((s) => s.open);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSearch = useCallback(
    async (value: string) => {
      setQuery(value);
      if (value.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/tasks/search?q=${encodeURIComponent(value)}&workspaceSlug=${encodeURIComponent(workspaceSlug)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceSlug]
  );

  const handleClose = () => {
    setOpen(false);
    setQuery('');
    setSearchResults([]);
  };

  const navigateTo = (path: string) => {
    handleClose();
    router.push(`/${workspaceSlug}${path}`);
  };

  const openTask = (taskId: string) => {
    handleClose();
    openPanel(taskId);
  };

  const createTask = () => {
    handleClose();
    router.push(`/${workspaceSlug}/my-tasks?create=task`);
  };

  const createProject = () => {
    handleClose();
    router.push(`/${workspaceSlug}/projects?create=project`);
  };

  const showSearch = query.length >= 2;
  const showDefault = query.length < 2;

  return (
    <CommandDialog open={open} onOpenChange={handleClose}>
      <CommandInput
        placeholder="コマンドを入力..."
        value={query}
        onValueChange={handleSearch}
      />
      <CommandList className="max-h-[420px]">
        {showSearch && (
          <>
            {isSearching ? (
              <div className="py-6 text-center text-sm text-[#5F6368]">検索中...</div>
            ) : searchResults.length > 0 ? (
              <CommandGroup heading="タスク検索結果">
                {searchResults.map((task) => (
                  <CommandItem
                    key={task.id}
                    value={`task-${task.id}-${task.title}`}
                    onSelect={() => openTask(task.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <StatusIcon status={task.status} />
                    <span className="flex-1 truncate text-[#202124]">{task.title}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: task.project.color }}
                      />
                      <span className="text-xs text-[#5F6368] truncate max-w-[120px]">
                        {task.project.name}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <CommandEmpty>タスクが見つかりません</CommandEmpty>
            )}
          </>
        )}

        {showDefault && (
          <>
            <CommandGroup heading="ページ移動">
              {PAGE_ITEMS.map((item) => (
                <CommandItem
                  key={item.path}
                  value={`page-${item.label}`}
                  onSelect={() => navigateTo(item.path)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <item.icon className="h-4 w-4 text-[#5F6368]" />
                  <span className="text-[#202124]">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {projects.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="プロジェクト">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project-${project.id}-${project.name}`}
                      onSelect={() => navigateTo(`/projects/${project.id}`)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <FolderOpen
                        className="h-4 w-4 shrink-0"
                        style={{ color: project.color }}
                      />
                      <span className="text-[#202124] truncate">{project.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator />
            <CommandGroup heading="アクション">
              <CommandItem
                value="action-create-task"
                onSelect={createTask}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-[#5F6368]" />
                <span className="text-[#202124]">新規タスク作成</span>
              </CommandItem>
              <CommandItem
                value="action-create-project"
                onSelect={createProject}
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4 text-[#5F6368]" />
                <span className="text-[#202124]">新規プロジェクト作成</span>
              </CommandItem>
            </CommandGroup>

            <div className="border-t px-3 py-2">
              <p className="text-xs text-[#5F6368]">2文字以上入力するとタスクを検索します</p>
            </div>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
