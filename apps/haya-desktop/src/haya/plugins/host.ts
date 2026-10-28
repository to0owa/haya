// Loads the built-in plugins and collects what they contribute. Ids must not clash with core widgets;
// the registry checks that when it merges the lists.
import type { Plugin, WidgetContribution } from "./api";
import { onTerminalOutput } from "./events";
import { plugin as waveform } from "./waveform";

const BUILTIN: Plugin[] = [waveform];

const contributed = new Map<string, WidgetContribution>();

for (const plugin of BUILTIN) {
  plugin.activate({
    registerWidget(widget) {
      if (contributed.has(widget.id)) {
        throw new Error(`Widget "${widget.id}" is registered twice (second by ${plugin.manifest.id})`);
      }
      contributed.set(widget.id, widget);
    },
    onTerminalOutput,
  });
}

export const pluginWidgets: WidgetContribution[] = [...contributed.values()];
