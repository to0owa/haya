export type SidebarMode = 'expanded' | 'compact' | 'mini';
export type PreviewTab = 'brief' | 'activity' | 'tasks' | 'team';
export type MemberName = 'Maestro' | 'Virtuoso' | 'Soundcheck';
export type View = 'overview' | 'editor' | 'board' | 'team';
export type BoardLayout = 'horizontal' | 'vertical';

export const members: { name: MemberName; role: string; state: string }[] = [
	{ name: 'Maestro', role: 'Project manager', state: 'Thinking' },
	{ name: 'Virtuoso', role: 'Svelte builder', state: 'Working' },
	{ name: 'Soundcheck', role: 'Tester', state: 'Testing' }
];

export const tasks = [
	{ title: 'Storefront brief', icon: 'plan', initial: '•', assignee: '' },
	{ title: 'Build catalog and product pages', icon: 'virt', initial: 'V', assignee: 'Virtuoso' },
	{ title: 'Verify contact flow', icon: 'sound', initial: 'S', assignee: 'Soundcheck' },
	{ title: 'Add product photography', icon: 'photo', initial: 'P', assignee: '' }
];

export const threads = ['Storefront planning', 'Product brief review', 'Untitled request'] as const;
