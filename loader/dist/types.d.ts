import { z } from "zod";
export declare const EnvSchema: z.ZodObject<{
    GITHUB_USERNAME: z.ZodString;
    GITHUB_REPO: z.ZodString;
    VRCHAT_PHOTOS_REPO: z.ZodString;
}, "strip", z.ZodTypeAny, {
    GITHUB_USERNAME: string;
    GITHUB_REPO: string;
    VRCHAT_PHOTOS_REPO: string;
}, {
    GITHUB_USERNAME: string;
    GITHUB_REPO: string;
    VRCHAT_PHOTOS_REPO: string;
}>;
export type Env = z.infer<typeof EnvSchema>;
export interface ColumnEntry {
    portrait: string;
    wide: [string, string, string];
}
export interface AtlasEntry {
    url: string;
    columns: [number, number];
}
export interface PhotoManifest {
    pages: Record<string, ColumnEntry[]>;
    atlases: Record<string, AtlasEntry[]>;
    lastUpdated: string;
}
export interface SyncResult {
    page: number;
    columns: ColumnEntry[];
    count: number;
}
export interface AtlasResult {
    page: number;
    atlases: AtlasEntry[];
}
//# sourceMappingURL=types.d.ts.map