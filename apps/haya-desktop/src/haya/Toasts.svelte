<script lang="ts">
  import { dismiss, toasts } from "./notify.svelte";
</script>

<div class="haya-toasts" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <div class="haya-toast" class:is-error={toast.kind === "error"} class:is-success={toast.kind === "success"}>
      <span class="haya-toast-message">{toast.message}</span>
      <button class="haya-toast-close" aria-label="Dismiss" onclick={() => dismiss(toast.id)}>×</button>
    </div>
  {/each}
</div>
