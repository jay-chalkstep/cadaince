import JSZip from "jszip";

interface ContentMetadata {
  extraMetadata: Record<string, unknown>;
  fileType: string;
  fontName: string;
  lastOpenedPage: number;
  lineHeight: number;
  margins: number;
  orientation: string;
  pageCount: number;
  pages: string[];
  textScale: number;
  transform: Record<string, unknown>;
}

interface DocumentMetadata {
  deleted: boolean;
  lastModified: string;
  lastOpened: string;
  lastOpenedPage: number;
  metadatamodified: boolean;
  modified: boolean;
  parent: string;
  pinned: boolean;
  synced: boolean;
  type: string;
  version: number;
  visibleName: string;
}

/**
 * Create a reMarkable-compatible archive from a PDF buffer
 * reMarkable expects a specific zip structure with metadata files
 */
export async function createRemarkableArchive(
  documentId: string,
  pdfBuffer: Buffer
): Promise<Buffer> {
  const zip = new JSZip();

  // Estimate page count (rough estimate based on PDF size)
  // In production, you'd parse the PDF properly
  const estimatedPageCount = Math.max(1, Math.floor(pdfBuffer.length / 50000));
  const pages = Array.from({ length: estimatedPageCount }, (_, i) => crypto.randomUUID());

  // Content metadata (.content file)
  const contentMetadata: ContentMetadata = {
    extraMetadata: {},
    fileType: "pdf",
    fontName: "",
    lastOpenedPage: 0,
    lineHeight: -1,
    margins: 100,
    orientation: "portrait",
    pageCount: estimatedPageCount,
    pages,
    textScale: 1,
    transform: {},
  };

  // Document metadata (.metadata file) - not usually included in upload
  const now = new Date().toISOString();

  // Add the PDF file
  zip.file(`${documentId}.pdf`, pdfBuffer);

  // Add content metadata
  zip.file(`${documentId}.content`, JSON.stringify(contentMetadata));

  // Add page data files (empty for PDF-based documents)
  zip.file(`${documentId}.pagedata`, "");

  // Generate the zip buffer
  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return zipBuffer;
}
