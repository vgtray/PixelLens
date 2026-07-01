// PixelLens — Type shim pour @joplin/turndown-plugin-gfm
// Le fork Joplin (1.0.67) ne ship pas de définitions de types ; déclaration ambiante minimale.

declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown'
  type GfmPlugin = (service: TurndownService) => void
  export const gfm: GfmPlugin
  export const tables: GfmPlugin
  export const strikethrough: GfmPlugin
  export const taskListItems: GfmPlugin
  export const highlightedCodeBlock: GfmPlugin
}
