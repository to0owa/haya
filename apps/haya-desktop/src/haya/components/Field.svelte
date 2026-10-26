<script lang="ts">
  // One column of a record: name above, value in a box. NULL is shown muted.
  let { name, value }: { name: string; value: string | null } = $props();
</script>

<div class="haya-field">
  <div class="haya-field-name">{name}</div>
  <div class="haya-field-value" class:is-null={value === null}>{value ?? "NULL"}</div>
</div>
