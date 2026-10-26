<script lang="ts">
  // Empty space between frame regions, or inside a bar. Size comes from --haya-frame-gap.
  // fill: take all free space in the bar, which pushes the items after it to the far side.
  let { axis = "y", fill = false }: { axis?: "x" | "y"; fill?: boolean } = $props();
</script>

<div class="haya-spacer haya-spacer-{axis}" class:is-fill={fill} aria-hidden="true"></div>
