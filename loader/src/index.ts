import { loadEnv } from "./env.js";
import { buildAtlases, generateUdonSharp, generateUdonSharpAtlas, getManifest, syncPage } from "./uploader.js";
import { EnvSchema } from "./types.js";

const env = loadEnv(EnvSchema);
const command = process.argv[2];

if (command === "sync") {
  const args = process.argv.slice(3);
  const sourceIdx = args.indexOf("--source");
  const pageIdx = args.indexOf("--page");

  if (sourceIdx === -1 || !args[sourceIdx + 1]) {
    console.error("使い方: sync --source <フォルダパス> --page <ページ番号>");
    console.error("\nフォルダ構成:");
    console.error("  source/");
    console.error("    col01/  ← 同じ時期の写真（portrait×1 + wide×3）");
    console.error("    col02/");
    console.error("    ...");
    process.exit(1);
  }

  const sourceDir = args[sourceIdx + 1] as string;
  const page =
    pageIdx !== -1 && args[pageIdx + 1]
      ? parseInt(args[pageIdx + 1] as string, 10)
      : 1;

  console.log(`page${page} をアップロード中: ${sourceDir}`);
  console.log("リサイズ中 (1920px幅に統一)...");

  const result = await syncPage({
    sourceDir,
    page,
    repoPath: env.VRCHAT_PHOTOS_REPO,
    githubUsername: env.GITHUB_USERNAME,
    githubRepo: env.GITHUB_REPO,
  });

  console.log(`\n✅ ${result.columns.length}列 (${result.count}枚) をpage${result.page}にアップロードしました\n`);
  result.columns.forEach((col, i) => {
    console.log(`col${String(i + 1).padStart(2, "0")}:`);
    console.log(`  portrait: ${col.portrait}`);
    col.wide.forEach((url, j) => console.log(`  wide${j + 1}: ${url}`));
  });
} else if (command === "list") {
  const manifest = getManifest(env.VRCHAT_PHOTOS_REPO);
  const pages = Object.keys(manifest.pages);

  if (pages.length === 0) {
    console.log("写真がまだありません。先に sync を実行してください。");
  } else {
    for (const [pageName, columns] of Object.entries(manifest.pages)) {
      console.log(`\n── ${pageName} (${columns.length}列) ──`);
      columns.forEach((col, i) => {
        console.log(`  col${String(i + 1).padStart(2, "0")}: portrait + ${col.wide.length}枚`);
      });
    }
  }
} else if (command === "generate-udon") {
  const manifest = getManifest(env.VRCHAT_PHOTOS_REPO);
  console.log(generateUdonSharp(manifest));
} else if (command === "atlas") {
  const args = process.argv.slice(3);
  const pageIdx = args.indexOf("--page");
  const page =
    pageIdx !== -1 && args[pageIdx + 1] ? parseInt(args[pageIdx + 1] as string, 10) : 1;

  console.log(`page${page} のアトラスを生成中 (1アトラス=2列/8枚, 1600x1912 JPEG)...`);

  const result = await buildAtlases({
    page,
    repoPath: env.VRCHAT_PHOTOS_REPO,
    githubUsername: env.GITHUB_USERNAME,
    githubRepo: env.GITHUB_REPO,
  });

  console.log(`\n✅ page${result.page} に ${result.atlases.length}枚のアトラスをアップロードしました\n`);
  result.atlases.forEach((a, i) => console.log(`  group${String(i + 1).padStart(2, "0")}: ${a.url}`));
} else if (command === "generate-udon-atlas") {
  const manifest = getManifest(env.VRCHAT_PHOTOS_REPO);
  console.log(generateUdonSharpAtlas(manifest));
} else {
  console.log(`vrchat-photo-loader — VRChat写真URLマネージャー

コマンド:
  sync --source <dir> --page <n>  写真をGitHubにアップロード
  list                             ページ・列の一覧を表示
  generate-udon                    UdonSharpコードスニペットを出力（個別96枚版）
  atlas --page <n>                 指定ページの8列をアトラス4枚(1600x1912 JPEG)に合成しGitHubへアップロード
  generate-udon-atlas              UdonSharpコードスニペットを出力（アトラス12枚版・atlasUrls用）

フォルダ構成 (--source の中身):
  col01/   ← 同じ時期の写真をまとめる
    portrait.png       2048x1440 (自動判別)
    wide_a.png         16:9 (自動判別)
    wide_b.png
    wide_c.png
  col02/
    ...

例:
  node dist/index.js sync --source ./page1-photos --page 1
  node dist/index.js list
  node dist/index.js generate-udon
  node dist/index.js atlas --page 1
  node dist/index.js generate-udon-atlas
`);
}
