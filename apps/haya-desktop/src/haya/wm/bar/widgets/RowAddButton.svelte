<script lang="ts">
  import Button from "../../../components/Button.svelte";
  import Icon from "../../../components/Icon.svelte";
  import { startAddRow, wm } from "../../store.svelte";
  import { notify } from "../../../notify.svelte";

  // Opens the details panel in add mode. Needs a table row first, so the columns are known.
  function add() {
    if (!startAddRow()) notify("error", "Click a row in the table first, so the new row knows its columns.");
  }
</script>

<Button variant="icon" label="Add row" active={wm.detailsMode === "add"} onclick={add}>
  <Icon name="plus" />
</Button>
