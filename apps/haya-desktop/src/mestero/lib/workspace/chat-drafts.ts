const KEY = 'mestero-chat-drafts';

export function readChatDrafts(): Record<string, string> {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
		if (stored?.version !== 1 || !stored.drafts || typeof stored.drafts !== 'object' || Array.isArray(stored.drafts)) return {};
		return Object.fromEntries(Object.entries(stored.drafts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
	} catch { return {}; }
}

export function writeChatDrafts(drafts: Record<string, string>): void {
	try {
		const entries = Object.entries(drafts).filter(([, text]) => text.length > 0);
		if (entries.length) localStorage.setItem(KEY, JSON.stringify({ version: 1, drafts: Object.fromEntries(entries) }));
		else localStorage.removeItem(KEY);
	} catch { /* The current draft stays usable when storage is unavailable. */ }
}
