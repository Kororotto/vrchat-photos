import type { AtlasResult, PhotoManifest, SyncResult } from "./types.js";
export declare function syncPage(opts: {
    sourceDir: string;
    page: number;
    repoPath: string;
    githubUsername: string;
    githubRepo: string;
}): Promise<SyncResult>;
export declare function getManifest(repoPath: string): PhotoManifest;
export declare function buildAtlases(opts: {
    page: number;
    repoPath: string;
    githubUsername: string;
    githubRepo: string;
}): Promise<AtlasResult>;
export declare function generateUdonSharpAtlas(manifest: PhotoManifest): string;
export declare function generateUdonSharp(manifest: PhotoManifest): string;
//# sourceMappingURL=uploader.d.ts.map