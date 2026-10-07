import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { AppendSceneAsync, SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Node } from '@babylonjs/core/node';
import '@babylonjs/core/Helpers/sceneHelpers';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/loaders/glTF';
import { lang, t, toggleLang } from './i18n';
import { GLTF2Export } from '@babylonjs/serializers/glTF/2.0';

SceneLoader.ShowLoadingScreen = false; // own progress overlay below

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
    mat.emissiveColor = Color3.Yellow();
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
    setProgress(0);
    setFileName(typeof src === 'string' ? src : src.name);
    const s = (scene = new Scene(engine));
    s.skipPointerMovePicking = true; // thousands of meshes: don't raycast on every mouse move
    try {
      await AppendSceneAsync(src, s, {
        pluginExtension: '.glb',
        onProgress: (e) => e.lengthComputable && setProgress(e.loaded / e.total),
      });
    } catch (e) {
      setError(String(e));
      setProgress(null);
      return;
    }
    const r = s.rootNodes.slice();
    s.createDefaultCamera(true, true, true);
    s.createDefaultLight(true);
    const cam = s.activeCamera as ArcRotateCamera;
    cam.wheelDeltaPercentage = 0.02;
    cam.minZ = 0.01;
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
      textures: scene?.textures.length ?? 0,
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
      size: bb && v3(bb.max.subtract(bb.min)),
      center: bb && v3(bb.min.add(bb.max).scale(0.5)),
      metadata: n.metadata && Object.keys(n.metadata).length ? JSON.stringify(n.metadata, null, 2) : '',
    };
  });

  onMount(() => {
    engine = new Engine(canvas, true);
    engine.runRenderLoop(() => scene?.activeCamera && scene.render());
    const resize = () => engine.resize();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && isolated() && isolate(null);
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
    onCleanup(() => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      engine.dispose();
    });
    if (import.meta.env.DEV) load('sample.glb');
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) load(f);
  };

  const Row = (p: { node: Node; depth: number; flat?: boolean }) => {
    const kids = () => p.node.getChildren();
    const open = () => expanded().has(p.node.uniqueId);
    const enabled = () => (tick(), p.node.isEnabled(false));
    return (
      <>
        <div
          data-id={p.node.uniqueId}
          class="group flex items-center gap-1 pr-2 cursor-pointer hover:bg-base-300 text-sm whitespace-nowrap"
          classList={{ 'bg-primary/30': selected() === p.node, 'opacity-40': !enabled() }}
          style={{ 'padding-left': `${p.depth * 12 + 4}px` }}
          onClick={() => select(p.node, true)}
        >
          <span
            class="w-4 text-center text-base-content/60"
            onClick={(e) => {
              e.stopPropagation();
              if (!p.flat) toggle(p.node.uniqueId);
            }}
          >
            {!p.flat && kids().length ? (open() ? '▾' : '▸') : ''}
          </span>
          <span class="truncate" title={p.flat ? pathOf(p.node) : p.node.name}>
            {p.node.name}
          </span>
          <Show when={kids().length}>
            <span class="badge badge-xs badge-ghost">{kids().length}</span>
          </Show>
          <span class="text-[10px] text-base-content/40">{p.node.getClassName()}</span>
          <button
            class="ml-auto btn btn-ghost btn-xs px-1 opacity-0 group-hover:opacity-100"
            title={t().focus}
            onClick={(e) => {
              e.stopPropagation();
              select(p.node, true);
            }}
          >
            🎯
          </button>
          <button
            class="btn btn-xs px-1"
            classList={{
              'btn-warning': isolated() === p.node,
              'btn-ghost opacity-0 group-hover:opacity-100': isolated() !== p.node,
            }}
            title={t().isolateTip}
            onClick={(e) => {
              e.stopPropagation();
              if (isolated() === p.node) return isolate(null);
              select(p.node, false);
              isolate(p.node);
            }}
          >
            ◎
          </button>
          <button
            class="btn btn-ghost btn-xs px-1"
            title={t().toggleVis}
            onClick={(e) => {
              e.stopPropagation();
              p.node.setEnabled(!p.node.isEnabled(false));
              setTick(tick() + 1);
            }}
          >
            {enabled() ? '👁' : '—'}
          </button>
        </div>
        <Show when={!p.flat && open()}>
          <For each={kids()}>{(c) => <Row node={c} depth={p.depth + 1} />}</For>
        </Show>
      </>
    );
  };

  return (
    <div class="h-screen grid grid-cols-[360px_1fr_320px] bg-base-100" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <aside class="flex flex-col min-h-0 border-r border-base-300">
        <div class="p-3 space-y-2 border-b border-base-300">
          <div class="flex items-center gap-2">
            <h1 class="font-bold">GLB Inspector</h1>
            <button class="btn btn-sm btn-ghost ml-auto" onClick={toggleLang}>
              {lang() === 'zh' ? 'EN' : '中文'}
            </button>
            <label class="btn btn-sm btn-primary">
              {t().open}
              <input type="file" accept=".glb,.gltf" class="hidden" onChange={(e) => e.currentTarget.files?.[0] && load(e.currentTarget.files[0])} />
            </label>
          </div>
          <div class="text-xs text-base-content/60 truncate" title={fileName()}>
            {fileName()}{t().dropHint}
          </div>
          <div class="grid grid-cols-5 gap-1 text-center text-xs">
            <For each={[[t().nodes, stats().nodes], ['Mesh', stats().meshes], [t().vertices, stats().vertices], [t().materials, stats().materials], [t().textures, stats().textures]] as const}>
              {([k, v]) => (
                <div class="bg-base-200 rounded p-1">
                  <div class="text-base-content/60">{k}</div>
                  <div class="font-mono">{fmt(v)}</div>
                </div>
              )}
            </For>
          </div>
          <input class="input input-sm w-full" placeholder={t().search} value={query()} onInput={(e) => setQuery(e.currentTarget.value)} />
        </div>
        <div class="flex-1 overflow-auto py-1">
          <Show when={query().trim()} fallback={<For each={roots()}>{(n) => <Row node={n} depth={0} />}</For>}>
            <div class="px-3 text-xs text-base-content/60">{matches().length >= 300 ? t().top300 : t().results(matches().length)}</div>
            <For each={matches()}>{(n) => <Row node={n} depth={0} flat />}</For>
          </Show>
        </div>
      </aside>

      <main class="relative min-w-0">
        <canvas ref={canvas} class="w-full h-full outline-none block" />
        <Show when={progress() !== null}>
          <div class="absolute inset-0 grid place-items-center bg-base-100/70">
            <div class="w-64 text-center space-y-2">
              <div>{t().loading} {Math.round(progress()! * 100)}%</div>
              <progress class="progress progress-primary w-full" value={progress()!} max="1" />
            </div>
          </div>
        </Show>
        <Show when={error()}>
          <div class="absolute top-3 left-3 right-3 alert alert-error text-sm">{error()}</div>
        </Show>
        <Show when={isolated()}>
          {(n) => (
            <button class="absolute top-3 left-3 badge badge-warning cursor-pointer" onClick={() => isolate(null)}>
              {t().isolated}{n().name}　✕ / Esc
            </button>
          )}
        </Show>
        <div class="absolute bottom-2 left-3 text-xs text-base-content/50">{t().controls}</div>
      </main>

      <aside class="overflow-auto border-l border-base-300 p-3 text-sm">
        <Show when={info()} fallback={<div class="text-base-content/50">{t().pickHint}</div>}>
          {(i) => (
            <div class="space-y-3">
              <div>
                <div class="font-bold break-all">{i().node.name}</div>
                <div class="badge badge-sm badge-outline mt-1">{i().type}</div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-xs" onClick={() => navigator.clipboard.writeText(i().path)}>{t().copyPath}</button>
                <Show when={i().node instanceof TransformNode && (i().node as TransformNode)}>
                  {(tn) => (
                    <>
                      <button
                        class="btn btn-xs"
                        title={t().worldTip}
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(gltfWorld(tn())))}
                      >
                        {t().copyWorld}
                      </button>
                      <button class="btn btn-xs" title={t().exportTip} onClick={() => exportGlb(tn())}>
                        {t().exportGlb}
                      </button>
                    </>
                  )}
                </Show>
                <Show when={i().node.parent}>
                  <button class="btn btn-xs" onClick={() => select(i().node.parent, true)}>{t().parent}</button>
                </Show>
              </div>
              <div class="text-xs text-base-content/60 break-all">{i().path}</div>
              <table class="table table-xs">
                <tbody>
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
                      <tr>
                        <th class="whitespace-nowrap">{k}</th>
                        <td class="font-mono break-all">{v}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <Show when={i().materials.length}>
                <div>
                  <div class="font-semibold mb-1">{t().materials} ({i().materials.length})</div>
                  <div class="flex flex-wrap gap-1">
                    <For each={i().materials}>{(m) => <span class="badge badge-sm">{m}</span>}</For>
                  </div>
                </div>
              </Show>
              <Show when={i().metadata}>
                <div>
                  <div class="font-semibold mb-1">Metadata</div>
                  <pre class="text-xs bg-base-200 p-2 rounded overflow-auto">{i().metadata}</pre>
                </div>
              </Show>
            </div>
          )}
        </Show>
      </aside>
    </div>
  );
}
