<script lang="ts">
  // Shown where a list or panel has nothing yet. Always says what to do next.
  let { text }: { text: string } = $props();
</script>

<div class="haya-empty">{text}</div>
