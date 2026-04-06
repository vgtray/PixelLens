import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/src/content/ui/ContentApp.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--10e64c58.js"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/vendor/react-refresh.js";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--10e64c58.js"; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useCallback = __vite__cjsImport3_react["useCallback"];
import __vite__cjsImport4_reactDom_client from "/vendor/.vite-deps-react-dom_client.js__v--10e64c58.js"; const createRoot = __vite__cjsImport4_reactDom_client["createRoot"];
import { FloatingToolbar } from "/src/content/ui/FloatingToolbar.tsx.js";
import { InspectorTooltip } from "/src/content/ui/InspectorTooltip.tsx.js";
import { sendMessage } from "/src/lib/messaging.ts.js";
import { MessageType } from "/src/types/messages.ts.js";
function ContentApp() {
  _s();
  const [mode, setMode] = useState("off");
  const [tooltip, setTooltip] = useState(null);
  const [gridVisible, setGridVisible] = useState(false);
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      setMode(detail.mode);
    };
    document.addEventListener("pixellens:mode-change", handler);
    return () => document.removeEventListener("pixellens:mode-change", handler);
  }, []);
  useEffect(() => {
    if (mode !== "inspect") {
      setTooltip(null);
      return;
    }
    const handler = (e) => {
      const target = e.target;
      if (!target || isPixelLensElement(target)) {
        setTooltip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const className = target.className?.toString() || "";
      const truncated = className.length > 30 ? className.slice(0, 30) + "..." : className;
      setTooltip({
        tagName: target.tagName.toLowerCase(),
        className: truncated,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: e.clientX,
        y: e.clientY
      });
    };
    document.addEventListener("mousemove", handler, { passive: true });
    return () => document.removeEventListener("mousemove", handler);
  }, [mode]);
  const handleModeChange = useCallback((newMode) => {
    if (newMode === mode) {
      setMode("off");
      sendMessage(MessageType.TOGGLE_INSPECT, { active: false });
      return;
    }
    setMode(newMode);
    if (newMode === "inspect") {
      sendMessage(MessageType.TOGGLE_INSPECT, { active: true });
    } else if (newMode === "measure") {
      sendMessage(MessageType.TOGGLE_INSPECT, { active: false });
      sendMessage(MessageType.TOGGLE_MEASURE, { active: true });
    }
  }, [mode]);
  const handleGridToggle = useCallback(() => {
    const next = !gridVisible;
    setGridVisible(next);
    sendMessage(MessageType.TOGGLE_GRID, { visible: next });
  }, [gridVisible]);
  const handleScan = useCallback(() => {
    sendMessage(MessageType.SCAN_PAGE, void 0);
  }, []);
  return /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV(
      FloatingToolbar,
      {
        mode,
        gridVisible,
        onModeChange: handleModeChange,
        onGridToggle: handleGridToggle,
        onScan: handleScan
      },
      void 0,
      false,
      {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx",
        lineNumber: 117,
        columnNumber: 7
      },
      this
    ),
    tooltip && /* @__PURE__ */ jsxDEV(InspectorTooltip, { data: tooltip }, void 0, false, {
      fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx",
      lineNumber: 124,
      columnNumber: 19
    }, this)
  ] }, void 0, true, {
    fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx",
    lineNumber: 116,
    columnNumber: 5
  }, this);
}
_s(ContentApp, "pBKEdD+ZF7NgzPaxO7GepoUI2No=");
_c = ContentApp;
function isPixelLensElement(el) {
  let node = el;
  while (node) {
    if (node.id === "pixellens-host") return true;
    node = node.parentNode;
  }
  return false;
}
export function mountContentApp(container) {
  const root = createRoot(container);
  root.render(/* @__PURE__ */ jsxDEV(ContentApp, {}, void 0, false, {
    fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx",
    lineNumber: 140,
    columnNumber: 15
  }, this));
}
var _c;
$RefreshReg$(_c, "ContentApp");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/adam/Documents/Projets/PixelLens/src/content/ui/ContentApp.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
