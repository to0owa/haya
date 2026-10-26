<script lang="ts">
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import type { Toast as ToastData } from "../notify.svelte";

  let { toast, ondismiss }: { toast: ToastData; ondismiss: () => void } = $props();
</script>

<div class="haya-toast" class:is-error={toast.kind === "error"} class:is-success={toast.kind === "success"}>
  <span class="haya-toast-message">{toast.message}</span>
  <Button variant="icon" label="Dismiss" onclick={ondismiss}><Icon name="close" /></Button>
</div>
