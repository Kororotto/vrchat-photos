import { z } from "zod";

export const EnvSchema = z.object({
  GITHUB_USERNAME: z.string().min(1),
  GITHUB_REPO: z.string().min(1),
  VRCHAT_PHOTOS_REPO: z.string().min(1),
});

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
