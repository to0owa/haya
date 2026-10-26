<script lang="ts">
  import Button from "./Button.svelte";

  // Previous and next page controls with a short summary. Parent decides what a page means.
  let {
    summary,
    canPrev,
    canNext,
    onprev,
    onnext,
  }: { summary: string; canPrev: boolean; canNext: boolean; onprev: () => void; onnext: () => void } = $props();
</script>

<div class="haya-pager">
  <span class="haya-pager-summary">{summary}</span>
  <span class="haya-pager-spacer"></span>
  <Button label="Previous page" disabled={!canPrev} onclick={onprev}>Prev</Button>
  <Button label="Next page" disabled={!canNext} onclick={onnext}>Next</Button>
</div>
