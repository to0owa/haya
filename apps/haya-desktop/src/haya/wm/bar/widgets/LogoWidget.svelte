<script lang="ts">
  import HayaLogo from "../../../components/HayaLogo.svelte";
  import { widgetSetting } from "../../store.svelte";

  const variant = $derived(widgetSetting("logo", "variant", "compact") === "full" ? "full" : "compact");
</script>

<HayaLogo {variant} />
