import { onMessage } from "/src/lib/messaging.ts.js";
import { MessageType } from "/src/types/messages.ts.js";
import { ElementHighlighter } from "/src/content/inspector/ElementHighlighter.ts.js";
import { ElementSelector } from "/src/content/inspector/ElementSelector.ts.js";
import { DistanceMeasurer } from "/src/content/inspector/DistanceMeasurer.ts.js";
import { GridOverlay } from "/src/content/inspector/GridOverlay.ts.js";
import { PageScanner } from "/src/content/scanner/PageScanner.ts.js";
import { sendMessage } from "/src/lib/messaging.ts.js";
let currentMode = "off";
let highlighter = null;
let selector = null;
let measurer = null;
let gridOverlay = null;
let scanner = null;
let shadowHost = null;
let contentRoot = null;
function ensureShadowDOM() {
  if (contentRoot) return contentRoot;
  shadowHost = document.createElement("div");
  shadowHost.id = "pixellens-host";
  shadowHost.style.cssText = "all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0; pointer-events: none;";
  document.documentElement.appendChild(shadowHost);
  contentRoot = shadowHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = getContentStyles();
  contentRoot.appendChild(style);
  return contentRoot;
}
function setMode(mode) {
  if (currentMode === "inspect") {
    highlighter?.destroy();
    selector?.destroy();
    highlighter = null;
    selector = null;
  } else if (currentMode === "measure") {
    measurer?.destroy();
    measurer = null;
  }
  currentMode = mode;
  if (mode === "inspect") {
    highlighter = new ElementHighlighter(ensureShadowDOM());
    selector = new ElementSelector(ensureShadowDOM());
    highlighter.enable();
    selector.enable();
  } else if (mode === "measure") {
    measurer = new DistanceMeasurer(ensureShadowDOM());
    measurer.enable();
  }
  updateToolbarMode(mode);
}
function updateToolbarMode(_mode) {
  document.dispatchEvent(new CustomEvent("pixellens:mode-change", { detail: { mode: _mode } }));
}
onMessage(MessageType.TOGGLE_INSPECT, (payload) => {
  if (payload.active) {
    setMode("inspect");
  } else {
    setMode("off");
  }
});
onMessage(MessageType.TOGGLE_MEASURE, (payload) => {
  if (payload.active) {
    setMode("measure");
  } else {
    setMode("off");
  }
});
onMessage(MessageType.TOGGLE_GRID, (payload) => {
  if (!gridOverlay) {
    gridOverlay = new GridOverlay(ensureShadowDOM());
  }
  if (payload.visible) {
    gridOverlay.show(payload.size);
  } else {
    gridOverlay.hide();
  }
});
onMessage(MessageType.SCAN_PAGE, (_payload, _sender, sendResponse) => {
  if (!scanner) {
    scanner = new PageScanner();
  }
  scanner.scan((progress, phase) => {
    sendMessage(MessageType.SCAN_PROGRESS, { progress, phase });
  }).then((designSystem) => {
    sendMessage(MessageType.SCAN_COMPLETE, { designSystem });
  });
  return true;
});
function mountUI() {
  const root = ensureShadowDOM();
  const toolbarContainer = document.createElement("div");
  toolbarContainer.id = "pixellens-toolbar-root";
  toolbarContainer.style.cssText = "position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: auto;";
  root.appendChild(toolbarContainer);
  import("/src/content/ui/ContentApp.tsx.js").then(({ mountContentApp }) => {
    mountContentApp(toolbarContainer);
  });
}
function getContentStyles() {
  return `
    .pixellens-overlay-content {
      position: absolute;
      background: rgba(59, 130, 246, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483645;
    }
    .pixellens-overlay-padding {
      position: absolute;
      background: rgba(34, 197, 94, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483644;
    }
    .pixellens-overlay-margin {
      position: absolute;
      background: rgba(249, 115, 22, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483643;
    }
    .pixellens-badge {
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 2147483646;
    }
    .pixellens-pulse-ring {
      position: absolute;
      border: 2px solid #6366F1;
      border-radius: 4px;
      pointer-events: none;
      animation: pixellens-pulse 0.6s ease-out forwards;
      z-index: 2147483646;
    }
    @keyframes pixellens-pulse {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.08); }
    }
    .pixellens-measure-line {
      position: absolute;
      pointer-events: none;
      z-index: 2147483646;
    }
    .pixellens-measure-label {
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 2147483647;
    }
    .pixellens-measure-outline {
      position: absolute;
      border: 1px dashed #6366F1;
      border-radius: 2px;
      pointer-events: none;
      z-index: 2147483644;
    }
    .pixellens-grid-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483640;
    }
    .pixellens-tooltip {
      position: fixed;
      background: rgba(12, 12, 14, 0.95);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 100ms ease-out;
    }
    .pixellens-tooltip.visible {
      opacity: 1;
    }
  `;
}
mountUI();
