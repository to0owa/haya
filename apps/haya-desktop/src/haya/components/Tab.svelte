<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  // A single tab. The icon on the left turns into a close button while the tab is hovered or focused.
  let {
    label,
    icon,
    selected = false,
    onselect,
    onclose,
  }: { label: string; icon: IconName; selected?: boolean; onselect: () => void; onclose: () => void } = $props();
</script>

<div class="haya-tab" class:is-selected={selected} role="tab" aria-selected={selected} tabindex="0" onclick={onselect} onkeydown={(e) => e.key === "Enter" && onselect()}>
  <span class="haya-tab-mark">
    <span class="haya-tab-icon"><Icon name={icon} /></span>
    <span class="haya-tab-close" role="button" tabindex="-1" aria-label="Close {label}" onclick={(e) => { e.stopPropagation(); onclose(); }}>
      <Icon name="close" />
    </span>
  </span>
  <span class="haya-tab-label">{label}</span>
</div>
