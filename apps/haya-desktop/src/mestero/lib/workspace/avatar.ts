type Point = { x: number; y: number };
type Track = 'pose' | 'body' | 'look' | 'eyes';
type Frame = [number, string];
type Identity = { initial?: string; colour: string; state: string; idleActions: string[] };
type AvatarAction = { duration: number; pose?: Frame[]; body?: Frame[]; look?: Frame[]; eyes?: Frame[] };
type Face = {
 head: SVGElement; gaze: SVGElement; attentive: boolean; rig: Record<string, SVGElement>;
 animations: Animation[]; actionRunning: boolean; actionSource: string | null; actionToken?: symbol;
 idleActions: string[]; nextActionAt: number; lastAction: string | null;
};
// The SVG geometry and animation presets are preserved from the approved HTML prototype.
// One shared observer and pointer listener serve all mounted avatars.
function createAvatarRuntime() {
  const controller = new AbortController();
  function listen<K extends keyof DocumentEventMap>(target: EventTarget, event: K, handler: (event: DocumentEventMap[K]) => void, options: AddEventListenerOptions = {}) {
    target.addEventListener(event, handler as EventListener, { ...options, signal: controller.signal });
  }
    const teammateAvatars: Record<string, Identity> = {
      Maestro: { initial: "M", colour: "#d6ad69", state: "thinking", idleActions: ["curious", "lookAround", "nod", "bounce"] },
      Virtuoso: { initial: "V", colour: "#6799ed", state: "working", idleActions: ["focus", "bounce", "curious", "nod"] },
      Soundcheck: { initial: "S", colour: "#e68a54", state: "testing", idleActions: ["lookAround", "curious", "happy", "nod"] }
    };
    const generatedAvatarShapes = new Map<string, ReturnType<typeof generateAvatarContour>>();
    const avatarShapeOwners = new Map<string, string>();
    function avatarNameKey(name: string) {
      return String(name || "Maestro").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase() || "maestro";
    }
    function seededAvatarRandom(seed: string) {
      let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = 0xdeadbeef;
      for (const character of seed) {
        const code = character.codePointAt(0)!;
        a = Math.imul(a ^ code, 0x85ebca6b);
        b = Math.imul(b ^ code, 0xc2b2ae35);
        c = Math.imul(c ^ code, 0x27d4eb2f);
        d = Math.imul(d ^ code, 0x165667b1);
      }
      return () => {
        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        let value = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        value = (value + d) | 0;
        c = (c + value) | 0;
        return (value >>> 0) / 4294967296;
      };
    }
    function generateAvatarContour(name: string, attempt = 0) {
      const random = seededAvatarRandom(`avatar-shape-v1:${name}:${attempt}`);
      // Broad silhouettes vary too, so names differ at small chat sizes.
      const family = Math.floor(random() * 4);
      const phase = random() * Math.PI * 2;
      const secondaryPhase = random() * Math.PI * 2;
      const lobes = 5 + Math.floor(random() * 3);
      const amplitude = .08 + random() * .055;
      const exponent = 2.6 + random() * 1.2;
      const scaleX = .94 + random() * .08;
      const scaleY = .94 + random() * .08;
      const count = 20;
      const pointAt = (angle: number, inset = 1) => {
        let radius;
        if (family === 0) radius = 31.7 * (1 + amplitude * Math.cos(2 * angle + phase) + .045 * Math.sin(3 * angle + secondaryPhase));
        else if (family === 1) {
          const rotation = (phase - Math.PI) * .1;
          const theta = angle + rotation;
          radius = 28.2 / Math.pow(Math.pow(Math.abs(Math.cos(theta)), exponent) + Math.pow(Math.abs(Math.sin(theta)), exponent), 1 / exponent);
          radius *= 1 + .025 * Math.sin(3 * angle + secondaryPhase);
        }
        else if (family === 2) radius = 31.8 * (1 + amplitude * Math.cos(lobes * angle + phase) + .025 * Math.sin(2 * angle + secondaryPhase));
        else radius = 32 * (1 + amplitude * Math.cos(3 * angle + phase) + .03 * Math.sin(2 * angle + secondaryPhase));
        radius = Math.max(27.5, Math.min(36.5, radius)) * inset;
        return { x: 40 + Math.cos(angle) * radius * scaleX, y: 40 + Math.sin(angle) * radius * scaleY };
      };
      const points = Array.from({ length: count }, (_, index) => pointAt(index / count * Math.PI * 2 - Math.PI / 2));
      const coordinate = (point: Point) => `${point.x.toFixed(3)} ${point.y.toFixed(3)}`;
      let path = `M${coordinate(points[0])}`;
      for (let index = 0; index < count; index++) {
        const before = points[(index - 1 + count) % count];
        const from = points[index];
        const to = points[(index + 1) % count];
        const after = points[(index + 2) % count];
        // A closed Catmull–Rom spline keeps the contour smooth at every join.
        const first = { x: from.x + (to.x - before.x) / 6, y: from.y + (to.y - before.y) / 6 };
        const second = { x: to.x - (after.x - from.x) / 6, y: to.y - (after.y - from.y) / 6 };
        path += `C${coordinate(first)} ${coordinate(second)} ${coordinate(to)}`;
      }
      const sheen = [-2.7, -2.25, -1.85].map(angle => pointAt(angle, .82));
      return Object.freeze({
        path: `${path}Z`, glint: `M${coordinate(sheen[0])}Q${coordinate(sheen[1])} ${coordinate(sheen[2])}`,
        baseline: Math.min(78, Math.max(...points.map(point => point.y)) + .5), family
      });
    }
    function getBotAvatarShape(name: string) {
      const key = avatarNameKey(name);
      if (generatedAvatarShapes.has(key)) return generatedAvatarShapes.get(key)!;
      let attempt = 0;
      let shape;
      do { shape = generateAvatarContour(key, attempt++); }
      while (avatarShapeOwners.has(shape.path) && avatarShapeOwners.get(shape.path) !== key);
      avatarShapeOwners.set(shape.path, key);
      generatedAvatarShapes.set(key, shape);
      return shape;
    }
    function getBotAvatarIdentity(name: string) {
      const key = avatarNameKey(name);
      const known = Object.keys(teammateAvatars).find(teammate => avatarNameKey(teammate) === key);
      if (known) return teammateAvatars[known];
      const colours = ["#d6ad69", "#6799ed", "#e68a54", "#8ebfa3", "#b89adf", "#da92a5", "#8fb9c9"];
      const random = seededAvatarRandom(`avatar-colour-v1:${key}`);
      return { colour: colours[Math.floor(random() * colours.length)], state: "thinking", idleActions: ["curious", "lookAround", "nod", "bounce"] };
    }
    let botAvatarSequence = 0;
    const avatarReducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    const avatarFinePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const avatarFaces = new WeakMap<HTMLElement, Face>();
    const visibleBotAvatars = new Set<HTMLElement>();
    // Each track deforms its own layer: movement, body, gaze, and eye expression.
    const botAvatarActions: Record<string, AvatarAction> = {
      bounce: { duration: 620,
        pose: [[0,"none"],[.18,"translateY(1.5px)"],[.44,"translateY(-7px)"],[.74,"translateY(0)"],[.87,"translateY(-1.2px)"],[1,"none"]],
        body: [[0,"none"],[.18,"scale(1.08,.92)"],[.4,"scale(.95,1.06)"],[.74,"scale(1.05,.95)"],[1,"none"]] },
      lookAround: { duration: 1450,
        pose: [[0,"none"],[.2,"rotate(-5deg)"],[.38,"rotate(-5deg)"],[.61,"rotate(5deg)"],[.79,"rotate(5deg)"],[1,"none"]],
        look: [[0,"none"],[.15,"translate(-4px,.5px)"],[.38,"translate(-4px,.5px)"],[.57,"translate(4px,-.5px)"],[.79,"translate(4px,-.5px)"],[1,"none"]] },
      curious: { duration: 1050,
        pose: [[0,"none"],[.28,"translateY(-1px) rotate(8deg)"],[.68,"translateY(-1px) rotate(8deg)"],[1,"none"]],
        look: [[0,"none"],[.22,"translate(2.8px,-2px)"],[.68,"translate(2.8px,-2px)"],[1,"none"]],
        eyes: [[0,"none"],[.25,"scale(.96,1.12)"],[.68,"scale(.96,1.12)"],[1,"none"]] },
      happy: { duration: 880,
        pose: [[0,"none"],[.13,"translateY(1px)"],[.34,"translateY(-5px) rotate(-3deg)"],[.57,"translateY(0) rotate(2deg)"],[.76,"translateY(-2px)"],[1,"none"]],
        body: [[0,"none"],[.13,"scale(1.07,.94)"],[.34,"scale(.97,1.04)"],[.57,"scale(1.04,.96)"],[1,"none"]],
        eyes: [[0,"none"],[.2,"scale(1.06,.55)"],[.78,"scale(1.06,.55)"],[1,"none"]] },
      nod: { duration: 680,
        pose: [[0,"none"],[.28,"translateY(2.8px) rotate(2deg)"],[.52,"translateY(-.6px)"],[.73,"translateY(1.3px)"],[1,"none"]],
        look: [[0,"none"],[.28,"translateY(1.8px)"],[.73,"translateY(.5px)"],[1,"none"]],
        eyes: [[0,"none"],[.28,"scale(1,.83)"],[.73,"scale(1,.95)"],[1,"none"]] },
      focus: { duration: 1250,
        pose: [[0,"none"],[.25,"translateY(1px) rotate(-3deg)"],[.75,"translateY(1px) rotate(-3deg)"],[1,"none"]],
        look: [[0,"none"],[.2,"translate(1px,2.5px)"],[.75,"translate(1px,2.5px)"],[1,"none"]],
        eyes: [[0,"none"],[.25,"scale(1.05,.78)"],[.75,"scale(1.05,.78)"],[1,"none"]] }
    };
    let botAvatarIdleTimer = 0;
    function stopBotAvatarAction(element: HTMLElement, settle = false) {
      const face = avatarFaces.get(element);
      if (!face) return;
      const current: [string, string][] = settle && !avatarReducedMotion.matches
        ? Object.entries(face.rig).map(([track, layer]) => [track, getComputedStyle(layer).transform]) : [];
      const token = Symbol("avatar-settle");
      face.actionToken = token;
      face.animations.forEach(animation => animation.cancel());
      face.animations = [];
      face.actionRunning = false;
      face.actionSource = null;
      element.classList.remove("is-performing");
      delete element.dataset.avatarMotion;
      current.forEach(([track, transform]) => {
        if (transform === "none") return;
        face.animations.push(face.rig[track].animate([{ transform }, { transform: "none" }], {
          duration: 180, easing: "cubic-bezier(.22,1,.36,1)"
        }));
      });
      Promise.all(face.animations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (face.actionToken === token) face.animations = [];
      });
    }
    async function playBotAvatarAction(element: HTMLElement, preset: string, { source = "interaction" } = {}) {
      const face = avatarFaces.get(element);
      const action = botAvatarActions[preset];
      if (!face || !action || !element.isConnected || document.hidden || avatarReducedMotion.matches) return false;
      // A newly triggered expression starts from the current pose if interrupted.
      const initial: Record<string, string> = face.animations.length
        ? Object.fromEntries(Object.entries(face.rig).map(([track, layer]) => [track, getComputedStyle(layer).transform])) : {};
      stopBotAvatarAction(element);
      resetAvatarAttention(element);
      const token = Symbol(preset);
      face.actionToken = token;
      face.actionRunning = true;
      face.actionSource = source;
      face.lastAction = preset;
      face.nextActionAt = performance.now() + 14000 + Math.random() * 10000;
      element.classList.add("is-performing");
      element.dataset.avatarMotion = preset;
      face.animations = Object.entries(face.rig).map(([track, layer]) => {
        const frames = (action[track as Track] || [[0,"none"],[1,"none"]]).map(([offset, transform]) => ({ offset, transform }));
        if (initial[track]) frames[0].transform = initial[track];
        return layer.animate(frames, { duration: action.duration, easing: "cubic-bezier(.37,0,.25,1)" });
      });
      await Promise.all(face.animations.map(animation => animation.finished.catch(() => {})));
      if (face.actionToken !== token) return false;
      face.animations = [];
      face.actionRunning = false;
      face.actionSource = null;
      element.classList.remove("is-performing");
      delete element.dataset.avatarMotion;
      if (avatarPointer) queueAvatarAttention();
      return true;
    }
    function scheduleBotAvatarIdle(delay = 4600 + Math.random() * 3500) {
      if (botAvatarIdleTimer || document.hidden || avatarReducedMotion.matches || !visibleBotAvatars.size) return;
      botAvatarIdleTimer = window.setTimeout(() => {
        botAvatarIdleTimer = 0;
        const now = performance.now();
        const visible = [...visibleBotAvatars].filter(element => element.isConnected);
        if (!visible.some(element => avatarFaces.get(element)?.actionRunning)) {
          const candidates = visible.filter(element => {
            const face = avatarFaces.get(element);
            return face && !face.attentive && face.nextActionAt <= now && element.getBoundingClientRect().width >= 28;
          });
          if (candidates.length) {
            const element = candidates[Math.floor(Math.random() * candidates.length)];
            const face = avatarFaces.get(element)!;
            const presets = face.idleActions.filter(preset => preset !== face.lastAction);
            playBotAvatarAction(element, presets[Math.floor(Math.random() * presets.length)], { source: "idle" });
          }
        }
        scheduleBotAvatarIdle();
      }, delay);
    }
    // Reusable for future bot events: await mesteroAvatars.play(element, "happy").
    const botAvatarObserver = new IntersectionObserver(entries => {
      entries.forEach(({ target: observed, isIntersecting }) => {
        const target = observed as HTMLElement;
        target.classList.toggle("is-in-view", isIntersecting);
        if (isIntersecting) {
          visibleBotAvatars.add(target);
          scheduleBotAvatarIdle(1800 + Math.random() * 1600);
        }
        else {
          visibleBotAvatars.delete(target);
          resetAvatarAttention(target);
          stopBotAvatarAction(target);
        }
      });
      if (!visibleBotAvatars.size) {
        clearTimeout(botAvatarIdleTimer);
        botAvatarIdleTimer = 0;
      }
    });
    function resetAvatarAttention(element: HTMLElement) {
      const face = avatarFaces.get(element);
      if (!face || !face.attentive) return;
      face.head.style.removeProperty("transform");
      face.gaze.style.removeProperty("transform");
      face.attentive = false;
      element.classList.remove("is-attentive");
    }
    let avatarPointerFrame = 0;
    let avatarPointer: Point | null = null;
    function updateAvatarAttention() {
      avatarPointerFrame = 0;
      if (!avatarPointer || avatarReducedMotion.matches || !avatarFinePointer.matches) return;
      // Read every position before applying transforms, including during chat scrolling.
      const positions: { element: HTMLElement; bounds: DOMRect }[] = [];
      visibleBotAvatars.forEach(element => {
        if (!element.isConnected) {
          visibleBotAvatars.delete(element);
          stopBotAvatarAction(element);
          botAvatarObserver.unobserve(element);
          return;
        }
        positions.push({ element, bounds: element.getBoundingClientRect() });
      });
      positions.forEach(({ element, bounds }) => {
        const face = avatarFaces.get(element)!;
        const dx = avatarPointer!.x - bounds.left - bounds.width / 2;
        const dy = avatarPointer!.y - bounds.top - bounds.height / 2;
        const reach = Math.max(150, bounds.width * 3);
        const distance = Math.hypot(dx, dy);
        if (distance > reach || !bounds.width) {
          resetAvatarAttention(element);
          return;
        }
        if (face.actionRunning) {
          if (face.actionSource !== "idle") return;
          stopBotAvatarAction(element, true);
        }
        const strength = Math.min(1, (reach - distance) / (reach * .35));
        const x = dx / Math.max(distance, bounds.width) * strength;
        const y = dy / Math.max(distance, bounds.height) * strength;
        face.head.style.transform = `translate(${x * .7}px,${y * .4}px) rotate(${x * 3.5}deg)`;
        face.gaze.style.transform = `translate(${x * 4}px,${y * 2.8}px)`;
        face.attentive = true;
        element.classList.add("is-attentive");
      });
    }
    function queueAvatarAttention() {
      if (!avatarPointerFrame) avatarPointerFrame = requestAnimationFrame(updateAvatarAttention);
    }
    listen(document, "pointermove", event => {
      if (event.pointerType === "touch" || avatarReducedMotion.matches || !avatarFinePointer.matches) return;
      avatarPointer = { x: event.clientX, y: event.clientY };
      queueAvatarAttention();
    }, { passive: true });
    listen(document, "scroll", () => {
      if (avatarPointer) queueAvatarAttention();
    }, { passive: true, capture: true });
    function releaseAvatarAttention() {
      avatarPointer = null;
      visibleBotAvatars.forEach(resetAvatarAttention);
    }
    listen(document.documentElement, "pointerleave", releaseAvatarAttention);
    listen(window, "blur", releaseAvatarAttention);
    function refreshAvatarMotion() {
      releaseAvatarAttention();
      clearTimeout(botAvatarIdleTimer);
      botAvatarIdleTimer = 0;
      if (document.hidden || avatarReducedMotion.matches) visibleBotAvatars.forEach(element => stopBotAvatarAction(element));
      else scheduleBotAvatarIdle();
      document.querySelectorAll<HTMLButtonElement>("[data-avatar-action]").forEach(button => { button.disabled = avatarReducedMotion.matches; });
    }
    listen(avatarReducedMotion, "change", refreshAvatarMotion);
    listen(avatarFinePointer, "change", releaseAvatarAttention);
    listen(document, "visibilitychange", () => {
      document.body.classList.toggle("is-page-hidden", document.hidden);
      refreshAvatarMotion();
    });
    function mountBotAvatar(element: HTMLElement, name: string) {
      name = String(name || "Maestro").normalize("NFC").trim().replace(/\s+/g, " ") || "Maestro";
      const teammate = getBotAvatarIdentity(name);
      stopBotAvatarAction(element);
      element.classList.add("avatar", "bot-avatar");
      element.classList.toggle("blue", teammate === teammateAvatars.Virtuoso);
      element.classList.toggle("amber", teammate === teammateAvatars.Soundcheck);
      element.dataset.state = teammate.state;
      element.dataset.avatarName = name;
      element.dataset.botAvatarReady = "true";
      element.style.setProperty("--bot-colour", teammate.colour);
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", `${name} avatar`);
      element.title = name;
      const shadeId = `bot-shade-${++botAvatarSequence}`;
      const contour = getBotAvatarShape(name);
      const shape = contour.path;
      element.innerHTML = `<svg class="bot-avatar-svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <defs><linearGradient id="${shadeId}" x1="18" y1="10" x2="61" y2="73" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".16"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#111716" stop-opacity=".18"/></linearGradient></defs>
        <g class="bot-avatar-action"><g class="bot-avatar-presence"><g class="bot-avatar-head"><g class="bot-avatar-body-shape">
          <path class="bot-avatar-body" d="${shape}"/><path fill="url(#${shadeId})" d="${shape}"/>
          <path class="bot-avatar-glint" d="${contour.glint}"/>
          </g><g class="bot-avatar-gaze"><g class="bot-avatar-action-look"><g class="bot-avatar-expression"><g class="bot-avatar-face">
            <g class="bot-avatar-lid"><rect class="bot-avatar-eye" x="27" y="32" width="9" height="18" rx="4.5"/><ellipse class="bot-avatar-eye-shine" cx="30" cy="35" rx="1.2" ry="1.8"/></g>
            <g class="bot-avatar-lid"><rect class="bot-avatar-eye" x="47" y="31" width="9" height="18" rx="4.5"/><ellipse class="bot-avatar-eye-shine" cx="50" cy="34" rx="1.2" ry="1.8"/></g>
          </g></g></g></g>
        </g></g></g>
      </svg>`;
      const presence = element.querySelector<SVGElement>(".bot-avatar-presence")!;
      const face = element.querySelector<SVGElement>(".bot-avatar-face")!;
      element.querySelectorAll<SVGElement>(".bot-avatar-presence, .bot-avatar-action, .bot-avatar-body-shape").forEach(layer => {
        layer.style.transformOrigin = `40px ${contour.baseline.toFixed(3)}px`;
      });
      presence.style.animationDuration = `${4.8 + Math.random() * 2}s`;
      presence.style.animationDelay = `${-Math.random() * 7}s`;
      face.style.animationDuration = `${10 + Math.random() * 5}s`;
      face.style.animationDelay = `${-Math.random() * 15}s`;
      const blinkDuration = 5.4 + Math.random() * 3;
      const blinkDelay = -Math.random() * blinkDuration;
      element.querySelectorAll<SVGElement>(".bot-avatar-lid").forEach(lid => {
        lid.style.animationDuration = `${blinkDuration}s`;
        lid.style.animationDelay = `${blinkDelay}s`;
      });
      avatarFaces.set(element, {
        head: element.querySelector<SVGElement>(".bot-avatar-head")!, gaze: element.querySelector<SVGElement>(".bot-avatar-gaze")!, attentive: false,
        rig: { pose: element.querySelector<SVGElement>(".bot-avatar-action")!, body: element.querySelector<SVGElement>(".bot-avatar-body-shape")!, look: element.querySelector<SVGElement>(".bot-avatar-action-look")!, eyes: element.querySelector<SVGElement>(".bot-avatar-expression")! },
        animations: [], actionRunning: false, actionSource: null, idleActions: teammate.idleActions,
        nextActionAt: performance.now(), lastAction: null
      });
      element.classList.remove("is-attentive");
      botAvatarObserver.observe(element);
    }

  return {
    mount(element: HTMLElement, name: string) { mountBotAvatar(element, name); },
    unmount(element: HTMLElement) {
      botAvatarObserver.unobserve(element);
      visibleBotAvatars.delete(element);
      stopBotAvatarAction(element);
      avatarFaces.delete(element);
    },
    play: playBotAvatarAction,
    destroy() {
      controller.abort();
      clearTimeout(botAvatarIdleTimer);
      cancelAnimationFrame(avatarPointerFrame);
      visibleBotAvatars.forEach(element => stopBotAvatarAction(element));
      visibleBotAvatars.clear();
      botAvatarObserver.disconnect();
      document.body.classList.remove('is-page-hidden');
    }
  };
}
let runtime: ReturnType<typeof createAvatarRuntime> | undefined;
let mounted = 0;
/** @param {HTMLElement} node @param {string} name */
export function avatar(node: HTMLElement, name: string) {
  const engine = runtime ||= createAvatarRuntime();
  mounted++;
  engine.mount(node, name);
  return {
    update(nextName: string) { engine.mount(node, nextName); },
    destroy() {
      engine.unmount(node);
      if (--mounted === 0) { engine.destroy(); runtime = undefined; }
    }
  };
}
/** @param {HTMLElement} node @param {string} preset */
export async function playAvatar(node: HTMLElement, preset: string) {
  return runtime ? runtime.play(node, preset, { source: 'preview' }) : false;
}
export const avatarPresets = ['bounce', 'lookAround', 'curious', 'happy', 'nod', 'focus'];
