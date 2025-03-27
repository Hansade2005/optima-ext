import { CacheOptions } from "../core/prompts/tools/types"
import { promises as fs } from "fs"
import { join } from "path"
import { platform } from "os"

interface CacheEntry<T> {
    value: T
    timestamp: number
    ttl: number
}

class Cache {
    private memoryCache: Map<string, CacheEntry<any>>
    private cacheDir: string
    private maxSize: number
    private strategy: "memory" | "disk" | "distributed"

    constructor(options: CacheOptions = {}) {
        this.memoryCache = new Map()
        this.cacheDir = join(platform() === "win32" ? process.env.TEMP || "C:\\temp" : "/tmp", "roo-cache")
        this.maxSize = options.maxSize || 1000
        this.strategy = options.strategy || "memory"
        this.initialize()
    }

    private async initialize(): Promise<void> {
        if (this.strategy === "disk" || this.strategy === "distributed") {
            try {
                await fs.mkdir(this.cacheDir, { recursive: true })
            } catch (error) {
                console.error("Failed to create cache directory:", error)
            }
        }
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            // Check memory cache first
            const memoryEntry = this.memoryCache.get(key)
            if (memoryEntry && !this.isExpired(memoryEntry)) {
                return memoryEntry.value
            }

            // Check disk cache if enabled
            if (this.strategy === "disk" || this.strategy === "distributed") {
                const diskEntry = await this.getFromDisk(key)
                if (diskEntry && !this.isExpired(diskEntry)) {
                    // Update memory cache if using distributed strategy
                    if (this.strategy === "distributed") {
                        this.memoryCache.set(key, diskEntry)
                    }
                    return diskEntry.value
                }
            }

            return null
        } catch (error) {
            console.error("Cache get error:", error)
            return null
        }
    }

    async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
        try {
            const entry: CacheEntry<T> = {
                value,
                timestamp: Date.now(),
                ttl
            }

            // Update memory cache
            if (this.strategy === "memory" || this.strategy === "distributed") {
                this.memoryCache.set(key, entry)
                this.cleanupMemoryCache()
            }

            // Update disk cache
            if (this.strategy === "disk" || this.strategy === "distributed") {
                await this.setToDisk(key, entry)
            }
        } catch (error) {
            console.error("Cache set error:", error)
        }
    }

    async delete(key: string): Promise<void> {
        try {
            // Delete from memory cache
            if (this.strategy === "memory" || this.strategy === "distributed") {
                this.memoryCache.delete(key)
            }

            // Delete from disk cache
            if (this.strategy === "disk" || this.strategy === "distributed") {
                await this.deleteFromDisk(key)
            }
        } catch (error) {
            console.error("Cache delete error:", error)
        }
    }

    async clear(): Promise<void> {
        try {
            // Clear memory cache
            if (this.strategy === "memory" || this.strategy === "distributed") {
                this.memoryCache.clear()
            }

            // Clear disk cache
            if (this.strategy === "disk" || this.strategy === "distributed") {
                await this.clearDiskCache()
            }
        } catch (error) {
            console.error("Cache clear error:", error)
        }
    }

    private isExpired(entry: CacheEntry<any>): boolean {
        return Date.now() - entry.timestamp > entry.ttl * 1000
    }

    private cleanupMemoryCache(): void {
        if (this.memoryCache.size > this.maxSize) {
            const entries = Array.from(this.memoryCache.entries())
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
            const entriesToRemove = entries.slice(0, entries.length - this.maxSize)
            entriesToRemove.forEach(([key]) => this.memoryCache.delete(key))
        }
    }

    private async getFromDisk<T>(key: string): Promise<CacheEntry<T> | null> {
        try {
            const filePath = join(this.cacheDir, `${key}.json`)
            const data = await fs.readFile(filePath, "utf-8")
            return JSON.parse(data)
        } catch (error) {
            return null
        }
    }

    private async setToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
        try {
            const filePath = join(this.cacheDir, `${key}.json`)
            await fs.writeFile(filePath, JSON.stringify(entry), "utf-8")
        } catch (error) {
            console.error("Failed to write to disk cache:", error)
        }
    }

    private async deleteFromDisk(key: string): Promise<void> {
        try {
            const filePath = join(this.cacheDir, `${key}.json`)
            await fs.unlink(filePath)
        } catch (error) {
            console.error("Failed to delete from disk cache:", error)
        }
    }

    private async clearDiskCache(): Promise<void> {
        try {
            const files = await fs.readdir(this.cacheDir)
            await Promise.all(
                files.map(file => fs.unlink(join(this.cacheDir, file)))
            )
        } catch (error) {
            console.error("Failed to clear disk cache:", error)
        }
    }
}

export const cache = new Cache() 