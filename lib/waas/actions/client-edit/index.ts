// lib/waas/actions/client-edit/index.ts
// Barrel re-export — consumers continue to import from
//   '@/lib/waas/actions/client-edit'  (resolves to this index)

export type { ActionResult, EditType } from './_shared'
export * from './content-edit'
export * from './ai-rewrite'
export * from './approval'
export * from './history'
export * from './portal'
export * from './domains'
export * from './audit'
export * from './section-regen'
