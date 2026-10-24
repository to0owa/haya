// The first chat message creates the task record, so title and goal are derived
// from it instead of asking the user to fill a separate form.
const MAX_TITLE = 80;
const MAX_GOAL = 32000;

export function deriveTaskTitle(text: string, attachmentCount = 0): string {
	const line = text.replace(/\s+/g, ' ').trim();
	if (!line) return attachmentCount ? 'Review attached files' : 'New task';
	const characters = Array.from(line);
	if (characters.length <= MAX_TITLE) return line;
	const clipped = characters.slice(0, MAX_TITLE).join('');
	const boundary = clipped.lastIndexOf(' ');
	const base = boundary > MAX_TITLE / 2 ? clipped.slice(0, boundary) : clipped;
	return `${base.trimEnd()}…`;
}

export function deriveTaskGoal(text: string, attachmentCount = 0): string {
	const trimmed = text.trim();
	if (!trimmed) return attachmentCount ? 'Review the attached files.' : '';
	const characters = Array.from(trimmed);
	return characters.length > MAX_GOAL ? `${characters.slice(0, MAX_GOAL - 1).join('')}…` : trimmed;
}

export function deriveTaskMessage(text: string, attachmentCount = 0): string {
	return text.trim() || (attachmentCount ? 'Please review the attached files.' : '');
}
