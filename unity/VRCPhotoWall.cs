using UdonSharp;
using UnityEngine;
using VRC.SDK3.Image;
using VRC.SDKBase;

/// <summary>
/// VRChatフォトウォール — 外部URLからアトラス画像を動的に読み込む
///
/// 【Unity上での設定手順】
/// 1. PhotoWallController に Add Component → VRCPhotoWall
/// 2. メニュー VRChat → Populate Photo URLs でURLを自動入力
/// 3. photoRenderers に各Quadの Renderer を96個登録（列順: col内はportrait→wide×3）
///
/// 【アトラス方式について】
/// 写真は1枚ずつではなく、2列(8枚)ごとに1枚のアトラス画像としてダウンロードする
/// （VRCImageDownloaderは1枚5秒のダウンロード間隔制限があるため、96回→12回に削減）。
/// ダウンロードした1枚のアトラスは、そのアトラスに属する8個のRendererへ
/// mainTextureScale/Offsetで該当領域を切り出して適用する。
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.None)]
public class VRCPhotoWall : UdonSharpBehaviour
{
    // loader/src/uploader.ts の ATLAS_* 定数と一致させること
    private const int RenderersPerAtlas = 8;   // 2列 × (portrait1 + wide3)
    private const int RowsPerColumn = 4;       // portrait1 + wide3
    private const float AtlasWidth = 1600f;
    private const float AtlasHeight = 1912f;
    private const float CellWidth = 800f;
    private const float PortraitHeight = 562f;
    private const float WideHeight = 450f;

    [Header("アトラスURL — VRChat/Populate Photo URLs で自動入力")]
    [SerializeField] private VRCUrl[] atlasUrls = new VRCUrl[0];

    [Header("表示先Renderer — 列順(col内はportrait→wide×3)で96個登録")]
    [SerializeField] private Renderer[] photoRenderers = new Renderer[0];

    [Header("設定")]
    [Tooltip("ワールド参加時に自動で読み込む")]
    [SerializeField] private bool loadOnStart = true;

    [Tooltip("プレースホルダーとして表示するテクスチャ（省略可）")]
    [SerializeField] private Texture2D loadingTexture;

    private VRCImageDownloader _downloader;
    private TextureInfo _textureInfo;
    private int _pendingIndex = 0;
    private IVRCImageDownload[] _downloads;

    void Start()
    {
        _downloads = new IVRCImageDownload[atlasUrls.Length];
        _downloader = new VRCImageDownloader();

        _textureInfo = new TextureInfo();
        _textureInfo.GenerateMipMaps = true;
        _textureInfo.FilterMode = FilterMode.Bilinear;
        _textureInfo.WrapModeU = TextureWrapMode.Clamp;
        _textureInfo.WrapModeV = TextureWrapMode.Clamp;

        if (loadingTexture != null)
        {
            for (int i = 0; i < photoRenderers.Length; i++)
            {
                if (photoRenderers[i] != null)
                    photoRenderers[i].material.mainTexture = loadingTexture;
            }
        }

        if (loadOnStart) StartLoading();
    }

    public void StartLoading()
    {
        _pendingIndex = 0;
        DownloadNext();
    }

    private void DownloadNext()
    {
        if (_pendingIndex >= atlasUrls.Length) return;

        _downloader.DownloadImage(
            atlasUrls[_pendingIndex],
            null,
            this,
            _textureInfo
        );
    }

    public override void OnImageLoadSuccess(IVRCImageDownload result)
    {
        ApplyAtlasToRenderers(_pendingIndex, result.Result);

        if (_pendingIndex < _downloads.Length)
        {
            _downloads[_pendingIndex] = result;
        }

        _pendingIndex++;
        DownloadNext();
    }

    // アトラス1枚(8枚分)を、対応する8個のRendererへmainTextureScale/Offsetで切り出して適用する
    private void ApplyAtlasToRenderers(int atlasIndex, Texture atlasTexture)
    {
        int rendererStart = atlasIndex * RenderersPerAtlas;

        for (int k = 0; k < RenderersPerAtlas; k++)
        {
            int rendererIndex = rendererStart + k;
            if (rendererIndex >= photoRenderers.Length || photoRenderers[rendererIndex] == null) continue;

            int slot = k / RowsPerColumn;   // 0 = アトラス内左列, 1 = 右列
            int row = k % RowsPerColumn;    // 0 = portrait, 1-3 = wide

            float rowTopPx = row == 0 ? 0f : PortraitHeight + (row - 1) * WideHeight;
            float rowHeightPx = row == 0 ? PortraitHeight : WideHeight;

            float scaleU = CellWidth / AtlasWidth;
            float scaleV = rowHeightPx / AtlasHeight;
            float offsetU = slot * scaleU;
            float offsetV = 1f - (rowTopPx + rowHeightPx) / AtlasHeight;

            Material mat = photoRenderers[rendererIndex].material;
            mat.mainTexture = atlasTexture;
            mat.mainTextureScale = new Vector2(scaleU, scaleV);
            mat.mainTextureOffset = new Vector2(offsetU, offsetV);
        }
    }

    public override void OnImageLoadError(IVRCImageDownload result)
    {
        Debug.LogWarning($"[VRCPhotoWall] 読み込み失敗 [{_pendingIndex}]: {result.Error}");
        _pendingIndex++;
        DownloadNext();
    }
}
