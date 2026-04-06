// PixelLens — Chrome Messaging Wrapper

import type { MessageType, MessagePayloadMap, MessageResponse } from '@/types/messages'

export function sendMessage<T extends MessageType>(
  type: T,
  payload: MessagePayloadMap[T],
): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage({ type, payload })
}

export function onMessage<T extends MessageType>(
  type: T,
  handler: (
    payload: MessagePayloadMap[T],
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<T>) => void,
  ) => void | boolean,
): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === type) {
      return handler(message.payload, sender, sendResponse)
    }
  })
}

export function sendToContent<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessagePayloadMap[T],
): Promise<MessageResponse<T>> {
  return chrome.tabs.sendMessage(tabId, { type, payload })
}

export function sendToPanel<T extends MessageType>(
  type: T,
  payload: MessagePayloadMap[T],
): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage({ type, payload })
}
