import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/src/content/ui/InspectorTooltip.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--10e64c58.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
export function InspectorTooltip({ data }) {
  const label = data.className ? `${data.tagName}.${data.className.split(/\s+/)[0]}` : data.tagName;
  const truncated = label.length > 35 ? label.slice(0, 35) + "..." : label;
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      style: {
        position: "fixed",
        left: data.x + 12,
        top: data.y + 12,
        background: "rgba(12, 12, 14, 0.95)",
        color: "#EDEDEF",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11px",
        lineHeight: "16px",
        padding: "4px 8px",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        pointerEvents: "none",
        zIndex: 2147483647,
        whiteSpace: "nowrap",
        opacity: 1,
        transition: "opacity 100ms ease-out"
      },
      children: [
        /* @__PURE__ */ jsxDEV("span", { style: { color: "#818CF8" }, children: truncated }, void 0, false, {
          fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx",
          lineNumber: 65,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { color: "#7E7E85", marginLeft: "8px" }, children: [
          data.width,
          " x ",
          data.height
        ] }, void 0, true, {
          fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx",
          lineNumber: 66,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx",
      lineNumber: 45,
      columnNumber: 5
    },
    this
  );
}
_c = InspectorTooltip;
var _c;
$RefreshReg$(_c, "InspectorTooltip");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/adam/Documents/Projets/PixelLens/src/content/ui/InspectorTooltip.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
