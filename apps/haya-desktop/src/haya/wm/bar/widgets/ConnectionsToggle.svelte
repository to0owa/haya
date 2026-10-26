<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { toggleConnections, wm } from "../../store.svelte";
</script>

<Button variant="icon" label="Connections" active={wm.leftView === "connections"} onclick={toggleConnections}>
  <Icon name="database" />
</Button>
