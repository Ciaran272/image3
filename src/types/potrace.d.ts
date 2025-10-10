declare module 'potrace' {
  interface PotraceOptions {
    threshold?: number
    [key: string]: any
  }

  interface Potrace {
    trace(
      imageData: ImageData,
      options: PotraceOptions,
      callback: (err: Error | null, svg: string) => void
    ): void
  }

  const potrace: Potrace
  export default potrace
}

