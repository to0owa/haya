<script lang="ts">
  // Title row for a side panel. Same height and type everywhere.
  let { title }: { title: string } = $props();
</script>

<div class="haya-panel-header">{title}</div>
