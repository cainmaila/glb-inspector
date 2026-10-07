import { createMemo, createSignal, For, Index, onCleanup, onMount, Show } from 'solid-js';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { AppendSceneAsync, SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Node } from '@babylonjs/core/node';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/loaders/glTF';
import { lang, t, toggleLang } from './i18n';
import { GLTF2Export } from '@babylonjs/serializers/glTF/2.0';

SceneLoader.ShowLoadingScreen = false; // own progress overlay below

const clear = new Color4(0, 0, 0, 0);
const untoned = new ImageProcessingConfiguration(); // helper overlays skip the scene's tone mapping
const fmt = (n: number) => n.toLocaleString();
const v3 = (v: { x: number; y: number; z: number }) => `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}`;
const meshesOf = (n: Node) => [...(n instanceof AbstractMesh ? [n] : []), ...n.getChildMeshes()];
const rootOf = (n: Node) => {
  while (n.parent) n = n.parent;
  return n;
};
// world matrix in glTF space (strips __root__ handedness flip): 16 numbers, column-major
const gltfWorld = (n: TransformNode) =>
  Array.from(n.computeWorldMatrix(true).multiply(Matrix.Invert((rootOf(n) as TransformNode).getWorldMatrix())).asArray(), (x) =>
    +x.toFixed(6),
  );
// view gizmo axes in glTF space; __root__ flips handedness so glTF +X is Babylon -X
const AXES = (
  [
    ['X', '#ff5d64', new Vector3(-1, 0, 0)],
    ['Y', '#5fd38d', new Vector3(0, 1, 0)],
    ['Z', '#4d8dff', new Vector3(0, 0, 1)],
  ] as const
).flatMap(([label, color, d]) => [
  { label, color, d, neg: false },
  { label, color, d: d.negate(), neg: true },
]);
// 24px stroke icons (single path each)
const ICON = {
  focus: 'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  isolate: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  eyeOff: 'M3 3l18 18M10.6 5.1Q11.3 5 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2',
  chevron: 'm9 6 6 6-6 6',
  search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-3.5-3.5',
  copy: 'M9 11a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2zM5 15a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h8a1 1 0 0 1 1 1',
  matrix: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 12h16M12 4v16',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  upload: 'M12 16V4m-5 5 5-5 5 5M5 20h14',
  up: 'M14 9 9 4 4 9M20 20h-7a4 4 0 0 1-4-4V4',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  cube: 'M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM3.5 7 12 12l8.5-5M12 12v9.5',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 8v5M12 16.5v.01M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0',
  sidebarL: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM9.5 4v16',
  sidebarR: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM14.5 4v16',
};
const Icon = (p: { d: string; class?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class={p.class ?? 'size-3.5'} aria-hidden="true">
    <path d={p.d} />
  </svg>
);
const pathOf = (n: Node) => {
  const names = [];
  for (let p: Node | null = n; p; p = p.parent) names.unshift(p.name);
  return names.join(' / ');
};

export default function App() {
  let canvas!: HTMLCanvasElement;
  let engine: Engine;
  let scene: Scene | undefined;
  let selBox: Mesh | undefined;
  let stopFly = () => {};
  let ghost: StandardMaterial | undefined;
  const saved = new Map<AbstractMesh, Pick<AbstractMesh, 'material' | 'renderingGroupId' | 'isPickable'>>();

  const [roots, setRoots] = createSignal<Node[]>([]);
  const [all, setAll] = createSignal<Node[]>([]);
  const [selected, setSelected] = createSignal<Node | null>(null);
  const [expanded, setExpanded] = createSignal(new Set<number>());
  const [tick, setTick] = createSignal(0); // bump when Babylon state (enabled) changes
  const [query, setQuery] = createSignal('');
  const [progress, setProgress] = createSignal<number | null>(null);
  const [error, setError] = createSignal('');
  const [fileName, setFileName] = createSignal('');
  const [isolated, setIsolated] = createSignal<Node | null>(null);
  const [axes, setAxes] = createSignal<((typeof AXES)[number] & { x: number; y: number; z: number })[]>([]);
  const [leftOpen, setLeftOpen] = createSignal(true);
  const [rightOpen, setRightOpen] = createSignal(true);
  const [dragging, setDragging] = createSignal(false);
  const [copied, setCopied] = createSignal('');

  let copyTimer = 0;
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text); // undefined / rejects outside secure contexts
    } catch {
      return;
    }
    clearTimeout(copyTimer);
    setCopied(key);
    copyTimer = setTimeout(() => setCopied(''), 1400);
  };
  let dragDepth = 0; // dragenter/leave fire per child element; count to know when the file really left
  const isFile = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  const toggle = (id: number) => {
    const s = new Set(expanded());
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };

  const frame = (n: Node) => {
    const ms = meshesOf(n);
    if (!ms.length || !scene) return;
    const { min, max } = n.getHierarchyBoundingVectors(true);
    const s = scene;
    const cam = s.activeCamera as ArcRotateCamera;
    const [t0, r0] = [cam.target.clone(), cam.radius];
    const [t1, r1] = [min.add(max).scale(0.5), Math.max(max.subtract(min).length() * 1.2, 0.1)];
    const start = performance.now();
    stopFly();
    const obs = s.onBeforeRenderObservable.add(() => {
      const k = Math.min((performance.now() - start) / 600, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; // easeInOutCubic
      cam.target = Vector3.Lerp(t0, t1, e);
      cam.radius = r0 + (r1 - r0) * e;
      if (k === 1) stopFly();
    });
    stopFly = () => {
      s.onBeforeRenderObservable.remove(obs);
      stopFly = () => {};
    };
  };

  // ghost everything outside n; n draws in rendering group 1 so ghosts never cover it
  const isolate = (n: Node | null) => {
    for (const [m, o] of saved) Object.assign(m, o);
    saved.clear();
    setIsolated(n);
    if (!n || !scene) return;
    const inside = new Set(meshesOf(n));
    // glTF materials are forced opaque (mesh.visibility is ignored), so swap in a shared see-through one
    // ponytail: InstancedMesh can't take its own material; set loader createInstances:false if a model uses instances
    if (!ghost) {
      ghost = new StandardMaterial('__ghost', scene);
      ghost.alpha = 0.08;
      ghost.disableDepthWrite = true;
      ghost.imageProcessingConfiguration = untoned;
    }
    for (const m of scene.meshes) {
      if (m === selBox) continue;
      saved.set(m, { material: m.material, renderingGroupId: m.renderingGroupId, isPickable: m.isPickable });
      if (inside.has(m)) m.renderingGroupId = 1;
      else Object.assign(m, { material: ghost, isPickable: false });
    }
    frame(n);
  };

  // export n + descendants with n at the origin, directly under __root__ (keeps handedness conversion)
  const exportGlb = async (n: TransformNode) => {
    const root = rootOf(n) as TransformNode;
    const keep = { parent: n.parent, position: n.position, rotation: n.rotation, rotationQuaternion: n.rotationQuaternion, scaling: n.scaling };
    const ghosted = [...saved.keys()].filter((m) => m.material === ghost);
    ghosted.forEach((m) => (m.material = saved.get(m)!.material));
    if (n !== root) {
      n.parent = root;
      n.position = Vector3.Zero();
      n.rotationQuaternion = Quaternion.Identity();
      n.scaling = Vector3.One();
    }
    try {
      const glb = await GLTF2Export.GLBAsync(scene!, n.name, {
        shouldExportNode: (x) => x === root || x === n || x.isDescendantOf(n),
      });
      glb.downloadFiles();
    } finally {
      Object.assign(n, keep);
      ghosted.forEach((m) => (m.material = ghost!));
    }
  };

  const select = (n: Node | null, focus: boolean) => {
    setSelected(n);
    setCopied('');
    selBox?.dispose();
    selBox = undefined;
    if (!n || !scene) return;
    const s = new Set(expanded());
    for (let p = n.parent; p; p = p.parent) s.add(p.uniqueId);
    setExpanded(s);
    requestAnimationFrame(() => document.querySelector(`[data-id="${n.uniqueId}"]`)?.scrollIntoView({ block: 'nearest' }));
    if (!meshesOf(n).length) return;
    const { min, max } = n.getHierarchyBoundingVectors(true);
    const size = max.subtract(min);
    selBox = CreateBox('__selection', { width: size.x, height: size.y, depth: size.z }, scene);
    selBox.position = min.add(max).scale(0.5);
    const mat = new StandardMaterial('__selection', scene);
    mat.wireframe = true;
    mat.disableLighting = true;
    mat.emissiveColor = Color3.FromHexString(getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim());
    mat.imageProcessingConfiguration = untoned;
    selBox.material = mat;
    selBox.isPickable = false;
    selBox.renderingGroupId = 1;
    if (focus) frame(n);
  };

  const load = async (src: string | File) => {
    stopFly();
    saved.clear();
    setIsolated(null);
    scene?.dispose();
    selBox = ghost = undefined;
    setRoots([]);
    setAll([]);
    setSelected(null);
    setExpanded(new Set<number>());
    setError('');
    setAxes([]);
    setProgress(0);
    setFileName(typeof src === 'string' ? src : src.name);
    const s = (scene = new Scene(engine));
    s.clearColor = new Color4(0, 0, 0, 0); // let the CSS stage backdrop show through
    s.skipPointerMovePicking = true; // thousands of meshes: don't raycast on every mouse move
    try {
      await AppendSceneAsync(src, s, {
        pluginExtension: '.glb',
        onProgress: (e) => s === scene && e.lengthComputable && setProgress(e.loaded / e.total),
      });
    } catch (e) {
      if (s !== scene) return;
      setError(String(e));
      setProgress(null);
      return;
    }
    if (s !== scene) return; // a newer load replaced (and disposed) this scene
    const r = s.rootNodes.slice();
    s.createDefaultCamera(true, true, true);
    for (const l of s.lights.slice()) l.dispose(); // model lights (KHR_lights_punctual) vary wildly; use one consistent rig
    const cam = s.activeCamera as ArcRotateCamera;
    // IBL gives PBR its ambient + reflections (metals are black without it)
    s.environmentTexture = new HDRCubeTexture('german_town_street_1k.hdr', s, 256, false, true, false, true, null, () => s === scene && setError(t().hdrError));
    // key light parented to the camera (from upper-left behind it) so the visible side always has form-revealing shading
    const key = new DirectionalLight('__key', new Vector3(0.4, -0.6, 1), s); // camera-local: right, down, forward
    key.parent = cam;
    key.intensity = 1.5;
    // PBR Neutral tone mapping keeps base colors close to authored values (what an inspector should show)
    s.imageProcessingConfiguration.toneMappingEnabled = true;
    s.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
    cam.wheelDeltaPercentage = 0.02;
    cam.alpha = Math.PI / 2; // look from glTF +Z toward -Z, like three.js default view
    cam.onViewMatrixChangedObservable.add(() => {
      cam.minZ = cam.radius * 0.01; // near plane tracks zoom: no z-fighting far out, no clipping up close
      const view = cam.getViewMatrix();
      const v = AXES.map((a) => {
        const { x, y, z } = Vector3.TransformNormal(a.d, view);
        return { ...a, x, y: -y, z }; // svg y points down
      });
      setAxes(v.sort((a, b) => b.z - a.z)); // far first
    });
    s.onPointerObservable.add((e) => {
      if (e.type === PointerEventTypes.POINTERDOWN || e.type === PointerEventTypes.POINTERWHEEL) stopFly(); // user takes over camera
      if (e.type === PointerEventTypes.POINTERTAP) select(s.pick(s.pointerX, s.pointerY).pickedMesh, false);
    });
    setRoots(r);
    setAll(r.flatMap((n) => [n, ...n.getDescendants()]));
    setProgress(null);
  };

  const stats = createMemo(() => {
    const nodes = all();
    const meshes = nodes.filter((n): n is AbstractMesh => n instanceof AbstractMesh);
    return {
      nodes: nodes.length,
      meshes: meshes.length,
      vertices: meshes.reduce((a, m) => a + m.getTotalVertices(), 0),
      materials: scene?.materials.length ?? 0,
      textures: scene?.textures.filter((x) => x !== scene!.environmentTexture).length ?? 0, // exclude viewer's IBL
    };
  });

  const matches = createMemo(() => {
    const q = query().trim().toLowerCase();
    return q ? all().filter((n) => n.name.toLowerCase().includes(q)).slice(0, 300) : [];
  });

  const info = createMemo(() => {
    tick();
    const n = selected();
    if (!n) return null;
    const ms = meshesOf(n);
    const bb = ms.length ? n.getHierarchyBoundingVectors(true) : null;
    // world bounds back into glTF space (undo __root__ handedness flip), matching the axis colors and gltfWorld
    const toGltf = Matrix.Invert((rootOf(n) as TransformNode).getWorldMatrix());
    const size = bb && Vector3.TransformNormal(bb.max.subtract(bb.min), toGltf);
    const t = n instanceof TransformNode ? n : null;
    return {
      node: n,
      type: n.getClassName(),
      path: pathOf(n),
      children: n.getChildren().length,
      descendants: n.getDescendants().length,
      meshes: ms.length,
      vertices: ms.reduce((a, m) => a + m.getTotalVertices(), 0),
      triangles: ms.reduce((a, m) => a + m.getTotalIndices() / 3, 0),
      materials: [...new Set(ms.map((m) => m.material?.name).filter(Boolean))] as string[],
      position: t && v3(t.position),
      rotation: t && v3((t.rotationQuaternion?.toEulerAngles() ?? t.rotation).scale(180 / Math.PI)),
      scaling: t && v3(t.scaling),
      size: size && v3(new Vector3(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z))),
      center: bb && v3(Vector3.TransformCoordinates(bb.min.add(bb.max).scale(0.5), toGltf)),
      metadata: n.metadata && Object.keys(n.metadata).length ? JSON.stringify(n.metadata, null, 2) : '',
    };
  });

  onMount(() => {
    engine = new Engine(canvas, true);
    engine.runRenderLoop(() => (scene?.activeCamera ? scene.render() : engine.clear(clear, true, true))); // clear: no stale frame while loading / after a failed load
    const ro = new ResizeObserver(() => engine.resize()); // window resize (panels float over the canvas, so they never resize it)
    ro.observe(canvas);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && isolated() && isolate(null);
    window.addEventListener('keydown', onKey);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      engine.dispose();
    });
    if (import.meta.env.DEV) load('sample.glb');
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth = 0;
    setDragging(false);
    const f = e.dataTransfer?.files[0];
    if (f) load(f);
  };
  const onFile = (e: Event & { currentTarget: HTMLInputElement }) => e.currentTarget.files?.[0] && load(e.currentTarget.files[0]);

  // hidden row actions take no clicks until the row is hovered (no accidental taps on touch screens)
  const hiddenBtn = 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100';
  const rowBtn = 'size-6 shrink-0 grid place-items-center rounded-md transition-colors';
  const Row = (p: { node: Node; depth: number; flat?: boolean }) => {
    const kids = () => p.node.getChildren();
    const open = () => expanded().has(p.node.uniqueId);
    const enabled = () => (tick(), p.node.isEnabled(false));
    const sel = () => selected() === p.node;
    return (
      <>
        <div
          data-id={p.node.uniqueId}
          class="group relative flex items-center gap-1.5 h-7 pr-2 mx-1.5 rounded-md cursor-pointer text-[13px] whitespace-nowrap bg-(--row) transition-colors"
          classList={{
            '[--row:var(--color-base-300)] text-base-content': sel(),
            '[--row:var(--color-base-100)] hover:[--row:color-mix(in_oklch,var(--color-base-100),var(--color-base-300))] text-base-content/80': !sel(),
            'opacity-35': !enabled(),
          }}
          style={{
            'padding-left': `${p.depth * 14 + 4}px`,
            // indent guides, one hairline per level
            'background-image': 'repeating-linear-gradient(to right, oklch(100% 0 0 / 0.07) 0 1px, transparent 1px 14px)',
            'background-size': `${p.depth * 14}px 100%`,
            'background-position': '11px 0',
            'background-repeat': 'no-repeat',
          }}
          onClick={() => select(p.node, true)}
        >
          <Show when={sel()}>
            <span class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
          </Show>
          <span
            class="size-4 shrink-0 grid place-items-center text-base-content/40 hover:text-base-content"
            onClick={(e) => {
              e.stopPropagation();
              if (!p.flat) toggle(p.node.uniqueId);
            }}
          >
            <Show when={!p.flat && kids().length}>
              <Icon d={ICON.chevron} class={`size-3 transition-transform duration-200 ${open() ? 'rotate-90' : ''}`} />
            </Show>
          </span>
          <span class="truncate" classList={{ 'font-medium': sel() }} title={p.flat ? pathOf(p.node) : p.node.name}>
            {p.node.name}
          </span>
          <Show when={kids().length}>
            <span class="font-mono text-[10px] tabular-nums leading-4 px-1 rounded bg-base-content/6 text-base-content/45">{kids().length}</span>
          </Show>
          <span class="font-mono text-[10px] text-base-content/25 truncate">{p.node.getClassName()}</span>
          {/* overlays the row's right edge so hidden actions don't steal width from the name */}
          <span class="absolute inset-y-0 right-0 flex items-center gap-0.5 pl-6 pr-1 rounded-r-md from-(--row) from-70% to-transparent pointer-events-none group-hover:bg-linear-to-l"
            classList={{ 'bg-linear-to-l': isolated() === p.node || !enabled() }}
          >
            <button
              class={`${rowBtn} ${hiddenBtn} text-base-content/50 hover:text-base-content hover:bg-base-content/10`}
              title={t().focus}
              aria-label={t().focus}
              onClick={(e) => {
                e.stopPropagation();
                select(p.node, true);
              }}
            >
              <Icon d={ICON.focus} />
            </button>
            <button
              class={rowBtn}
              classList={{
                'pointer-events-auto bg-primary text-primary-content': isolated() === p.node,
                [`${hiddenBtn} text-base-content/50 hover:text-base-content hover:bg-base-content/10`]: isolated() !== p.node,
              }}
              title={t().isolateTip}
              aria-label={t().isolateTip}
              aria-pressed={isolated() === p.node}
              onClick={(e) => {
                e.stopPropagation();
                if (isolated() === p.node) return isolate(null);
                select(p.node, false);
                isolate(p.node);
              }}
            >
              <Icon d={ICON.isolate} />
            </button>
            <button
              class={`${rowBtn} hover:bg-base-content/10`}
              classList={{
                [`${hiddenBtn} text-base-content/50 hover:text-base-content`]: enabled(),
                'pointer-events-auto text-base-content': !enabled(),
              }}
              title={t().toggleVis}
              aria-label={t().toggleVis}
              aria-pressed={!enabled()}
              onClick={(e) => {
                e.stopPropagation();
                p.node.setEnabled(!p.node.isEnabled(false));
                setTick(tick() + 1);
              }}
            >
              <Icon d={enabled() ? ICON.eye : ICON.eyeOff} />
            </button>
          </span>
        </div>
        <Show when={!p.flat && open()}>
          <For each={kids()}>{(c) => <Row node={c} depth={p.depth + 1} />}</For>
        </Show>
      </>
    );
  };

  // floating panels over the full-bleed viewer; hidden = slid off-screen
  const panel =
    'absolute z-10 top-2 flex flex-col overflow-hidden rounded-box bg-base-100 border border-base-content/8 shadow-2xl shadow-black/50 transition-[translate,opacity] duration-400 ease-out-expo';
  const toggleBtn =
    'absolute z-20 top-2 size-9 grid place-items-center rounded-xl bg-base-100/80 backdrop-blur-md border border-base-content/8 shadow-lg shadow-black/30 text-base-content/60 hover:text-base-content transition-[left,right,color] duration-400 ease-out-expo';
  const actBtn = 'btn btn-sm h-8 justify-start gap-2 font-normal bg-base-content/5 border-base-content/5 hover:bg-base-content/10 hover:border-base-content/10';

  return (
    <div
      class="relative h-screen overflow-hidden"
      // x-offsets for anything that must sit beside the open panels
      style={{ '--l': leftOpen() ? '356px' : '8px', '--r': rightOpen() ? '336px' : '8px' }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={(e) => isFile(e) && dragDepth++ === 0 && setDragging(true)}
      onDragLeave={(e) => isFile(e) && --dragDepth === 0 && setDragging(false)}
      onDrop={onDrop}
    >
      <aside class={`${panel} left-2 bottom-2 w-[340px]`} classList={{ '-translate-x-[calc(100%+1rem)] opacity-0': !leftOpen() }} inert={!leftOpen()}>
        <div class="h-full flex flex-col">
          <div class="p-4 pb-3 space-y-4">
            <div class="flex items-center gap-2.5">
              <div class="size-8 grid place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon d={ICON.cube} class="size-4.5" />
              </div>
              <div class="leading-tight">
                <h1 class="text-[15px] font-semibold tracking-tight">GLB Inspector</h1>
                <div class="text-[11px] text-base-content/45 truncate max-w-40" title={fileName() || t().dropHint}>
                  {fileName() || t().dropHint}
                </div>
              </div>
              <button class="btn btn-ghost btn-sm h-8 px-2 ml-auto font-normal text-base-content/60 hover:text-base-content" title="Language / 語言" onClick={toggleLang}>
                {lang() === 'zh' ? 'EN' : '中文'}
              </button>
              <label class="btn btn-primary btn-sm h-8 gap-1.5 px-3 font-medium">
                <Icon d={ICON.upload} />
                {t().open}
                <input type="file" accept=".glb,.gltf" class="hidden" onChange={onFile} />
              </label>
            </div>
            <div class="flex rounded-lg bg-base-200 ring-1 ring-base-content/5 divide-x divide-base-content/6">
              <For each={[[t().nodes, stats().nodes], ['Mesh', stats().meshes], [t().vertices, stats().vertices], [t().materials, stats().materials], [t().textures, stats().textures]] as const}>
                {([k, v]) => (
                  <div class="flex-auto px-2.5 py-2">
                    <div class="text-[10px] text-base-content/45 whitespace-nowrap">{k}</div>
                    <div class="font-mono text-[12px] tabular-nums mt-0.5">
                      {fmt(v)}
                    </div>
                  </div>
                )}
              </For>
            </div>
            <label class="input input-sm h-9 w-full gap-2 bg-base-200 border-base-content/6 focus-within:border-primary/50 focus-within:outline-none">
              <Icon d={ICON.search} class="size-4 text-base-content/40" />
              <input type="search" class="grow" placeholder={t().search} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
            </label>
          </div>
          <div class="flex-1 overflow-auto pb-2 border-t border-base-content/6 pt-1.5">
            <Show when={query().trim()} fallback={<For each={roots()}>{(n) => <Row node={n} depth={0} />}</For>}>
              <div class="eyebrow px-4 py-1.5">{matches().length >= 300 ? t().top300 : t().results(matches().length)}</div>
              <For each={matches()}>{(n) => <Row node={n} depth={0} flat />}</For>
            </Show>
          </div>
        </div>
      </aside>

      <main
        class="stage absolute inset-0 overflow-hidden after:pointer-events-none after:absolute after:inset-0 after:ring-2 after:ring-inset after:transition-colors after:duration-300"
        classList={{ 'after:ring-primary/60': dragging(), 'after:ring-transparent': !dragging() }}
      >
        <canvas ref={canvas} class="absolute inset-0 w-full h-full outline-none block" />
        <Show when={!roots().length && progress() === null}>
          <label class="rise absolute inset-0 grid place-items-center cursor-pointer">
            <div class="text-center space-y-5">
              <div
                class="mx-auto size-20 grid place-items-center rounded-2xl border border-dashed text-primary transition-all duration-300"
                classList={{ 'border-primary bg-primary/10 scale-110': dragging(), 'border-base-content/15': !dragging() }}
              >
                <Icon d={ICON.cube} class="size-9" />
              </div>
              <div>
                <div class="text-2xl font-medium tracking-tight">{t().emptyTitle}</div>
                <div class="text-sm text-base-content/45 mt-1.5">{t().emptySub}</div>
              </div>
            </div>
            <input type="file" accept=".glb,.gltf" class="hidden" onChange={onFile} />
          </label>
        </Show>
        <Show when={progress() !== null}>
          <div class="absolute inset-0 grid place-items-center bg-base-200/50 backdrop-blur-sm">
            <div class="rise w-72 space-y-3" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress()! * 100)}>
              <div class="flex items-end justify-between">
                <div class="eyebrow">{t().loading}</div>
                <div class="font-mono text-4xl font-light tabular-nums leading-none">
                  {Math.round(progress()! * 100)}
                  <span class="text-base text-base-content/40">%</span>
                </div>
              </div>
              <div class="h-0.5 rounded-full bg-base-content/10 overflow-hidden">
                <div class="h-full bg-primary transition-[width] duration-200" style={{ width: `${progress()! * 100}%` }} />
              </div>
              <div class="text-xs text-base-content/40 truncate">{fileName()}</div>
            </div>
          </div>
        </Show>
        <Show when={error()}>
          <div class="rise absolute z-20 top-14 left-[calc(var(--l)+4px)] right-[calc(var(--r)+4px)] flex gap-2.5 items-start rounded-xl border border-error/30 bg-error/10 backdrop-blur-md px-3.5 py-3 text-sm text-error">
            <Icon d={ICON.alert} class="size-4 shrink-0 mt-0.5" />
            <span class="break-all">{error()}</span>
          </div>
        </Show>
        <Show when={isolated()}>
          {(n) => (
            <button
              class="rise absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 h-8 pl-3 pr-1.5 rounded-full bg-primary text-primary-content text-xs font-medium shadow-lg shadow-primary/20 cursor-pointer max-w-[70%]"
              onClick={() => isolate(null)}
            >
              <Icon d={ICON.isolate} />
              <span class="truncate">
                {t().isolated}
                {n().name}
              </span>
              <kbd class="font-mono text-[10px] px-1.5 h-5 grid place-items-center rounded-full bg-primary-content/10">Esc</kbd>
              <Icon d={ICON.x} class="size-3.5 mr-1" />
            </button>
          )}
        </Show>
        <Show when={roots().length}>
          <div class="absolute bottom-3 left-[calc(var(--l)+4px)] flex flex-wrap gap-1 max-w-[40%] pointer-events-none transition-[left] duration-400 ease-out-expo">
            <For each={t().controls}>
              {(c) => <span class="px-2 h-6 grid place-items-center rounded-md bg-base-100/75 backdrop-blur-md border border-base-content/6 text-[11px] text-base-content/55">{c}</span>}
            </For>
          </div>
        </Show>
        <Show when={axes().length}>
          <svg class="absolute bottom-3 right-3 size-28 pointer-events-none" viewBox="-56 -56 112 112">
            <circle r="55" fill="oklch(19% 0.006 260 / 0.55)" stroke="oklch(100% 0 0 / 0.06)" />
            {/* Index keeps the 6 <g> nodes across frames (For would rebuild them, dropping clicks mid-motion) */}
            <Index each={axes()}>
              {(a) => (
                <g
                  class="cursor-pointer pointer-events-auto"
                  onClick={() => {
                    const cam = scene?.activeCamera as ArcRotateCamera | null;
                    if (!cam) return;
                    const d = a().d;
                    stopFly();
                    cam.inertialAlphaOffset = cam.inertialBetaOffset = 0;
                    if (d.y === 0) cam.alpha = Math.atan2(d.z, d.x); // ±Y keeps current heading
                    cam.beta = Math.acos(d.y); // look from this axis
                  }}
                >
                  <title>{(a().neg ? '-' : '+') + a().label}</title>
                  <Show when={!a().neg}>
                    <line x1="0" y1="0" x2={a().x * 38} y2={a().y * 38} stroke={a().color} stroke-width="2" stroke-linecap="round" />
                  </Show>
                  <circle
                    cx={a().x * 38}
                    cy={a().y * 38}
                    r={a().neg ? 6 : 9}
                    fill={a().color}
                    fill-opacity={a().neg ? 0.2 : 1}
                    stroke={a().color}
                    stroke-opacity={a().neg ? 0.6 : 1}
                    stroke-width="1.25"
                  />
                  <Show when={!a().neg}>
                    <text
                      x={a().x * 38}
                      y={a().y * 38}
                      dy="0.35em"
                      text-anchor="middle"
                      font-size="10"
                      font-weight="600"
                      font-family="Geist Mono, ui-monospace, monospace"
                      fill="#0d0e10"
                    >
                      {a().label}
                    </text>
                  </Show>
                </g>
              )}
            </Index>
          </svg>
        </Show>
      </main>

      {/* panel toggles ride just outside each panel's edge, so they stay reachable when it's hidden */}
      <button
        class={`${toggleBtn} left-(--l)`}
        classList={{ 'text-primary': leftOpen() }}
        title={t().togglePanel}
        aria-label={t().togglePanel}
        aria-expanded={leftOpen()}
        onClick={() => setLeftOpen(!leftOpen())}
      >
        <Icon d={ICON.sidebarL} class="size-4" />
      </button>
      <button
        class={`${toggleBtn} right-(--r)`}
        classList={{ 'text-primary': rightOpen() }}
        title={t().togglePanel}
        aria-label={t().togglePanel}
        aria-expanded={rightOpen()}
        onClick={() => setRightOpen(!rightOpen())}
      >
        <Icon d={ICON.sidebarR} class="size-4" />
      </button>

      <aside
        class={`${panel} right-2 w-[320px] max-h-[calc(100%-9rem)]`}
        classList={{ 'translate-x-[calc(100%+1rem)] opacity-0': !rightOpen() }}
        inert={!rightOpen()}
      >
        <div class="min-h-0 overflow-auto text-sm">
          <Show
            when={info()}
            fallback={
              <div class="flex items-center gap-3 px-4 py-3.5">
                <Icon d={ICON.focus} class="size-5 shrink-0 text-base-content/30" />
                <div class="text-[13px] text-base-content/50 leading-snug">{t().pickHint}</div>
              </div>
            }
          >
            {(i) => (
              <div class="rise">
                <div class="p-4 space-y-3 border-b border-base-content/6">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary ring-1 ring-primary/20">{i().type}</span>
                  </div>
                  <div class="text-base font-semibold tracking-tight leading-snug wrap-break-word">{i().node.name}</div>
                  <div class="font-mono text-[11px] text-base-content/40 wrap-break-word leading-relaxed">{i().path}</div>
                  <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <button class={actBtn} onClick={() => copy('path', i().path)}>
                      <Icon d={copied() === 'path' ? ICON.check : ICON.copy} class="size-3.5 text-base-content/60" />
                      {copied() === 'path' ? t().copied : t().copyPath}
                    </button>
                    <Show when={i().node instanceof TransformNode && (i().node as TransformNode)}>
                      {(tn) => (
                        <>
                          <button class={actBtn} title={t().worldTip} onClick={() => copy('world', JSON.stringify(gltfWorld(tn())))}>
                            <Icon d={copied() === 'world' ? ICON.check : ICON.matrix} class="size-3.5 text-base-content/60" />
                            {copied() === 'world' ? t().copied : t().copyWorld}
                          </button>
                          <button class={actBtn} title={t().exportTip} onClick={() => exportGlb(tn())}>
                            <Icon d={ICON.download} class="size-3.5 text-base-content/60" />
                            {t().exportGlb}
                          </button>
                        </>
                      )}
                    </Show>
                    <Show when={i().node.parent}>
                      <button class={actBtn} onClick={() => select(i().node.parent, true)}>
                        <Icon d={ICON.up} class="size-3.5 text-base-content/60" />
                        {t().parent}
                      </button>
                    </Show>
                  </div>
                </div>
                <dl class="p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-baseline border-b border-base-content/6">
                  <For
                    each={[
                      [t().children, fmt(i().children)],
                      [t().descendants, fmt(i().descendants)],
                      [t().meshCount, fmt(i().meshes)],
                      [t().vertices, fmt(i().vertices)],
                      [t().triangles, fmt(i().triangles)],
                      ['Position', i().position],
                      ['Rotation°', i().rotation],
                      ['Scaling', i().scaling],
                      [t().size, i().size],
                      [t().center, i().center],
                    ].filter(([, v]) => v)}
                  >
                    {([k, v]) => (
                      <>
                        <dt class="text-[12px] text-base-content/50 whitespace-nowrap">{k}</dt>
                        <dd class="font-mono text-[12px] tabular-nums text-right min-w-0">
                          <Show when={v!.includes(', ')} fallback={v}>
                            <span class="grid grid-cols-3 gap-2">
                              <For each={v!.split(', ')}>
                                {(c, j) => (
                                  <span class="flex items-baseline justify-end gap-1 min-w-0">
                                    <span class="size-1 rounded-full shrink-0 self-center" style={{ background: AXES[j() * 2].color }} />
                                    <span class="truncate" title={c}>
                                      {c}
                                    </span>
                                  </span>
                                )}
                              </For>
                            </span>
                          </Show>
                        </dd>
                      </>
                    )}
                  </For>
                </dl>
                <Show when={i().materials.length}>
                  <div class="p-4 space-y-2 border-b border-base-content/6">
                    <div class="eyebrow">
                      {t().materials} · {i().materials.length}
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <For each={i().materials}>{(m) => <span class="text-[11px] px-2 py-0.5 rounded-md bg-base-content/6 text-base-content/75 wrap-break-word">{m}</span>}</For>
                    </div>
                  </div>
                </Show>
                <Show when={i().metadata}>
                  <div class="p-4 space-y-2">
                    <div class="eyebrow">Metadata</div>
                    <pre class="font-mono text-[11px] leading-relaxed bg-base-200 ring-1 ring-base-content/5 p-3 rounded-lg overflow-auto text-base-content/75">{i().metadata}</pre>
                  </div>
                </Show>
              </div>
            )}
          </Show>
        </div>
      </aside>
    </div>
  );
}
