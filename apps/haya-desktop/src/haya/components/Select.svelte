<script lang="ts">
  import Icon from "./Icon.svelte";

  export interface SelectItem {
    value: string;
    label: string;
    /** Short mark shown before the label, such as "PG". */
    badge?: string;
    /** Small grey note at the end of the row, such as "upload". */
    hint?: string;
  }

  // A dropdown: the trigger shows the current choice, and the list opens below it. Closes on a choice, a click outside, or Escape.
  // An optional action sits under the list, after a divider, for things like "Add driver…".
  let {
    value,
    items,
    label,
    onchange,
    action,
  }: {
    value: string;
    items: SelectItem[];
    label: string;
    onchange: (value: string) => void;
    action?: { label: string; onselect: () => void };
  } = $props();

  let open = $state(false);
  const current = $derived(items.find((item) => item.value === value));

  function choose(item: SelectItem) {
    open = false;
    onchange(item.value);
  }

  function onpointer(event: MouseEvent) {
    if (open && !(event.target as HTMLElement).closest(".haya-select")) open = false;
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") open = false;
  }
</script>

<svelte:window onmousedown={onpointer} onkeydown={onkey} />

<div class="haya-select">
  <button class="haya-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onclick={() => (open = !open)}>
    {#if current?.badge}<span class="haya-select-badge">{current.badge}</span>{/if}
    <span class="haya-select-name">{current?.label ?? "Choose"}</span>
    <Icon name="chevron-down" />
  </button>
  {#if open}
    <div class="haya-select-list" role="listbox" aria-label={label}>
      {#each items as item (item.value)}
        <button class="haya-select-item" class:is-on={item.value === value} role="option" aria-selected={item.value === value} onclick={() => choose(item)}>
          {#if item.badge}<span class="haya-select-badge">{item.badge}</span>{/if}
          <span class="haya-select-name">{item.label}</span>
          {#if item.hint}<span class="haya-select-hint">{item.hint}</span>{/if}
        </button>
      {/each}
      {#if action}
        <div class="haya-select-divider"></div>
        <button class="haya-select-item haya-select-action" onclick={() => { open = false; action.onselect(); }}>
          <span class="haya-select-name">{action.label}</span>
        </button>
      {/if}
    </div>
  {/if}
</div>
