<script lang="ts">
  // Empty space inside or between bars. fill takes the free space. size fixes it, in px, along the bar's axis.
  let {
    axis = "y",
    fill = false,
    size = null,
  }: { axis?: "x" | "y"; fill?: boolean; size?: number | null } = $props();

  const style = $derived(size == null ? undefined : axis === "x" ? `width:${size}px` : `height:${size}px`);
</script>

<div class="haya-spacer haya-spacer-{axis}" class:is-fill={fill} {style} aria-hidden="true"></div>
