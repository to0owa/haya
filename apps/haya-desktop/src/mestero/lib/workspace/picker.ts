export type PickerView = 'list' | 'grid';
export type PickerFolder = { name: string; path: string };

export const PICKER_VIEW_KEY = 'mestero-picker-view';

export function normalizePickerPath(value: string): string {
	const parts: string[] = [];
	for (const part of value.replace(/\\/g, '/').split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') {
			parts.pop();
			continue;
		}
		parts.push(part);
	}
	return `/${parts.join('/')}`;
}

export function expandPickerHome(value: string, home?: string): string | null {
	if (value !== '~' && !value.startsWith('~/')) return value;
	if (!home) return null;
	return normalizePickerPath(value === '~' ? home : `${home}/${value.slice(2)}`);
}

function firstSegment(value: string): string {
	return value.split('/').find(part => part && part !== '.') || '';
}

/** The name fragment to filter the current folder by while the address bar is edited. */
export function pickerFilter(value: string, currentPath: string): string {
	const trimmed = value.trim();
	if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed.startsWith('../')) return '';
	if (trimmed === '~' || trimmed.startsWith('~/')) return '';
	if (trimmed.startsWith('/')) {
		const current = normalizePickerPath(currentPath);
		const typed = normalizePickerPath(trimmed);
		const prefix = current === '/' ? '/' : `${current}/`;
		if (typed === current || !typed.startsWith(prefix)) return '';
		return firstSegment(typed.slice(prefix.length));
	}
	return firstSegment(trimmed);
}

function matchFirstSegment(current: string, typed: string, folders: readonly PickerFolder[]): string {
	if (typed === current) return current;
	const prefix = current === '/' ? '/' : `${current}/`;
	if (!typed.startsWith(prefix)) return typed;
	const [first, ...more] = typed.slice(prefix.length).split('/');
	const match = folders.find(folder => folder.name.toLocaleLowerCase() === first.toLocaleLowerCase());
	if (match) return more.length ? normalizePickerPath(`${match.path}/${more.join('/')}`) : match.path;
	if (more.length) return typed;
	const partial = folders.filter(folder => folder.name.toLocaleLowerCase().startsWith(first.toLocaleLowerCase()));
	return partial.length === 1 ? partial[0].path : typed;
}

/** Absolute path for a typed value, or null when `~` is used without a Home location. */
export function resolvePickerPath(value: string, currentPath: string, home: string | undefined, folders: readonly PickerFolder[]): string | null {
	const trimmed = value.trim();
	const current = normalizePickerPath(currentPath);
	if (!trimmed) return current;
	const expanded = expandPickerHome(trimmed, home);
	if (expanded === null) return null;
	const typed = expanded.startsWith('/') ? normalizePickerPath(expanded) : normalizePickerPath(`${current === '/' ? '' : current}/${trimmed}`);
	return matchFirstSegment(current, typed, folders);
}

/** Whether Enter should offer to open the typed value instead of only filtering. */
export function pickerTargetIsNavigable(value: string, folders: readonly PickerFolder[]): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (trimmed.startsWith('/') || trimmed === '~' || trimmed.startsWith('~/') || trimmed === '..' || trimmed.startsWith('../')) return true;
	const first = firstSegment(trimmed);
	if (!first) return false;
	const matches = folders.filter(folder => folder.name.toLocaleLowerCase().startsWith(first.toLocaleLowerCase()));
	return matches.length === 1;
}

function browserStorage(): Storage | undefined {
	try { return typeof window === 'undefined' ? undefined : window.localStorage; }
	catch { return undefined; }
}

export function readPickerView(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): PickerView {
	try { return storage?.getItem(PICKER_VIEW_KEY) === 'grid' ? 'grid' : 'list'; }
	catch { return 'list'; }
}

export function writePickerView(view: PickerView, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()): boolean {
	if (!storage) return false;
	try { storage.setItem(PICKER_VIEW_KEY, view); return true; }
	catch { return false; }
}
