// PixelLens — Chrome Runtime Message Types

import type { InspectedElement } from './inspection'
import type { DesignSystem } from './design-system'
import type { MarkdownResult } from './markdown'
import type { CrawlOptions, CrawlProgress, CrawlResult, SkipReason } from './crawl'

export enum MessageType {
  TOGGLE_INSPECT = 'TOGGLE_INSPECT',
  ELEMENT_SELECTED = 'ELEMENT_SELECTED',
  SCAN_PAGE = 'SCAN_PAGE',
  SCAN_PROGRESS = 'SCAN_PROGRESS',
  SCAN_COMPLETE = 'SCAN_COMPLETE',
  SCAN_ERROR = 'SCAN_ERROR',
  EXTRACT_MARKDOWN = 'EXTRACT_MARKDOWN',
  CRAWL_SITE = 'CRAWL_SITE',
  CRAWL_PROGRESS = 'CRAWL_PROGRESS',
  CRAWL_COMPLETE = 'CRAWL_COMPLETE',
  STOP_CRAWL = 'STOP_CRAWL',
  RENDER_PAGE = 'RENDER_PAGE',
  TOGGLE_GRID = 'TOGGLE_GRID',
  TOGGLE_MEASURE = 'TOGGLE_MEASURE',
  PING = 'PING',
}

export interface MessagePayloadMap {
  [MessageType.TOGGLE_INSPECT]: { active: boolean }
  [MessageType.ELEMENT_SELECTED]: { element: InspectedElement }
  [MessageType.SCAN_PAGE]: undefined
  [MessageType.SCAN_PROGRESS]: { progress: number; phase: string }
  [MessageType.SCAN_COMPLETE]: { designSystem: DesignSystem }
  [MessageType.SCAN_ERROR]: undefined
  [MessageType.EXTRACT_MARKDOWN]: undefined
  [MessageType.CRAWL_SITE]: CrawlOptions
  [MessageType.CRAWL_PROGRESS]: CrawlProgress
  [MessageType.CRAWL_COMPLETE]: { result: CrawlResult }
  [MessageType.STOP_CRAWL]: undefined
  [MessageType.RENDER_PAGE]: { url: string }
  [MessageType.TOGGLE_GRID]: { visible: boolean; size?: number }
  [MessageType.TOGGLE_MEASURE]: { active: boolean }
  [MessageType.PING]: undefined
}

export interface Message<T extends MessageType = MessageType> {
  type: T
  payload: MessagePayloadMap[T]
}

export interface Preferences {
  colorFormat: 'hex' | 'rgb' | 'hsl'
  gridSize: number
  theme: 'dark'
}

/**
 * Réponse à RENDER_PAGE (background → content) : le rendu réel d'UNE page dans un onglet
 * arrière-plan. Discriminé — succès = MarkdownResult du DOM RENDU + liens absolus du DOM
 * (pour le BFS Full sans sitemap) ; échec = raison explicite (timeout, network, empty…).
 */
export type RenderPageResponse =
  | { ok: true; markdown: MarkdownResult; links: string[] }
  | { ok: false; reason: SkipReason }

export type MessageResponse<T extends MessageType = MessageType> =
  T extends MessageType.ELEMENT_SELECTED ? { received: boolean } :
  T extends MessageType.SCAN_COMPLETE ? { received: boolean } :
  T extends MessageType.EXTRACT_MARKDOWN ? MarkdownResult :
  T extends MessageType.RENDER_PAGE ? RenderPageResponse :
  T extends MessageType.PING ? { alive: boolean } :
  { success: boolean }
