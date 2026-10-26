<script lang="ts">
  import { dismiss, toasts } from "./notify.svelte";
  import Button from "./components/Button.svelte";
  import Icon from "./components/Icon.svelte";
</script>

<div class="haya-toasts" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <div class="haya-toast" class:is-error={toast.kind === "error"} class:is-success={toast.kind === "success"}>
      <span class="haya-toast-message">{toast.message}</span>
      <Button variant="icon" label="Dismiss" onclick={() => dismiss(toast.id)}><Icon name="close" /></Button>
    </div>
  {/each}
</div>
