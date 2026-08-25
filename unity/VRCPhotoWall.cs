using UdonSharp;
using UnityEngine;
using VRC.SDK3.Image;
using VRC.SDKBase;
using VRC.Udon.Common.Interfaces;

/// <summary>
/// VRChatフォトウォール — 外部URLから写真を動的に読み込む
///
/// 【Unity上での設定手順】
/// 1. このスクリプトを空のGameObjectにアタッチ
/// 2. photoUrls に generate-udon コマンドの出力をコピー
/// 3. photoRenderers に各Quadの Renderer を列ごとに順番でドラッグ
///    順番: col01の portrait → col01のwide1 → col01のwide2 → col01のwide3
///          → col02のportrait → col02のwide1 → ...
///
/// 【Quadのスケール】
///   portrait (1920x1350): X=1.0, Y=0.703, Z=1
///   wide     (1920x1080): X=1.0, Y=0.5625, Z=1
///   ※ 同じXスケールにすると横幅が揃う
/// </summary>
[UdonBehaviourSyncMode(BehaviourSyncMode.None)]
public class VRCPhotoWall : UdonSharpBehaviour, IVRCImageDownloadCallback
{
    [Header("写真URL — generate-udon の出力をここにペースト")]
    [SerializeField] private VRCUrl[] photoUrls = new VRCUrl[0];

    [Header("表示先Renderer — photoUrlsと同じ順番で並べる")]
    [SerializeField] private Renderer[] photoRenderers = new Renderer[0];

    [Header("設定")]
    [Tooltip("ワールド参加時に自動で読み込む")]
    [SerializeField] private bool loadOnStart = true;

    [Tooltip("プレースホルダーとして表示するテクスチャ（省略可）")]
    [SerializeField] private Texture2D loadingTexture;

    // ダウンロード管理
    private VRCImageDownloader _downloader;
    private TextureInfo _textureInfo;
    private int _pendingIndex = 0;
    private IVRCImageDownload[] _downloads; // テクスチャをGCから守るために保持

    void Start()
    {
        _downloads = new IVRCImageDownload[photoUrls.Length];

        _downloader = new VRCImageDownloader();

        _textureInfo = new TextureInfo();
        _textureInfo.GenerateMipMaps = true;
        _textureInfo.FilterMode = FilterMode.Bilinear;
        _textureInfo.WrapModeU = TextureWrapMode.Clamp;
        _textureInfo.WrapModeV = TextureWrapMode.Clamp;
        _textureInfo.AnisotropicLevel = 9;

        // プレースホルダーを全Quadに表示
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

    /// <summary>手動で読み込みを開始する（ボタン等から呼び出し可）</summary>
    public void StartLoading()
    {
        _pendingIndex = 0;
        DownloadNext();
    }

    private void DownloadNext()
    {
        if (_pendingIndex >= photoUrls.Length) return;
        if (_pendingIndex >= photoRenderers.Length) return;

        _downloader.DownloadImage(
            photoUrls[_pendingIndex],
            null,
            (IVRCImageDownloadCallback)this,
            _textureInfo
        );
    }

    public override void OnImageLoadSuccess(IVRCImageDownload result)
    {
        // テクスチャをRendererに適用
        if (_pendingIndex < photoRenderers.Length && photoRenderers[_pendingIndex] != null)
        {
            photoRenderers[_pendingIndex].material.mainTexture = result.Texture;
        }

        // 参照を保持（テクスチャがGCされないように）
        if (_pendingIndex < _downloads.Length)
        {
            _downloads[_pendingIndex] = result;
        }

        _pendingIndex++;
        DownloadNext();
    }

    public override void OnImageLoadError(IVRCImageDownload result)
    {
        Debug.LogWarning($"[VRCPhotoWall] 読み込み失敗 [{_pendingIndex}]: {result.ErrorMessage}");
        _pendingIndex++;
        DownloadNext();
    }
}
