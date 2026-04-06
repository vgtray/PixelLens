import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/src/content/ui/FloatingToolbar.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--10e64c58.js"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--10e64c58.js"; const useRef = __vite__cjsImport3_react["useRef"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useState = __vite__cjsImport3_react["useState"]; const useCallback = __vite__cjsImport3_react["useCallback"];
import {
  MagnifyingGlass,
  Ruler,
  GridFour,
  Eyedropper,
  Scan
} from "/vendor/.vite-deps-@phosphor-icons_react.js__v--10e64c58.js";
import gsap from "/vendor/.vite-deps-gsap.js__v--10e64c58.js";
const STORAGE_KEY = "pixellens_toolbar_pos";
export function FloatingToolbar({
  mode,
  gridVisible,
  onModeChange,
  onGridToggle,
  onScan
}) {
  _s();
  const toolbarRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPosition(JSON.parse(saved));
    } catch {
    }
    const el = toolbarRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease: "power3.out",
        delay: 0.05
      }
    );
  }, []);
  useEffect(() => {
    if (position) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      } catch {
      }
    }
  }, [position]);
  const onMouseDown = useCallback((e) => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);
  const style = position ? { left: position.x, top: position.y, transform: "none" } : {};
  const buttons = [
    {
      icon: /* @__PURE__ */ jsxDEV(MagnifyingGlass, { size: 18, weight: mode === "inspect" ? "fill" : "regular" }, void 0, false, {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
        lineNumber: 128,
        columnNumber: 11
      }, this),
      label: "Inspect",
      active: mode === "inspect",
      onClick: () => onModeChange("inspect")
    },
    {
      icon: /* @__PURE__ */ jsxDEV(Ruler, { size: 18, weight: mode === "measure" ? "fill" : "regular" }, void 0, false, {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
        lineNumber: 134,
        columnNumber: 11
      }, this),
      label: "Measure",
      active: mode === "measure",
      onClick: () => onModeChange("measure")
    },
    {
      icon: /* @__PURE__ */ jsxDEV(GridFour, { size: 18, weight: gridVisible ? "fill" : "regular" }, void 0, false, {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
        lineNumber: 140,
        columnNumber: 11
      }, this),
      label: "Grid",
      active: gridVisible,
      onClick: onGridToggle
    },
    {
      icon: /* @__PURE__ */ jsxDEV(Eyedropper, { size: 18, weight: "regular" }, void 0, false, {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
        lineNumber: 146,
        columnNumber: 11
      }, this),
      label: "Picker",
      active: false,
      onClick: () => {
      }
    },
    {
      icon: /* @__PURE__ */ jsxDEV(Scan, { size: 18, weight: "regular" }, void 0, false, {
        fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
        lineNumber: 152,
        columnNumber: 11
      }, this),
      label: "Scan",
      active: false,
      onClick: onScan
    }
  ];
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      ref: toolbarRef,
      onMouseDown,
      style: {
        position: "fixed",
        bottom: position ? "auto" : "24px",
        left: position ? "auto" : "50%",
        transform: position ? "none" : "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "6px 8px",
        background: "rgba(12, 12, 14, 0.90)",
        backdropFilter: "blur(12px)",
        border: "1px solid #222225",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        pointerEvents: "auto",
        opacity: 0,
        willChange: "transform, opacity",
        ...style
      },
      children: buttons.map(
        (btn) => /* @__PURE__ */ jsxDEV(
          "button",
          {
            title: btn.label,
            onClick: (e) => {
              e.stopPropagation();
              btn.onClick();
            },
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              background: btn.active ? "#6366F1" : "transparent",
              color: btn.active ? "#fff" : "#7E7E85",
              transition: "background 150ms ease, color 150ms ease"
            },
            onMouseEnter: (e) => {
              if (!btn.active) {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#EDEDEF";
              }
            },
            onMouseLeave: (e) => {
              if (!btn.active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#7E7E85";
              }
            },
            children: btn.icon
          },
          btn.label,
          false,
          {
            fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
            lineNumber: 186,
            columnNumber: 7
          },
          this
        )
      )
    },
    void 0,
    false,
    {
      fileName: "/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx",
      lineNumber: 160,
      columnNumber: 5
    },
    this
  );
}
_s(FloatingToolbar, "WN+UfcEtU2ylk6MnOf0mbU0QqZI=");
_c = FloatingToolbar;
var _c;
$RefreshReg$(_c, "FloatingToolbar");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/adam/Documents/Projets/PixelLens/src/content/ui/FloatingToolbar.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
