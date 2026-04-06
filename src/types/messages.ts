// PixelLens — Chrome Runtime Message Types

import type { InspectedElement } from './inspection'
import type { DesignSystem } from './design-system'

export enum MessageType {
  TOGGLE_INSPECT = 'TOGGLE_INSPECT',
  ELEMENT_SELECTED = 'ELEMENT_SELECTED',
  SCAN_PAGE = 'SCAN_PAGE',
  SCAN_PROGRESS = 'SCAN_PROGRESS',
  SCAN_COMPLETE = 'SCAN_COMPLETE',
  TOGGLE_GRID = 'TOGGLE_GRID',
  TOGGLE_MEASURE = 'TOGGLE_MEASURE',
  GET_PREFERENCES = 'GET_PREFERENCES',
  SET_PREFERENCES = 'SET_PREFERENCES',
  OPEN_SIDE_PANEL = 'OPEN_SIDE_PANEL',
}

export interface MessagePayloadMap {
  [MessageType.TOGGLE_INSPECT]: { active: boolean }
  [MessageType.ELEMENT_SELECTED]: { element: InspectedElement }
  [MessageType.SCAN_PAGE]: undefined
  [MessageType.SCAN_PROGRESS]: { progress: number; phase: string }
  [MessageType.SCAN_COMPLETE]: { designSystem: DesignSystem }
  [MessageType.TOGGLE_GRID]: { visible: boolean; size?: number }
  [MessageType.TOGGLE_MEASURE]: { active: boolean }
  [MessageType.GET_PREFERENCES]: undefined
  [MessageType.SET_PREFERENCES]: { preferences: Partial<Preferences> }
  [MessageType.OPEN_SIDE_PANEL]: undefined
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

export type MessageResponse<T extends MessageType = MessageType> =
  T extends MessageType.GET_PREFERENCES ? Preferences :
  T extends MessageType.ELEMENT_SELECTED ? { received: boolean } :
  T extends MessageType.SCAN_COMPLETE ? { received: boolean } :
  { success: boolean }
