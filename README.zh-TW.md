[English](README.md) | **繁體中文**

# GLB Inspector

**拖進 GLB，3 秒看懂整個模型結構。**

純前端的 GLB / glTF 檢視工具：瀏覽節點樹、點選部件、查看尺寸與材質、隔離單一零件，甚至把子樹匯出成獨立 GLB。
拿到一個陌生的 3D 模型，想知道「裡面有什麼、怎麼拆、座標在哪」？打開它就有答案。

**[🚀 線上試用 →](https://cainmaila.github.io/glb-inspector/)**

> 🔒 **完全在瀏覽器內執行**：模型檔不會上傳到任何伺服器。

## 為什麼需要它

接手 3D 模型做軟體整合時，常見的痛點：

- 幾千個節點，名稱與階層只存在於 DCC 工具或 JSON 裡，難以閱讀
- 想知道某個零件的世界座標、尺寸、材質，卻得寫程式印 log
- 想單獨拆出一個部件給前端或同事使用，還要回頭開建模軟體

GLB Inspector 把這些事縮成「拖放、點擊、複製」。

## 功能

| | |
|---|---|
| 🌳 **節點樹** | 完整階層、子節點數量、型別標示；點 3D 模型會自動展開並捲動到對應節點 |
| 🔍 **即時搜尋** | 依節點名稱過濾，結果以完整路徑呈現 |
| 🎯 **平滑聚焦** | 相機緩動飛到選取部件，手動操作即中斷 |
| ◎ **隔離模式** | 其餘部件變半透明、目標維持不透明，`Esc` 還原 |
| 👁 **顯示 / 隱藏** | 逐節點切換可見性 |
| 📊 **屬性面板** | Position / Rotation / Scaling、世界尺寸與中心、頂點與三角形數、材質、glTF metadata |
| 📋 **一鍵複製** | 節點路徑、**glTF 座標的世界矩陣**（16 數 column-major）可直接貼進程式 |
| 📦 **匯出子樹 GLB** | 選一個節點，連同後代匯出為獨立 GLB，位移歸零置於原點 |
| 📈 **模型統計** | 節點、Mesh、頂點、材質、貼圖總數一目了然 |
| 🖱 **拖放載入** | 拖進視窗或用檔案選擇器，支援 `.glb` / `.gltf`，附載入進度 |

## 快速開始

```bash
pnpm install
pnpm dev
```

開啟畫面後把 `.glb` 拖進視窗即可。

### 其他指令

```bash
pnpm build     # 型別檢查 + 產生靜態檔至 dist/
pnpm preview   # 預覽建置結果
```

產出為純靜態檔案，可直接部署到 GitHub Pages、Cloudflare Pages、Netlify 等任何靜態主機。

### 操作

- 左鍵旋轉・右鍵平移・滾輪縮放・點擊選取
- `Esc`：離開隔離模式

### 本機驗證模型（選用）

在專案根目錄放一個 `sample.glb`（已 gitignore，並於 `public/` 建立 symlink），啟動時會自動載入，方便開發時免去手動拖放。

## 技術棧

[Vite](https://vite.dev) · [SolidJS](https://www.solidjs.com) · [Babylon.js](https://www.babylonjs.com) · [Tailwind CSS](https://tailwindcss.com) + [daisyUI](https://daisyui.com) · TypeScript

Babylon.js 以子路徑 import 方式引入，只打包用到的模組。

## 適合誰

3D 工程師、前端 / WebGL 開發者、技術美術、需要評估模型再規劃後續開發的任何人。

## 授權

[MIT](LICENSE)
