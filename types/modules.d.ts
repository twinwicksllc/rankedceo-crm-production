// Ambient module declarations for packages that lack type definitions
// in the current moduleResolution: "node" context.

// date-fns v3 uses package exports which moduleResolution: "node" cannot resolve.
// These declarations satisfy the TypeScript type checker while the actual
// runtime resolution is handled by Next.js/webpack.
declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: object): string
  export function formatDistanceToNow(date: Date | number, options?: { addSuffix?: boolean; includeSeconds?: boolean }): string
  export function parseISO(argument: string, options?: object): Date
  export function addDays(date: Date | number, amount: number): Date
  export function startOfDay(date: Date | number): Date
  export function endOfDay(date: Date | number): Date
  export function subDays(date: Date | number, amount: number): Date
  export function startOfMonth(date: Date | number): Date
  export function endOfMonth(date: Date | number): Date
  export function subMonths(date: Date | number, amount: number): Date
  export function isSameDay(dateLeft: Date | number, dateRight: Date | number): boolean
}