import { createSignal } from 'solid-js';

const zh = {
  focus: '聚焦',
  isolateTip: '隔離（其他部件透明，Esc 取消）',
  toggleVis: '顯示/隱藏',
  open: '開啟 GLB',
  dropHint: '（可拖放檔案到視窗）',
  nodes: '節點',
  vertices: '頂點',
  materials: '材質',
  textures: '貼圖',
  search: '搜尋節點名稱…',
  top300: '前 300 筆',
  results: (n: number) => `${n} 筆`,
  loading: '載入中',
  isolated: '隔離：',
  controls: '左鍵旋轉・右鍵平移・滾輪縮放・點擊選取',
  pickHint: '點選樹狀節點或模型部件查看資訊',
  copyPath: '複製路徑',
  worldTip: 'glTF 座標，16 數 column-major，可直接套在 root',
  copyWorld: '複製世界矩陣',
  exportTip: '此節點含子層，位移歸零',
  exportGlb: '匯出 GLB',
  parent: '上層',
  children: '子節點',
  descendants: '所有後代',
  meshCount: 'Mesh 數',
  triangles: '三角形',
  size: '尺寸 (world)',
  center: '中心 (world)',
  hdrError: '環境光 HDR 載入失敗',
};

const en: typeof zh = {
  focus: 'Focus',
  isolateTip: 'Isolate (others transparent, Esc to cancel)',
  toggleVis: 'Show/Hide',
  open: 'Open GLB',
  dropHint: ' (or drop a file onto the window)',
  nodes: 'Nodes',
  vertices: 'Vertices',
  materials: 'Materials',
  textures: 'Textures',
  search: 'Search node name…',
  top300: 'First 300',
  results: (n: number) => `${n} results`,
  loading: 'Loading',
  isolated: 'Isolated: ',
  controls: 'Left drag rotate · Right drag pan · Wheel zoom · Click select',
  pickHint: 'Select a tree node or model part to view info',
  copyPath: 'Copy path',
  worldTip: 'glTF coords, 16 numbers column-major, apply directly under root',
  copyWorld: 'Copy world matrix',
  exportTip: 'Includes children, transform reset to origin',
  exportGlb: 'Export GLB',
  parent: 'Parent',
  children: 'Children',
  descendants: 'Descendants',
  meshCount: 'Meshes',
  triangles: 'Triangles',
  size: 'Size (world)',
  center: 'Center (world)',
  hdrError: 'Failed to load environment HDR',
};

type Lang = 'en' | 'zh';
let saved: string | null = null;
try {
  saved = localStorage.getItem('lang'); // throws when storage is blocked
} catch {}
const [lang, setLang] = createSignal<Lang>(saved === 'zh' || saved === 'en' ? saved : navigator.language.startsWith('zh') ? 'zh' : 'en');
const apply = (l: Lang) => {
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
  setLang(l);
};
apply(lang());

export { lang };
export const t = () => (lang() === 'zh' ? zh : en);
export const toggleLang = () => {
  const l = lang() === 'zh' ? 'en' : 'zh';
  apply(l);
  try {
    localStorage.setItem('lang', l);
  } catch {}
};
