import { z } from "zod";
export const checkoutDiffPayloadSchema = z.object({
    ts: z.number(),
    commitHash: z.string(),
    mode: z.enum(["full", "checkpoint"]),
});
export const checkoutRestorePayloadSchema = z.object({
    ts: z.number(),
    commitHash: z.string(),
    mode: z.enum(["preview", "restore"]),
});
//# sourceMappingURL=WebviewMessage.js.map