// Events the app raises for plugins. Terminal output is the first one.

const outputListeners = new Set<() => void>();

/** Called for every chunk of terminal output. Keep listeners cheap: they run on each chunk. */
export function emitTerminalOutput() {
  for (const listener of outputListeners) listener();
}

export function onTerminalOutput(listener: () => void): () => void {
  outputListeners.add(listener);
  return () => {
    outputListeners.delete(listener);
  };
}
