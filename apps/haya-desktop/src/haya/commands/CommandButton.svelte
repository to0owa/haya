<script lang="ts">
  import Button from "../components/Button.svelte";
  import { togglePalette } from "./palette.svelte";
</script>

<Button variant="text" label="Command palette (⇧⌘P)" onclick={togglePalette}>commands</Button>
