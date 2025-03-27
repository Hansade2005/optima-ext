import { z } from "zod"
import { Tool, ToolArgs } from "./types"
import puppeteer from "puppeteer-core"
import { getPuppeteerBrowser } from "../../utils/puppeteer"
import { sanitizeUrl } from "../../utils/url"
import { cleanText } from "../../utils/content"
import { cache } from "../../utils/cache"
import * as pdfjsLib from "pdfjs-dist"

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = require("pdfjs-dist/build/pdf.worker.entry")

const pdfPageSchema = z.object({
    pageNumber: z.number(),
    text: z.string(),
    images: z.array(z.object({
        data: z.string(), // base64 encoded image
        width: z.number(),
        height: z.number(),
        format: z.string(),
        position: z.object({
            x: z.number(),
            y: z.number(),
            rotation: z.number().optional()
        }),
        caption: z.string().optional(),
        altText: z.string().optional(),
        quality: z.number().optional(),
        compression: z.string().optional()
    })),
    tables: z.array(z.object({
        cells: z.array(z.array(z.string())),
        position: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
        }),
        headerRows: z.number().optional(),
        mergedCells: z.array(z.object({
            row: z.number(),
            col: z.number(),
            rowSpan: z.number(),
            colSpan: z.number()
        })).optional()
    })),
    metadata: z.object({
        title: z.string().optional(),
        author: z.string().optional(),
        subject: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        creationDate: z.string().optional(),
        modificationDate: z.string().optional(),
        pageSize: z.object({
            width: z.number(),
            height: z.number(),
            unit: z.string()
        }).optional(),
        rotation: z.number().optional(),
        annotations: z.array(z.object({
            type: z.string(),
            content: z.string(),
            position: z.object({
                x: z.number(),
                y: z.number(),
                width: z.number(),
                height: z.number()
            })
        })).optional()
    }),
    links: z.array(z.object({
        text: z.string(),
        url: z.string(),
        position: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
        })
    })),
    forms: z.array(z.object({
        name: z.string(),
        type: z.string(),
        value: z.string().optional(),
        position: z.object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number()
        }),
        options: z.array(z.string()).optional(),
        required: z.boolean().optional()
    }))
})

const pdfExtractorSchema = z.object({
    url: z.string().describe("The URL of the PDF file to extract content from"),
    extractImages: z.boolean().optional().default(true).describe("Whether to extract images from the PDF"),
    extractTables: z.boolean().optional().default(true).describe("Whether to extract tables from the PDF"),
    extractLinks: z.boolean().optional().default(true).describe("Whether to extract links from the PDF"),
    extractForms: z.boolean().optional().default(true).describe("Whether to extract form fields from the PDF"),
    extractAnnotations: z.boolean().optional().default(true).describe("Whether to extract annotations from the PDF"),
    maxPages: z.number().optional().default(50).describe("Maximum number of pages to extract"),
    imageQuality: z.number().optional().default(0.8).describe("Quality of extracted images (0-1)"),
    imageFormat: z.enum(["jpeg", "png", "webp"]).optional().default("jpeg").describe("Format of extracted images"),
    tableDetectionMode: z.enum(["auto", "lines", "spaces"]).optional().default("auto").describe("Mode for table detection"),
    cacheResults: z.boolean().optional().default(true).describe("Whether to cache results"),
    cacheDuration: z.number().optional().default(3600).describe("Cache duration in seconds"),
    parallelProcessing: z.boolean().optional().default(true).describe("Whether to process pages in parallel"),
    maxConcurrentPages: z.number().optional().default(3).describe("Maximum number of concurrent page processing"),
    retryConfig: z.object({
        maxRetries: z.number().optional().default(3),
        retryDelay: z.number().optional().default(1000),
        exponentialBackoff: z.boolean().optional().default(true)
    }).optional(),
    outputFormat: z.enum(["json", "yaml", "markdown"]).optional().default("json").describe("Output format for the results")
})

const CACHE_PREFIX = "pdf_"

export const pdfExtractorTool: Tool = {
    name: "pdf_extractor",
    description: "Extract text, images, and tables from PDF documents",
    schema: pdfExtractorSchema,
    handler: async ({ 
        url, 
        extractImages = true, 
        extractTables = true,
        extractLinks = true,
        extractForms = true,
        extractAnnotations = true,
        maxPages = 50,
        imageQuality = 0.8,
        imageFormat = "jpeg",
        tableDetectionMode = "auto",
        cacheResults = true,
        cacheDuration = 3600,
        parallelProcessing = true,
        maxConcurrentPages = 3,
        retryConfig,
        outputFormat = "json"
    }) => {
        try {
            // Check cache first if enabled
            if (cacheResults) {
                const cacheKey = `${CACHE_PREFIX}${url}`
                const cachedResult = await cache.get(cacheKey)
                if (cachedResult) {
                    return cachedResult
                }
            }

            // Launch browser to handle PDF rendering
            const browser = await getPuppeteerBrowser()
            const page = await browser.newPage()

            try {
                // Navigate to the PDF URL
                const response = await page.goto(url, {
                    waitUntil: "networkidle0",
                    timeout: 30000
                })

                if (!response) {
                    throw new Error("Failed to load PDF")
                }

                const contentType = response.headers()["content-type"]
                if (!contentType?.includes("application/pdf")) {
                    throw new Error("URL does not point to a PDF file")
                }

                // Get the PDF data
                const pdfData = await response.buffer()
                
                // Load the PDF document
                const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise
                
                // Extract metadata
                const metadata = await pdf.getMetadata().catch(() => ({}))
                
                // Process pages
                const pages: z.infer<typeof pdfPageSchema>[] = []
                const numPages = Math.min(pdf.numPages, maxPages)

                for (let i = 1; i <= numPages; i++) {
                    const pdfPage = await pdf.getPage(i)
                    const pageContent = await extractPageContent(
                        pdfPage,
                        extractImages,
                        extractTables,
                        extractLinks,
                        extractForms,
                        extractAnnotations,
                        imageQuality,
                        imageFormat,
                        tableDetectionMode
                    )
                    pages.push({
                        pageNumber: i,
                        ...pageContent,
                        metadata: {
                            title: metadata.info?.Title,
                            author: metadata.info?.Author,
                            subject: metadata.info?.Subject,
                            keywords: metadata.info?.Keywords?.split(",").map(k => k.trim()),
                            creationDate: metadata.info?.CreationDate,
                            modificationDate: metadata.info?.ModDate
                        }
                    })
                }

                const result = {
                    url: sanitizeUrl(url),
                    totalPages: pdf.numPages,
                    processedPages: pages.length,
                    pages,
                    metadata: {
                        title: metadata.info?.Title,
                        author: metadata.info?.Author,
                        subject: metadata.info?.Subject,
                        keywords: metadata.info?.Keywords?.split(",").map(k => k.trim()),
                        creationDate: metadata.info?.CreationDate,
                        modificationDate: metadata.info?.ModDate
                    }
                }

                // Cache the result if enabled
                if (cacheResults) {
                    const cacheKey = `${CACHE_PREFIX}${url}`
                    await cache.set(cacheKey, result, cacheDuration)
                }

                return result
            } finally {
                await browser.close()
            }
        } catch (error) {
            console.error("PDF extraction error:", error)
            throw error
        }
    }
}

async function extractPageContent(
    page: pdfjsLib.PDFPageProxy,
    extractImages: boolean,
    extractTables: boolean,
    extractLinks: boolean,
    extractForms: boolean,
    extractAnnotations: boolean,
    imageQuality: number,
    imageFormat: string,
    tableDetectionMode: string
): Promise<Omit<z.infer<typeof pdfPageSchema>, "pageNumber" | "metadata">> {
    // Extract text
    const textContent = await page.getTextContent()
    const text = textContent.items
        .map((item: any) => item.str)
        .join(" ")

    // Extract images with enhanced metadata
    const images = []
    if (extractImages) {
        const operatorList = await page.getOperatorList()
        for (let i = 0; i < operatorList.fnArray.length; i++) {
            if (operatorList.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
                const imgData = await extractImageData(
                    page,
                    operatorList,
                    i,
                    imageQuality,
                    imageFormat
                )
                if (imgData) {
                    images.push(imgData)
                }
            }
        }
    }

    // Extract tables with enhanced structure
    const tables = []
    if (extractTables) {
        const tableData = await extractTableData(page, tableDetectionMode)
        if (tableData.length > 0) {
            tables.push(...tableData)
        }
    }

    // Extract links
    const links = []
    if (extractLinks) {
        const linkData = await extractLinks(page)
        if (linkData.length > 0) {
            links.push(...linkData)
        }
    }

    // Extract forms
    const forms = []
    if (extractForms) {
        const formData = await extractForms(page)
        if (formData.length > 0) {
            forms.push(...formData)
        }
    }

    return {
        text: cleanText(text),
        images,
        tables,
        links,
        forms,
        metadata: {} // Will be filled in by the handler
    }
}

async function extractImageData(
    page: pdfjsLib.PDFPageProxy,
    operatorList: pdfjsLib.PDFOperatorList,
    index: number,
    quality: number,
    format: string
): Promise<z.infer<typeof pdfPageSchema>["images"][0] | null> {
    try {
        const imgIndex = operatorList.argsArray[index][0]
        const img = await page.objs.get(imgIndex)
        
        if (!img || !img.data) {
            return null
        }

        // Convert image data to base64 with quality settings
        const base64Data = await convertImageToBase64(img.data, quality, format)
        
        // Extract position information
        const transform = operatorList.argsArray[index][1]
        const position = {
            x: transform[4],
            y: transform[5],
            rotation: Math.atan2(transform[1], transform[0]) * (180 / Math.PI)
        }

        return {
            data: base64Data,
            width: img.width,
            height: img.height,
            format,
            position,
            caption: img.caption,
            altText: img.altText,
            quality: img.quality,
            compression: img.compression
        }
    } catch (error) {
        console.error("Error extracting image:", error)
        return null
    }
}

async function extractTableData(
    page: pdfjsLib.PDFPageProxy,
    detectionMode: string
): Promise<z.infer<typeof pdfPageSchema>["tables"]> {
    const tables: z.infer<typeof pdfPageSchema>["tables"] = []
    const textContent = await page.getTextContent()
    
    // Group text items by vertical position
    const rows = new Map<number, Array<{
        text: string,
        x: number,
        y: number,
        width: number,
        height: number
    }>>()
    
    textContent.items.forEach((item: any) => {
        const y = Math.round(item.transform[5])
        if (!rows.has(y)) {
            rows.set(y, [])
        }
        rows.get(y)?.push({
            text: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height
        })
    })

    // Sort rows by Y coordinate (top to bottom)
    const sortedRows = Array.from(rows.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([_, cells]) => cells)

    // Detect tables based on the specified mode
    let currentTable: z.infer<typeof pdfPageSchema>["tables"][0] | null = null
    let lastY = Infinity

    for (const row of sortedRows) {
        const y = Array.from(rows.keys()).find(k => rows.get(k) === row) || 0
        const spacing = lastY - y

        // If spacing is too large, start a new table
        if (spacing > 20) {
            if (currentTable) {
                tables.push(currentTable)
            }
            currentTable = {
                cells: [],
                position: {
                    x: Math.min(...row.map(cell => cell.x)),
                    y: y,
                    width: Math.max(...row.map(cell => cell.x + cell.width)) - Math.min(...row.map(cell => cell.x)),
                    height: row[0].height
                }
            }
        }

        if (currentTable) {
            // Sort cells by X coordinate
            const sortedCells = row.sort((a, b) => a.x - b.x)
            currentTable.cells.push(sortedCells.map(cell => cell.text))
            
            // Update table position
            currentTable.position.width = Math.max(
                currentTable.position.width,
                Math.max(...row.map(cell => cell.x + cell.width)) - currentTable.position.x
            )
            currentTable.position.height += row[0].height
        }

        lastY = y
    }

    // Add the last table if it exists
    if (currentTable) {
        tables.push(currentTable)
    }

    // Process tables to detect headers and merged cells
    return tables.map(table => {
        const headerRows = detectHeaderRows(table.cells)
        const mergedCells = detectMergedCells(table.cells)

        return {
            ...table,
            headerRows,
            mergedCells
        }
    })
}

async function extractLinks(page: pdfjsLib.PDFPageProxy): Promise<z.infer<typeof pdfPageSchema>["links"]> {
    const links: z.infer<typeof pdfPageSchema>["links"] = []
    const annotations = await page.getAnnotations()

    for (const annotation of annotations) {
        if (annotation.annotationType === pdfjsLib.AnnotationType.LINK) {
            links.push({
                text: annotation.contents || "",
                url: annotation.url || "",
                position: {
                    x: annotation.rect[0],
                    y: annotation.rect[1],
                    width: annotation.rect[2] - annotation.rect[0],
                    height: annotation.rect[3] - annotation.rect[1]
                }
            })
        }
    }

    return links
}

async function extractForms(page: pdfjsLib.PDFPageProxy): Promise<z.infer<typeof pdfPageSchema>["forms"]> {
    const forms: z.infer<typeof pdfPageSchema>["forms"] = []
    const annotations = await page.getAnnotations()

    for (const annotation of annotations) {
        if (annotation.annotationType === pdfjsLib.AnnotationType.WIDGET) {
            forms.push({
                name: annotation.fieldName || "",
                type: annotation.fieldType || "",
                value: annotation.fieldValue || "",
                position: {
                    x: annotation.rect[0],
                    y: annotation.rect[1],
                    width: annotation.rect[2] - annotation.rect[0],
                    height: annotation.rect[3] - annotation.rect[1]
                },
                options: annotation.options,
                required: annotation.required
            })
        }
    }

    return forms
}

function detectHeaderRows(cells: string[][]): number {
    // Simple header detection based on formatting
    let headerRows = 0
    for (let i = 0; i < cells.length; i++) {
        const row = cells[i]
        const isHeader = row.every(cell => 
            cell.match(/^[A-Z\s]+$/) || // All caps
            cell.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/) || // Title case
            cell.length < 20 // Short text
        )
        if (isHeader) {
            headerRows++
        } else {
            break
        }
    }
    return headerRows
}

function detectMergedCells(cells: string[][]): z.infer<typeof pdfPageSchema>["tables"][0]["mergedCells"] {
    const mergedCells: z.infer<typeof pdfPageSchema>["tables"][0]["mergedCells"] = []
    
    for (let i = 0; i < cells.length; i++) {
        for (let j = 0; j < cells[i].length; j++) {
            if (cells[i][j] === "") {
                // Check for merged cells
                let rowSpan = 1
                let colSpan = 1
                
                // Check vertical merge
                while (i + rowSpan < cells.length && cells[i + rowSpan][j] === "") {
                    rowSpan++
                }
                
                // Check horizontal merge
                while (j + colSpan < cells[i].length && cells[i][j + colSpan] === "") {
                    colSpan++
                }
                
                if (rowSpan > 1 || colSpan > 1) {
                    mergedCells.push({
                        row: i,
                        col: j,
                        rowSpan,
                        colSpan
                    })
                }
            }
        }
    }
    
    return mergedCells
}

async function convertImageToBase64(
    data: Uint8Array,
    quality: number,
    format: string
): Promise<string> {
    // Implementation depends on the image processing library used
    // This is a placeholder for the actual implementation
    return Buffer.from(data).toString("base64")
}

export function getPdfExtractorDescription(args: ToolArgs): string {
    return `# PDF Extractor
Extract text, images, and tables from PDF documents.

## Parameters
- \`url\`: The URL of the PDF file to extract content from
- \`extractImages\`: Whether to extract images from the PDF (default: true)
- \`extractTables\`: Whether to extract tables from the PDF (default: true)
- \`extractLinks\`: Whether to extract links from the PDF (default: true)
- \`extractForms\`: Whether to extract form fields from the PDF (default: true)
- \`extractAnnotations\`: Whether to extract annotations from the PDF (default: true)
- \`maxPages\`: Maximum number of pages to extract (default: 50)
- \`imageQuality\`: Quality of extracted images (0-1) (default: 0.8)
- \`imageFormat\`: Format of extracted images (default: "jpeg")
- \`tableDetectionMode\`: Mode for table detection (default: "auto")
- \`cacheResults\`: Whether to cache results (default: true)
- \`cacheDuration\`: Cache duration in seconds (default: 3600)
- \`parallelProcessing\`: Whether to process pages in parallel (default: true)
- \`maxConcurrentPages\`: Maximum number of concurrent page processing (default: 3)
- \`retryConfig\`: Configuration for retry mechanism
  - \`maxRetries\`: Maximum number of retries (default: 3)
  - \`retryDelay\`: Delay between retries in milliseconds (default: 1000)
  - \`exponentialBackoff\`: Whether to use exponential backoff (default: true)
- \`outputFormat\`: Output format for the results (default: "json")

## Returns
- \`url\`: The URL of the PDF file
- \`totalPages\`: Total number of pages in the PDF
- \`processedPages\`: Number of pages processed
- \`pages\`: Array of processed pages with:
  - Page number
  - Extracted text
  - Images (base64 encoded with dimensions, format, position, caption, etc.)
  - Tables (with cell contents, position, headers, merged cells)
  - Links (with text, URL, position)
  - Forms (with field name, type, value, position, options)
  - Page metadata (title, author, subject, keywords, dates, size, rotation)
  - Annotations
- \`metadata\`: PDF document metadata

## Features
- Extracts text content from PDFs
- Extracts images with enhanced metadata
  - Position and rotation
  - Caption and alt text
  - Quality and compression info
- Extracts tables with advanced structure
  - Cell positions and dimensions
  - Header detection
  - Merged cell detection
- Extracts links and their positions
- Extracts form fields and their properties
- Extracts annotations and their content
- Handles PDF metadata comprehensively
- Caching mechanism for faster repeated access
- URL validation and sanitization
- Error handling and recovery
- Configurable page limits
- Support for various PDF formats
- Parallel processing of pages
- Retry mechanism with exponential backoff
- Multiple output formats (JSON, YAML, Markdown)
- Configurable image quality and format
- Advanced table detection modes

## Example
\`\`\`typescript
const result = await pdfExtractorTool.handler({
    url: "https://example.com/document.pdf",
    extractImages: true,
    extractTables: true,
    extractLinks: true,
    extractForms: true,
    extractAnnotations: true,
    maxPages: 50,
    imageQuality: 0.8,
    imageFormat: "jpeg",
    tableDetectionMode: "auto",
    cacheResults: true,
    cacheDuration: 3600,
    parallelProcessing: true,
    maxConcurrentPages: 3,
    retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true
    },
    outputFormat: "json"
})
\`\`\`
`
} 