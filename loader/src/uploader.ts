import { execSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { extname, join } from "node:path";
import sharp from "sharp";
import type { AtlasEntry, AtlasResult, ColumnEntry, PhotoManifest, SyncResult } from "./types.js";

const RAW_BASE = "https://raw.githubusercontent.com";
const WIDE_RATIO_THRESHOLD = 1.6;
const TARGET_WIDTH = 1920;

// VRCImageDownloader の制約（最大2048x2048px・5秒/枚のダウンロード間隔）に収まる
// 範囲で画質を最大化する組み合わせ: 1アトラス=2列(portrait×2 + wide×6 = 8枚)
const ATLAS_COLUMNS_PER_GROUP = 2;
const ATLAS_CELL_WIDTH = 800;
const ATLAS_PORTRAIT_HEIGHT = Math.round((ATLAS_CELL_WIDTH * 1350) / 1920); // 562
const ATLAS_WIDE_HEIGHT = Math.round((ATLAS_CELL_WIDTH * 1080) / 1920); // 450
const ATLAS_WIDTH = ATLAS_CELL_WIDTH * ATLAS_COLUMNS_PER_GROUP; // 1600
const ATLAS_HEIGHT = ATLAS_PORTRAIT_HEIGHT + ATLAS_WIDE_HEIGHT * 3; // 1912
const ATLAS_JPEG_QUALITY = 85;

function readPngDimensions(filePath: string): { width: number; height: number } {
  const fd = openSync(filePath, "r");
  const buf = Buffer.alloc(24);
  readSync(fd, buf, 0, 24, 0);
  closeSync(fd);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

function isPortrait(filePath: string): boolean {
  const { width, height } = readPngDimensions(filePath);
  return width / height < WIDE_RATIO_THRESHOLD;
}

function getPngFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f: string) => extname(f).toLowerCase() === ".png")
    .sort();
}

// サブフォルダを再帰的に探索し、PNGファイルを含む末端フォルダ（葉）を返す
function findLeafFolders(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const subDirs = entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const pngFiles = entries.filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".png");

  if (subDirs.length === 0 && pngFiles.length > 0) {
    return [dir];
  }
  if (subDirs.length > 0) {
    return subDirs.flatMap((d) => findLeafFolders(join(dir, d.name)));
  }
  return [];
}

async function resizeAndSave(src: string, dest: string): Promise<void> {
  await sharp(src)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .png()
    .toFile(dest);
}

export async function syncPage(opts: {
  sourceDir: string;
  page: number;
  repoPath: string;
  githubUsername: string;
  githubRepo: string;
}): Promise<SyncResult> {
  const { sourceDir, page, repoPath, githubUsername, githubRepo } = opts;

  // order.json があればその順番を優先、なければ自動検出
  const orderFile = join(sourceDir, "order.json");
  const colDirs = existsSync(orderFile)
    ? (JSON.parse(readFileSync(orderFile, "utf8")) as string[]).map((rel) =>
        resolve(sourceDir, rel)
      )
    : findLeafFolders(sourceDir);

  if (colDirs.length === 0) {
    throw new Error(
      `${sourceDir} にPNGファイルを含むフォルダが見つかりません`
    );
  }

  console.log(`  ${colDirs.length}列を検出（フォルダ順）:`);
  colDirs.forEach((d, i) => console.log(`    col${String(i + 1).padStart(2, "0")}: ${d}`));

  const portraitDir = join(repoPath, "photos", `page${page}`, "portrait");
  const wideDir = join(repoPath, "photos", `page${page}`, "wide");
  mkdirSync(portraitDir, { recursive: true });
  mkdirSync(wideDir, { recursive: true });

  const columns: ColumnEntry[] = [];
  let wideIndex = 1;

  for (let colIdx = 0; colIdx < colDirs.length; colIdx++) {
    const colPath = colDirs[colIdx];
    if (!colPath) continue;
    const files = getPngFiles(colPath);

    const portraits = files.filter((f: string) => isPortrait(join(colPath, f)));
    const wides = files.filter((f: string) => !isPortrait(join(colPath, f)));

    if (portraits.length === 0) {
      throw new Error(`${colPath}: portrait(2048x1440)が見つかりません`);
    }
    if (wides.length < 3) {
      throw new Error(`${colPath}: wide(16:9)が${wides.length}枚（最低3枚必要）`);
    }

    if (portraits.length > 1) {
      console.log(`    ⚠️  portrait ${portraits.length}枚→先頭1枚を使用`);
    }
    if (wides.length > 3) {
      console.log(`    ⚠️  wide ${wides.length}枚→先頭3枚を使用`);
    }

    const colNum = String(colIdx + 1).padStart(2, "0");
    const portraitDest = join(portraitDir, `${colNum}.png`);
    await resizeAndSave(join(colPath, portraits[0] as string), portraitDest);

    const portraitUrl = `${RAW_BASE}/${githubUsername}/${githubRepo}/main/photos/page${page}/portrait/${colNum}.png`;
    const wideUrls: string[] = [];

    for (const wideFile of wides.slice(0, 3)) {
      const wideDest = String(wideIndex).padStart(2, "0") + ".png";
      await resizeAndSave(join(colPath, wideFile), join(wideDir, wideDest));
      wideUrls.push(
        `${RAW_BASE}/${githubUsername}/${githubRepo}/main/photos/page${page}/wide/${wideDest}`
      );
      wideIndex++;
    }

    columns.push({
      portrait: portraitUrl,
      wide: wideUrls as [string, string, string],
    });

    console.log(`  ✓ col${colNum} (portrait + wide×3)`);
  }

  const manifest = readManifest(repoPath);
  manifest.pages[`page${page}`] = columns;
  manifest.lastUpdated = new Date().toISOString();
  writeManifest(repoPath, manifest);

  const gitOpts = { cwd: repoPath, stdio: "inherit" as const };
  execSync("git add .", gitOpts);
  execSync(
    `git commit -m "feat: page${page} の写真を追加 (${colDirs.length}列)"`,
    gitOpts
  );
  execSync("git push", gitOpts);

  return { page, columns, count: colDirs.length * 4 };
}

export function getManifest(repoPath: string): PhotoManifest {
  return readManifest(repoPath);
}

export async function buildAtlases(opts: {
  page: number;
  repoPath: string;
  githubUsername: string;
  githubRepo: string;
}): Promise<AtlasResult> {
  const { page, repoPath, githubUsername, githubRepo } = opts;

  const manifest = readManifest(repoPath);
  const columns = manifest.pages[`page${page}`];
  if (!columns || columns.length === 0) {
    throw new Error(`page${page} がまだ sync されていません。先に sync を実行してください。`);
  }

  const portraitDir = join(repoPath, "photos", `page${page}`, "portrait");
  const wideDir = join(repoPath, "photos", `page${page}`, "wide");
  const atlasDir = join(repoPath, "photos", `page${page}`, "atlas");
  mkdirSync(atlasDir, { recursive: true });

  const groupCount = Math.ceil(columns.length / ATLAS_COLUMNS_PER_GROUP);
  const atlases: AtlasEntry[] = [];

  for (let g = 0; g < groupCount; g++) {
    const colStart = g * ATLAS_COLUMNS_PER_GROUP;
    const colIndices = [colStart, colStart + 1].filter((i) => i < columns.length);

    const composites: { input: Buffer; left: number; top: number }[] = [];

    for (let slot = 0; slot < colIndices.length; slot++) {
      const colIdx = colIndices[slot] as number;
      const colNum = String(colIdx + 1).padStart(2, "0");
      const left = slot * ATLAS_CELL_WIDTH;

      const portraitBuf = await sharp(join(portraitDir, `${colNum}.png`))
        .resize({ width: ATLAS_CELL_WIDTH, height: ATLAS_PORTRAIT_HEIGHT, fit: "fill" })
        .toBuffer();
      composites.push({ input: portraitBuf, left, top: 0 });

      for (let w = 0; w < 3; w++) {
        const wideNum = String(colIdx * 3 + w + 1).padStart(2, "0");
        const wideBuf = await sharp(join(wideDir, `${wideNum}.png`))
          .resize({ width: ATLAS_CELL_WIDTH, height: ATLAS_WIDE_HEIGHT, fit: "fill" })
          .toBuffer();
        composites.push({
          input: wideBuf,
          left,
          top: ATLAS_PORTRAIT_HEIGHT + w * ATLAS_WIDE_HEIGHT,
        });
      }
    }

    const groupNum = String(g + 1).padStart(2, "0");
    const dest = join(atlasDir, `group${groupNum}.jpg`);

    await sharp({
      create: {
        width: ATLAS_WIDTH,
        height: ATLAS_HEIGHT,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(composites)
      .jpeg({ quality: ATLAS_JPEG_QUALITY })
      .toFile(dest);

    const url = `${RAW_BASE}/${githubUsername}/${githubRepo}/main/photos/page${page}/atlas/group${groupNum}.jpg`;
    atlases.push({ url, columns: [colIndices[0] as number, (colIndices[1] ?? colIndices[0]) as number] });

    console.log(`  ✓ group${groupNum} (col${String((colIndices[0] as number) + 1).padStart(2, "0")}${colIndices.length > 1 ? `-col${String((colIndices[1] as number) + 1).padStart(2, "0")}` : ""})`);
  }

  manifest.atlases = manifest.atlases ?? {};
  manifest.atlases[`page${page}`] = atlases;
  manifest.lastUpdated = new Date().toISOString();
  writeManifest(repoPath, manifest);

  const gitOpts = { cwd: repoPath, stdio: "inherit" as const };
  execSync("git add .", gitOpts);
  execSync(`git commit -m "feat: page${page} のアトラス画像を追加 (${atlases.length}枚)"`, gitOpts);
  execSync("git push", gitOpts);

  return { page, atlases };
}

export function generateUdonSharpAtlas(manifest: PhotoManifest): string {
  const lines: string[] = [];
  let total = 0;

  for (const [pageName, atlases] of Object.entries(manifest.atlases ?? {})) {
    lines.push(`\n    // ── ${pageName} ──`);
    atlases.forEach((atlas, i) => {
      lines.push(`    new VRCUrl("${atlas.url}"), // group${String(i + 1).padStart(2, "0")}`);
      total++;
    });
  }

  return `// VRCImageDownloader 用 アトラスURL配列 (${total}枚, 1枚=2列/8写真分)
// ページ内はgroup01→group04の順、photoRenderersは既存の96個(列順)をそのまま使う

[SerializeField] private VRCUrl[] atlasUrls = new VRCUrl[]
{
${lines.join("\n")}
};`;
}

export function generateUdonSharp(manifest: PhotoManifest): string {
  const lines: string[] = [];

  for (const [pageName, columns] of Object.entries(manifest.pages)) {
    lines.push(`\n    // ── ${pageName} ──`);
    columns.forEach((col, i) => {
      lines.push(`    // col${String(i + 1).padStart(2, "0")}`);
      lines.push(`    new VRCUrl("${col.portrait}"),`);
      col.wide.forEach((url) => lines.push(`    new VRCUrl("${url}"),`));
    });
  }

  const totalPhotos = Object.values(manifest.pages)
    .flat()
    .reduce((acc, col) => acc + 1 + col.wide.length, 0);

  return `// VRCImageDownloader 用 URL配列 (${totalPhotos}枚)
// 列ごとに: portrait(1920x1350) → wide×3(1920x1080) の順

[SerializeField] private VRCUrl[] photoUrls = new VRCUrl[]
{
${lines.join("\n")}
};`;
}

function readManifest(repoPath: string): PhotoManifest {
  const manifestPath = join(repoPath, "urls.json");
  if (!existsSync(manifestPath)) {
    return { pages: {}, atlases: {}, lastUpdated: "" };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PhotoManifest;
  manifest.atlases = manifest.atlases ?? {};
  return manifest;
}

function writeManifest(repoPath: string, manifest: PhotoManifest): void {
  writeFileSync(join(repoPath, "urls.json"), JSON.stringify(manifest, null, 2));
}
