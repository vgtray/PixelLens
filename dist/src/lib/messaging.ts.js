export function sendMessage(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}
export function onMessage(type, handler) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === type) {
      return handler(message.payload, sender, sendResponse);
    }
  });
}
export function sendToContent(tabId, type, payload) {
  return chrome.tabs.sendMessage(tabId, { type, payload });
}
export function sendToPanel(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}
