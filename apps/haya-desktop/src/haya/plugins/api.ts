// The plugin API. A plugin describes itself with a manifest, then activate() adds what it contributes.
// Today plugins are built in. A marketplace would load the same shape from installed packages.
import type { Component } from "svelte";

export interface PluginManifest {
  /** Unique and stable, for example "haya.waveform". Used to refer to the plugin, never shown as a label. */
  id: string;
  name: string;
  version: string;
  description: string;
}

/** A toolbar widget a plugin adds. Its id is stored in the saved layout, so keep it stable. */
export interface WidgetContribution {
  id: string;
  label: string;
  // Widgets take no props today, so the component type is open. Tighten it when a widget needs props.
  component: Component<any>;
}

export interface PluginContext {
  registerWidget(widget: WidgetContribution): void;
  /** Runs after every chunk of terminal output. Returns a function that stops the listening. */
  onTerminalOutput(listener: () => void): () => void;
}

export interface Plugin {
  manifest: PluginManifest;
  activate(context: PluginContext): void;
}
