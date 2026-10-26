<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { toggleRight, wm } from "../../store.svelte";
</script>

<Button variant="icon" label="Toggle right panel" active={wm.rightOpen} onclick={toggleRight}>
  <Icon name="panel-right" />
</Button>
