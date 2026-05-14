// Type declarations for pdfkit
// This file provides type information for the pdfkit module
// when @types/pdfkit is not available or during builds

declare module 'pdfkit' {
  import { Stream } from 'stream'

  class PDFDocument extends Stream {
    constructor(options?: PDFDocumentOptions)
    
    // Core methods
    fontSize(size: number): PDFDocument
    font(name: string): PDFDocument
    
    // text() method overloads
    text(text: string): PDFDocument
    text(text: string, options: TextOptions): PDFDocument
    text(text: string, x: number, y: number): PDFDocument
    text(text: string, x: number, y: number, options: TextOptions): PDFDocument
    text(text: string, x?: number | TextOptions, y?: number, options?: TextOptions): PDFDocument
    
    fillColor(color: string | number): PDFDocument
    moveDown(lines?: number): PDFDocument
    addPage(): PDFDocument
    rect(x: number, y: number, w: number, h: number): PDFDocument
    fill(): PDFDocument
    stroke(): PDFDocument
    image(src: string | Buffer, x?: number, y?: number, options?: ImageOptions): PDFDocument
    
    // Output methods
    pipe(destination: Stream): Stream
    
    // Utilities
    on(event: string, callback: (...args: any[]) => void): void
    end(): void
    
    // Line drawing
    moveTo(x: number, y: number): PDFDocument
    lineTo(x: number, y: number): PDFDocument
  }

  interface PDFDocumentOptions {
    size?: string | [number, number]
    margin?: number | [number, number, number, number]
    layout?: 'portrait' | 'landscape'
    [key: string]: any
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right'
    width?: number
    height?: number
    [key: string]: any
  }

  interface ImageOptions {
    width?: number
    height?: number
    [key: string]: any
  }

  export default PDFDocument
}
