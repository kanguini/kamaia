// pdf-parse não publica @types — declaramos a superfície que usamos.
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
