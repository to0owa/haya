<script lang="ts">
  import { dismiss, toasts } from "./notify.svelte";
  import Toast from "./components/Toast.svelte";
</script>

<div class="haya-toasts" role="status" aria-live="polite">
  {#each toasts as toast (toast.id)}
    <Toast {toast} ondismiss={() => dismiss(toast.id)} />
  {/each}
</div>
