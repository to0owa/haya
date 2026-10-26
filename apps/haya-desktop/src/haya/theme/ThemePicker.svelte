<script lang="ts">
  import ThemeList from "./ThemeList.svelte";
  import { closePicker } from "./theme.svelte";

  function onkey(event: KeyboardEvent) {
    if (event.key === "Escape") closePicker();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="haya-theme-picker">
  <ThemeList />
</div>
