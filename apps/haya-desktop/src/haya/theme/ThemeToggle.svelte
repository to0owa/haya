<script lang="ts">
  import Button from "../components/Button.svelte";
  import Icon from "../components/Icon.svelte";
  import ThemePicker from "./ThemePicker.svelte";
  import { themeState, togglePicker } from "./theme.svelte";
</script>

<div class="haya-theme-toggle">
  <Button variant="icon" label="Color theme" active={themeState.pickerOpen} onclick={togglePicker}>
    <Icon name="palette" />
  </Button>
  {#if themeState.pickerOpen}
    <ThemePicker />
  {/if}
</div>
