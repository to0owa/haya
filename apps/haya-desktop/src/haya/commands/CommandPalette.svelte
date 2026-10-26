<script lang="ts">
  import { tick } from "svelte";
  import { COMMANDS } from "./commands";
  import { closePalette, palette } from "./palette.svelte";

  let query = $state("");
  let index = $state(0);
  let input: HTMLInputElement | undefined = $state();

  const matches = $derived(
    COMMANDS.filter((command) => command.label.toLowerCase().includes(query.trim().toLowerCase())),
  );

  // Each time the palette opens: clear the query, select the first match, focus the input.
  $effect(() => {
    if (!palette.open) return;
    query = "";
    index = 0;
    tick().then(() => input?.focus());
  });

  function run(command: (typeof COMMANDS)[number] | undefined) {
    if (!command) return;
    closePalette();
    command.run();
  }

  function onkey(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      index = Math.min(index + 1, matches.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      index = Math.max(index - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(matches[index]);
    } else if (event.key === "Escape") {
      closePalette();
    }
  }
</script>

{#if palette.open}
  <div class="haya-palette-scrim" role="presentation" onmousedown={(e) => e.target === e.currentTarget && closePalette()}>
    <div class="haya-palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <input
        class="haya-palette-input"
        placeholder="Type a command"
        bind:value={query}
        bind:this={input}
        oninput={() => (index = 0)}
        onkeydown={onkey}
        aria-label="Command"
      />
      <div class="haya-palette-list" role="listbox">
        {#each matches as command, i (command.label)}
          <button
            class="haya-palette-item"
            class:is-on={i === index}
            role="option"
            aria-selected={i === index}
            onmouseenter={() => (index = i)}
            onclick={() => run(command)}
          >
            <span>{command.label}</span>
            {#if command.shortcut}<kbd>{command.shortcut}</kbd>{/if}
          </button>
        {:else}
          <div class="haya-palette-empty">No command matches "{query}"</div>
        {/each}
      </div>
    </div>
  </div>
{/if}
