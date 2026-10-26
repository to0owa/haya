<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { notify } from "../notify.svelte";
  import Button from "../components/Button.svelte";
  import { DRIVERS, type Driver } from "../db/drivers";
  import Select from "../components/Select.svelte";
  import { parseConnectionUrl } from "../db/connection-url";

  // New database connection. The password goes to the Keychain through db_save_profile and is never written to a file.
  let { onsaved, oncancel }: { onsaved: () => void; oncancel: () => void } = $props();

  let name = $state("");
  let dialect = $state("postgres");
  let host = $state("127.0.0.1");
  let port = $state(5432);
  let user = $state("");
  let password = $state("");
  let database = $state("");
  let busy = $state(false);

  // Pasting a full connection URL into Host fills every field. Anything that is not a URL pastes as plain text.
  function onHostPaste(event: ClipboardEvent) {
    const parsed = parseConnectionUrl(event.clipboardData?.getData("text") ?? "");
    if (!parsed) return;
    event.preventDefault();
    dialect = parsed.dialect;
    host = parsed.host;
    port = parsed.port;
    user = parsed.user;
    password = parsed.password;
    database = parsed.database;
    notify("success", "Filled from the connection URL");
  }

  // Picks an installed driver and moves the port to that driver's default.
  function pickDriver(driver: Driver) {
    dialect = driver.id;
    port = driver.defaultPort;
  }

  async function save() {
    if (!name.trim() || !host.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
      notify("error", "Name, host and a port between 1 and 65535 are required.");
      return;
    }
    busy = true;
    try {
      await invoke("db_save_profile", {
        profile: { name: name.trim(), dialect, host: host.trim(), port, user: user.trim(), database: database.trim() },
        password: password || null,
      });
      notify("success", `Saved ${name.trim()}`);
      password = "";
      onsaved();
    } catch (error) {
      notify("error", `Could not save: ${error}`);
    } finally {
      busy = false;
    }
  }
</script>

<form class="haya-form" onsubmit={(e) => { e.preventDefault(); save(); }}>
  <label class="haya-form-row">
    <span class="haya-form-label">Name</span>
    <input class="haya-input" bind:value={name} placeholder="local-postgres" autocomplete="off" />
  </label>
  <div class="haya-form-row">
    <span class="haya-form-label">Driver</span>
    <Select
      label="Driver"
      value={dialect}
      items={DRIVERS.map((d) => ({ value: d.id, label: d.name, badge: d.badge }))}
      onchange={(id) => pickDriver(DRIVERS.find((d) => d.id === id) as Driver)}
      action={{ label: "Add driver…", onselect: () => notify("error", "Adding a driver is not built yet.") }}
    />
  </div>
  <label class="haya-form-row">
    <span class="haya-form-label">Host</span>
    <input class="haya-input" bind:value={host} autocomplete="off" placeholder="host or a full URL" onpaste={onHostPaste} />
  </label>
  <label class="haya-form-row">
    <span class="haya-form-label">Port</span>
    <input class="haya-input" type="number" min="1" max="65535" bind:value={port} />
  </label>
  <label class="haya-form-row">
    <span class="haya-form-label">User</span>
    <input class="haya-input" bind:value={user} autocomplete="off" />
  </label>
  <label class="haya-form-row">
    <span class="haya-form-label">Password</span>
    <input class="haya-input" type="password" bind:value={password} autocomplete="new-password" placeholder="Stored in Keychain" />
  </label>
  <label class="haya-form-row">
    <span class="haya-form-label">Database</span>
    <input class="haya-input" bind:value={database} autocomplete="off" />
  </label>
  <div class="haya-form-actions">
    <Button variant="text" label="Cancel" onclick={oncancel}>Cancel</Button>
    <Button variant="text" label="Save connection" active disabled={busy} onclick={save}>Save</Button>
  </div>
</form>
