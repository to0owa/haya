<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { toggleLeftPanel, wm } from "../../store.svelte";
</script>

<Button variant="icon" label="Toggle left panel" active={wm.leftView !== null} onclick={toggleLeftPanel}>
  <Icon name="panel-left" />
</Button>
