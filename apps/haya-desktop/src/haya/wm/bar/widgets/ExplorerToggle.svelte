<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { toggleExplorer, wm } from "../../store.svelte";
</script>

<Button variant="icon" label="Explorer (⌘B)" active={wm.leftView === "explorer"} onclick={toggleExplorer}>
  <Icon name="folder" />
</Button>
