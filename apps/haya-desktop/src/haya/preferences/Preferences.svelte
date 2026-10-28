<script lang="ts">
  import Icon from "../components/Icon.svelte";
  import Button from "../components/Button.svelte";
  import ThemeList from "../theme/ThemeList.svelte";
  import { ACTIONS, GROUPS, conflictOf, effectiveKey, formatKey, isOverridden, keyFromEvent, keyRecording, resetKey, setKey } from "../wm/keymap.svelte";
  import { WIDGET_SETTINGS, type SettingDef } from "../wm/bar/registry";
  import { setWidgetSetting, widgetList, widgetSetting, setWallpaperBlur, setWallpaperWholeApp } from "../wm/store.svelte";
  import Disclosure from "../components/Disclosure.svelte";
  import GlassControls from "./GlassControls.svelte";
  import { glassVars } from "../wm/glass";
  import { closePreferences, prefs, setNavExpanded, type Section } from "./prefs-state.svelte";
  import { activeWorkspace } from "../wm/model";
  import { setAllWorkspaceWallpapers, setWorkspaceName, setWorkspaceWallpaper, wm } from "../wm/store.svelte";
  import { toNumbering } from "../wm/numbering";
  import { importWallpaper, removeWallpaper, wallpaperReady, wallpaperUrl } from "../wm/wallpaper.svelte";
  import { notify } from "../notify.svelte";
  import { fade } from "svelte/transition";
  import { getVersion } from "@tauri-apps/api/app";
  import { checkForUpdate, installUpdate, updates } from "../updater.svelte";

  const active = $derived(activeWorkspace(wm.config));

  // The workspace whose wallpaper the controls edit. Starts on the active workspace.
  let chosenId = $state<number | null>(null);
  const target = $derived(wm.config.workspaces.find((w) => w.id === (chosenId ?? active.id)) ?? active);
  const activeIndex = $derived(wm.config.workspaces.findIndex((w) => w.id === target.id));
  // When on, choosing or removing a wallpaper applies to every workspace.
  let allWorkspaces = $state(false);

  // The large preview appears after the small tab thumbnail has shrunk away, and overshoots to full size.
  const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function easeOutBack(t: number) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  }
  // The dialog pops in with the same overshoot, and shrinks out quickly. The scrim fades under it.
  const SCRIM_IN = reduceMotion ? 0 : 120;
  const SCRIM_OUT = reduceMotion ? 0 : 120;
  const DIALOG_IN = reduceMotion ? 0 : 240;
  const DIALOG_OUT = reduceMotion ? 0 : 120;
  function popIn(_node: Element, { duration }: { duration: number }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: scale(${0.82 + 0.18 * easeOutBack(t)});` };
  }
  function popOut(_node: Element, { duration }: { duration: number }) {
    return { duration, css: (t: number) => `opacity: ${t}; transform: scale(${0.94 + 0.06 * t});` };
  }

  // The large preview waits for the tab's thumbnail to shrink away, then grows out of that tab and overshoots to full size.
  // While it waits it is transparent. Without that, the first frame (scale 0.15) sat as a small image in the middle of the preview.
  function teleportIn(_node: Element) {
    return {
      delay: reduceMotion ? 0 : 120,
      duration: reduceMotion ? 0 : 380,
      css: (t: number) => `opacity: ${Math.min(1, t * 5)}; transform: scale(${0.15 + 0.85 * easeOutBack(t)});`,
    };
  }
  // Where the selected tab sits, measured from the preview's top-left: tab pitch is 44px, the panel pads 16px, and the tab row is 32px high.
  const previewOrigin = $derived(`${activeIndex * 44 + 2}px -32px`);

  /** Sets the wallpaper for the chosen scope, then returns files that no workspace uses any more. */
  function applyWallpaper(name: string | null): string[] {
    const before = wm.config.workspaces.map((w) => w.wallpaper).filter((n): n is string => !!n);
    if (allWorkspaces) setAllWorkspaceWallpapers(name);
    else setWorkspaceWallpaper(target.id, name);
    const inUse = new Set(wm.config.workspaces.map((w) => w.wallpaper).filter((n): n is string => !!n));
    return [...new Set(before)].filter((n) => !inUse.has(n));
  }

  // What the importer can decode. The check runs before the file is read, so a video is refused at once instead of being loaded into memory first.
  const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i;
  const MAX_WALLPAPER_BYTES = 64 * 1024 * 1024;

  // The image being imported, if any. progress is 0 to 1 while a GIF encodes, and null before that or for a still.
  let importing = $state<{ workspaceId: number; url: string; progress: number | null } | null>(null);
  const importingHere = $derived(importing !== null && importing.workspaceId === target.id);

  async function setWallpaperFile(file: File) {
    if (!file.type.startsWith("image/") && !IMAGE_EXT.test(file.name)) {
      const what = file.type.startsWith("video/") ? "is a video" : "is not an image";
      notify("error", `Wallpaper: "${file.name}" ${what}. Use a PNG, JPEG, WebP, GIF, BMP, or TIFF file.`);
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      notify("error", `Wallpaper: "${file.name}" is larger than 64 MB.`);
      return;
    }
    if (importing) {
      notify("info", "Wallpaper: the last image is still being imported.");
      return;
    }
    // The file is accepted at once. The preview shows it as a placeholder with a progress ring,
    // and the decoding happens after that has painted, so the window never waits on it.
    const url = URL.createObjectURL(file);
    importing = { workspaceId: target.id, url, progress: null };
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      const name = await importWallpaper(file, (fraction) => {
        if (importing) importing.progress = fraction;
      });
      const unused = applyWallpaper(name);
      // Keep the placeholder until the stored image can be shown, so the preview never flashes empty.
      await wallpaperReady(name);
      for (const old of unused) if (old !== name) await removeWallpaper(old);
    } catch (error) {
      notify("error", `Wallpaper: ${error}`);
    } finally {
      URL.revokeObjectURL(url);
      importing = null;
    }
  }

  async function pickWallpaper(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) await setWallpaperFile(file);
  }

  // Drag and drop: the wallpaper panel takes an image dropped on it. Nested elements fire their own
  // enter and leave events, so a depth count decides when the pointer has really left the panel.
  let dropping = $state(false);
  let dropDepth = 0;
  const carriesFiles = (event: DragEvent) => !!event.dataTransfer?.types.includes("Files");

  function dragEnter(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dropDepth++;
    dropping = true;
  }

  function dragOver(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  function dragLeave() {
    dropDepth = Math.max(0, dropDepth - 1);
    if (dropDepth === 0) dropping = false;
  }

  async function dropImage(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    dropDepth = 0;
    dropping = false;
    const files = [...(event.dataTransfer?.files ?? [])];
    // The first image wins. With none, the first file goes through the same check, so the error names what was dropped.
    const file = files.find((f) => f.type.startsWith("image/") || IMAGE_EXT.test(f.name)) ?? files[0];
    if (file) await setWallpaperFile(file);
  }

  // A file dropped anywhere else must do nothing. Without this the webview would open the file in place of the app.
  function rejectStrayDrag(event: DragEvent) {
    if (!carriesFiles(event) || event.defaultPrevented) return;
    event.preventDefault();
    if (event.type === "dragover" && event.dataTransfer) event.dataTransfer.dropEffect = "none";
  }

  async function clearWallpaper() {
    const unused = applyWallpaper(null);
    for (const old of unused) await removeWallpaper(old);
  }

  const SECTIONS: { id: Section; label: string; icon: "palette" | "grid" | "sliders" | "keyboard" | "info" }[] = [
    { id: "interface", label: "Interface", icon: "palette" },
    { id: "workspaces", label: "Workspaces", icon: "grid" },
    { id: "toolbar", label: "Toolbar", icon: "sliders" },
    { id: "shortcuts", label: "Keyboard shortcuts", icon: "keyboard" },
    { id: "about", label: "About", icon: "info" },
  ];

  let appVersion = $state("");
  $effect(() => {
    getVersion().then((v) => (appVersion = v), () => (appVersion = ""));
  });

  const updateStatus = $derived(
    updates.phase === "checking"
      ? "Checking for updates..."
      : updates.phase === "available"
        ? `Haya ${updates.version} is available.`
        : updates.phase === "downloading"
          ? updates.progress === null
            ? "Downloading..."
            : `Downloading ${Math.round(updates.progress * 100)}%`
          : updates.phase === "ready"
            ? "Restarting..."
            : updates.phase === "current"
              ? "Haya is up to date."
              : updates.phase === "failed"
                ? `Could not update: ${updates.error}`
                : "",
  );

  /** Turns one value of a multi-choice setting on or off. The last value on cannot be turned off. */
  function toggleChoice(widget: string, setting: SettingDef, value: string) {
    const on = widgetList(widget, setting.key, setting.fallback);
    const next = on.includes(value) ? on.filter((v) => v !== value) : [...on, value];
    if (next.length === 0) return;
    setWidgetSetting(widget, setting.key, next.join(","));
  }

  const current = $derived(SECTIONS.find((s) => s.id === prefs.section) ?? SECTIONS[0]);
  const widgets = Object.entries(WIDGET_SETTINGS) as [string, { title: string; settings: SettingDef[] }][];

  /** Takes the next key pressed as the new key for the action being edited. Escape cancels, Backspace clears. */
  function recordKey(event: KeyboardEvent) {
    const id = keyRecording.id;
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Escape") {
      keyRecording.id = null;
    } else if (event.key === "Backspace" || event.key === "Delete") {
      setKey(id, "");
      keyRecording.id = null;
    } else {
      const key = keyFromEvent(event);
      if (!key) return;
      setKey(id, key);
      keyRecording.id = null;
    }
  }

  // Leaving Preferences cancels a recording that is still waiting.
  $effect(() => {
    if (!prefs.open) keyRecording.id = null;
  });

  function onkey(event: KeyboardEvent) {
    if (prefs.open && event.key === "Escape") closePreferences();
  }
</script>

<svelte:window onkeydowncapture={recordKey} onkeydown={onkey} ondragover={rejectStrayDrag} ondrop={rejectStrayDrag} />

{#if prefs.open}
  <div
    class="haya-prefs-scrim"
    role="presentation"
    in:fade|global={{ duration: SCRIM_IN }}
    out:fade|global={{ duration: SCRIM_OUT }}
    onmousedown={(e) => e.target === e.currentTarget && closePreferences()}
  >
    <div class="haya-prefs-blur" aria-hidden="true"></div>
    <div
      class="haya-prefs"
      class:is-expanded={prefs.navExpanded}
      style="{glassVars('prefs', wm.config.glass.prefs)};--n:{SECTIONS.length}"
      role="dialog"
      aria-modal="true"
      aria-label="Preferences"
      in:popIn|global={{ duration: DIALOG_IN }}
      out:popOut|global={{ duration: DIALOG_OUT }}
    >
      <nav class="haya-prefs-nav" aria-label="Preference sections">
        <div class="haya-prefs-nav-head">
          <button
            class="haya-prefs-toggle"
            aria-label={prefs.navExpanded ? "Collapse sections" : "Expand sections"}
            aria-expanded={prefs.navExpanded}
            title={prefs.navExpanded ? "Collapse sections" : "Expand sections"}
            onclick={() => setNavExpanded(!prefs.navExpanded)}
          >
            <Icon name="panel-left" />
          </button>
          <div class="haya-prefs-title" aria-hidden={!prefs.navExpanded}>Preferences</div>
        </div>
        {#each SECTIONS as section, i (section.id)}
          <button
            class="haya-prefs-link"
            style="--i: {i}"
            class:is-on={prefs.section === section.id}
            aria-label={section.label}
            aria-current={prefs.section === section.id ? "page" : undefined}
            title={section.label}
            onclick={() => (prefs.section = section.id)}
          >
            <Icon name={section.icon} />
            <span class="haya-prefs-link-label">{section.label}</span>
          </button>
        {/each}
      </nav>

      <section class="haya-prefs-body">
        <header class="haya-prefs-head">
          <h2>{current.label}</h2>
          <Button variant="icon" label="Close preferences" onclick={closePreferences}>
            <Icon name="close" />
          </Button>
        </header>

        {#if prefs.section === "interface"}
        <div class="haya-prefs-card">
          <h3 class="haya-prefs-card-title">Color theme</h3>
          <ThemeList />
        </div>

        <GlassControls surface="window" title="Window glass" />
        <GlassControls surface="prefs" title="Preferences glass" />
        {:else if prefs.section === "workspaces"}
        <div class="haya-prefs-card">
          <h3 class="haya-prefs-card-title">Wallpaper</h3>
          <div class="haya-prefs-ws-group">
          <div class="haya-prefs-workspaces" style="--i: {activeIndex}" role="group" aria-label="Workspace to edit">
            <svg class="haya-prefs-ws-shape" viewBox="0 0 52 32" aria-hidden="true"><path d="M0 32 Q8 32 8 24 L8 10 Q8 0 18 0 L34 0 Q44 0 44 10 L44 24 Q44 32 52 32 Z" /></svg>
            {#each wm.config.workspaces as w (w.id)}
              <button
                class="haya-prefs-ws"
                class:is-on={target.id === w.id}
                class:has-thumb={!!w.wallpaper && !!wallpaperUrl(w.wallpaper) && target.id !== w.id}
                aria-pressed={target.id === w.id}
                aria-label="Workspace {w.id}"
                onclick={() => (chosenId = w.id)}
              >
                {#if w.wallpaper && wallpaperUrl(w.wallpaper)}
                  <img class="haya-prefs-ws-thumb" src={wallpaperUrl(w.wallpaper) ?? ""} alt="" />
                {/if}
                <span>{w.id}</span>
              </button>
            {/each}
          </div>

          <div
            class="haya-prefs-ws-panel"
            class:is-dropping={dropping}
            role="group"
            aria-label="Wallpaper. Drop an image here to set it."
            ondragenter={dragEnter}
            ondragover={dragOver}
            ondragleave={dragLeave}
            ondrop={dropImage}
          >
          {#if dropping}
            <div class="haya-prefs-drop" aria-hidden="true">
              <span>Drop image to set the wallpaper</span>
              <small>{allWorkspaces ? "For all workspaces" : `For workspace ${target.id}`}</small>
            </div>
          {/if}
          <div class="haya-prefs-wallpaper">
            {#key target.id}
              <div class="haya-prefs-preview" style="transform-origin: {previewOrigin}" in:teleportIn>
                {#if importing && importingHere}
                  {@const pct = importing.progress === null ? null : Math.round(importing.progress * 100)}
                  <div class="haya-prefs-thumb haya-prefs-thumb-pending" aria-busy="true">
                    <img src={importing.url} alt="" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")} />
                    <div
                      class="haya-prefs-ring"
                      class:is-indeterminate={pct === null}
                      role="progressbar"
                      aria-label="Importing wallpaper"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={pct ?? undefined}
                    >
                      <svg viewBox="0 0 36 36" aria-hidden="true">
                        <circle class="haya-prefs-ring-track" cx="18" cy="18" r="15" />
                        <circle class="haya-prefs-ring-arc" cx="18" cy="18" r="15" pathLength="100" style="--p: {pct ?? 25}" />
                      </svg>
                      {#if pct !== null}<span>{pct}%</span>{/if}
                    </div>
                  </div>
                {:else if target.wallpaper && wallpaperUrl(target.wallpaper)}
                  <img class="haya-prefs-thumb" src={wallpaperUrl(target.wallpaper) ?? ""} alt="Wallpaper of workspace {target.id}" />
                {:else}
                  <div class="haya-prefs-thumb haya-prefs-thumb-empty">None</div>
                {/if}
                {#if target.wallpaper && !importingHere}
                  <button class="haya-prefs-trash" aria-label="Remove wallpaper" title="Remove wallpaper" onclick={clearWallpaper}>
                    <Icon name="trash" />
                  </button>
                {/if}
              </div>
            {/key}
            <div class="haya-prefs-wallpaper-actions">
              <div class="haya-prefs-wallpaper-buttons">
                <label class="haya-prefs-file">
                  <span>Choose image</span>
                  <input type="file" accept="image/*" onchange={pickWallpaper} />
                </label>
              </div>
              <label class="haya-prefs-check">
                <input type="checkbox" bind:checked={allWorkspaces} />
                <span>Use this image for all workspaces</span>
              </label>
            </div>
          </div>
          </div>
          </div>
        </div>

        <div class="haya-prefs-card">
          <h3 class="haya-prefs-card-title">Expanded wallpaper</h3>
          <label class="haya-prefs-check">
            <input type="checkbox" checked={wm.config.wallpaperWholeApp} onchange={(e) => setWallpaperWholeApp((e.currentTarget as HTMLInputElement).checked)} />
            <span>Expand to the whole window</span>
          </label>
          <label class="haya-prefs-slider">
            <span>Expanded blur</span>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              disabled={!wm.config.wallpaperWholeApp}
              value={wm.config.wallpaperBlur}
              oninput={(e) => setWallpaperBlur(Number((e.currentTarget as HTMLInputElement).value))}
            />
            <span class="haya-prefs-value">{wm.config.wallpaperBlur}px</span>
          </label>
        </div>
        {:else if prefs.section === "toolbar"}
          {#each widgets as [widget, def] (widget)}
          <Disclosure title={def.title}>
            {#each def.settings as setting (setting.key)}
              <div class="haya-prefs-setting">
                <span class="haya-prefs-setting-label">{setting.label}</span>
                {#if setting.multi}
                  <div class="haya-prefs-checks">
                    {#each setting.options as option (option.value)}
                      {@const on = widgetList(widget, setting.key, setting.fallback)}
                      <label class="haya-prefs-check">
                        <input
                          type="checkbox"
                          checked={on.includes(option.value)}
                          disabled={on.length === 1 && on.includes(option.value)}
                          onchange={() => toggleChoice(widget, setting, option.value)}
                        />
                        <span>{option.label}</span>
                      </label>
                    {/each}
                  </div>
                {:else}
                  <div class="haya-prefs-options">
                    {#each setting.options as option (option.value)}
                      <Button
                        variant="text"
                        label={option.label}
                        active={widgetSetting(widget, setting.key, setting.fallback) === option.value}
                        onclick={() => setWidgetSetting(widget, setting.key, option.value)}
                      >
                        {option.label}
                      </Button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
            {#if widget === "workspaces" && toNumbering(widgetSetting("workspaces", "numbering", "arabic")) === "custom"}
              <div class="haya-prefs-names">
                {#each wm.config.workspaces as w (w.id)}
                  <label class="haya-prefs-name">
                    <span>{w.id === 10 ? 0 : w.id}</span>
                    <input
                      class="haya-input"
                      value={w.name}
                      maxlength="24"
                      placeholder={String(w.id === 10 ? 0 : w.id)}
                      oninput={(e) => setWorkspaceName(w.id, (e.currentTarget as HTMLInputElement).value)}
                    />
                  </label>
                {/each}
              </div>
            {/if}
          </Disclosure>
          {/each}
        {:else if prefs.section === "about"}
          <div class="haya-prefs-card">
            <h3 class="haya-prefs-card-title">Haya {appVersion}</h3>
            <div class="haya-prefs-setting">
              <span class="haya-prefs-setting-label" aria-live="polite">{updateStatus || "Updates come from GitHub releases."}</span>
              <div>
                {#if updates.phase === "available"}
                  <Button variant="text" label="Install and restart" onclick={installUpdate}>Install and restart</Button>
                {:else}
                  <Button
                    variant="text"
                    label="Check for updates"
                    disabled={updates.phase === "checking" || updates.phase === "downloading" || updates.phase === "ready"}
                    onclick={() => checkForUpdate()}
                  >
                    Check for updates
                  </Button>
                {/if}
              </div>
            </div>
          </div>
        {:else}
          <div class="haya-prefs-shortcuts">
            {#each GROUPS as group (group)}
              <div class="haya-prefs-card">
              <h3 class="haya-prefs-card-title">{group}</h3>
              {#each ACTIONS.filter((a) => a.group === group) as action (action.id)}
                {@const key = effectiveKey(action)}
                {@const clash = conflictOf(action)}
                <div class="haya-prefs-shortcut">
                  <span class="haya-prefs-action">{action.label}</span>
                  <div class="haya-prefs-keybind">
                    <button
                      class="haya-prefs-key"
                      class:is-recording={keyRecording.id === action.id}
                      aria-label="Change the key for {action.label}"
                      onclick={() => (keyRecording.id = action.id)}
                    >
                      {keyRecording.id === action.id ? "Press a key" : key ? formatKey(key) : "None"}
                    </button>
                    {#if isOverridden(action)}
                      <Button variant="text" label="Reset {action.label}" onclick={() => resetKey(action.id)}>Reset</Button>
                    {/if}
                    {#if clash}
                      <span class="haya-prefs-clash">Also used by {clash.label}</span>
                    {/if}
                  </div>
                </div>
              {/each}
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}
