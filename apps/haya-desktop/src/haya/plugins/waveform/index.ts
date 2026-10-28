import type { Plugin } from "../api";
import Waveform from "./Waveform.svelte";

// Bars that rise with terminal output. The widget id stays "waveform" so saved toolbar layouts keep working.
export const plugin: Plugin = {
  manifest: {
    id: "haya.waveform",
    name: "Waveform",
    version: "1.0.0",
    description: "Bars that rise with terminal output and settle when idle.",
  },
  activate(context) {
    context.registerWidget({ id: "waveform", label: "Waveform", component: Waveform });
  },
};
