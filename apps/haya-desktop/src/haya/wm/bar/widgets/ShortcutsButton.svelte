<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { openPreferences } from "../../../preferences/prefs-state.svelte";
</script>

<Button variant="icon" label="Keyboard shortcuts" onclick={() => openPreferences("shortcuts")}>
  <Icon name="keyboard" />
</Button>
