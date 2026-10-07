**English** | [繁體中文](README.zh-TW.md)

# GLB Inspector

**Drop in a GLB. Understand the whole model in seconds.**

A pure front-end viewer for GLB / glTF: browse the node tree, click any part, read its size and materials, isolate a single piece, and even export a subtree as a standalone GLB.
Got an unfamiliar 3D model and need to know what's inside, how it's split up, and where things sit in space? Open it here.

> 🔒 **Runs entirely in your browser.** Your model is never uploaded to any server.

## Why

When you integrate a 3D model into software, you usually hit these problems:

- Thousands of nodes, with names and hierarchy buried in a DCC tool or raw JSON
- You need a part's world position, size, or material, and end up writing code just to log it
- You want to hand one part to a teammate, and have to reopen the modelling software

GLB Inspector turns all of that into drag, click, copy.

## Features

| | |
|---|---|
| 🌳 **Node tree** | Full hierarchy with child counts and node types. Clicking the 3D model expands and scrolls to the matching node |
| 🔍 **Live search** | Filter by node name; results show the full path |
| 🎯 **Smooth focus** | The camera eases to the selected part. Any manual input cancels the flight |
| ◎ **Isolate mode** | Everything else turns see-through while the target stays opaque. `Esc` restores |
| 👁 **Show / hide** | Toggle visibility per node |
| 📊 **Property panel** | Position / Rotation / Scaling, world size and center, vertex and triangle counts, materials, glTF metadata |
| 📋 **One-click copy** | Node path and the **world matrix in glTF space** (16 numbers, column-major), ready to paste into code |
| 📦 **Export subtree** | Export a node and its descendants as a standalone GLB, moved to the origin |
| 📈 **Model stats** | Totals for nodes, meshes, vertices, materials and textures |
| 🖱 **Drag & drop** | Drop onto the window or use the file picker. Supports `.glb` / `.gltf`, with a loading progress bar |

## Quick start

```bash
pnpm install
pnpm dev
```

Then drag a `.glb` onto the window.

### Other commands

```bash
pnpm build     # type-check + emit static files to dist/
pnpm preview   # preview the build
```

The output is plain static files. Deploy to GitHub Pages, Cloudflare Pages, Netlify, or any static host.

### Controls

- Left-drag to rotate, right-drag to pan, scroll to zoom, click to select
- `Esc`: leave isolate mode

### Local test model (optional)

Put a `sample.glb` in the repo root (gitignored, symlinked into `public/`). It loads automatically on start, so you can skip the manual drop while developing.

## Tech stack

[Vite](https://vite.dev) · [SolidJS](https://www.solidjs.com) · [Babylon.js](https://www.babylonjs.com) · [Tailwind CSS](https://tailwindcss.com) + [daisyUI](https://daisyui.com) · TypeScript

Babylon.js is imported by subpath, so only the modules in use get bundled.

## Who it's for

3D engineers, front-end / WebGL developers, technical artists, and anyone who needs to assess a model before planning follow-up work.

## License

[MIT](LICENSE)
