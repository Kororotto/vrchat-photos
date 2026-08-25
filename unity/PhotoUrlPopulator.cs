#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;

// Urls は loader の `generate-udon-atlas` コマンドの出力で置き換える。
// 手順:
//   1. cd loader && npm run build
//   2. node dist/index.js atlas --page 1   (page 2, 3 も同様に実行)
//   3. node dist/index.js generate-udon-atlas
//   4. 出力された12個のURL文字列で下記 Urls 配列を置き換える
//      (group01→04 × page1→3 の順、1枚=2列/8写真分のアトラス画像)
public class PhotoUrlPopulator
{
    static readonly string[] Urls = new string[]
    {
        // ── page1 ──
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page1/atlas/group01.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page1/atlas/group02.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page1/atlas/group03.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page1/atlas/group04.jpg",
        // ── page2 ──
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page2/atlas/group01.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page2/atlas/group02.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page2/atlas/group03.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page2/atlas/group04.jpg",
        // ── page3 ──
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page3/atlas/group01.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page3/atlas/group02.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page3/atlas/group03.jpg",
        "https://raw.githubusercontent.com/Kororotto/vrchat-photos/main/photos/page3/atlas/group04.jpg",
    };

    [MenuItem("VRChat/Populate Photo URLs")]
    static void PopulateUrls()
    {
        if (Urls.Length == 0)
        {
            EditorUtility.DisplayDialog(
                "エラー",
                "Urls が空です。\nloader で `atlas --page 1/2/3` → `generate-udon-atlas` を実行し、\n出力をこのファイルの Urls 配列に貼り付けてから実行してください。",
                "OK");
            return;
        }

        if (Urls.Length != 12)
        {
            Debug.LogWarning($"[PhotoUrlPopulator] Urls が12個ではありません（{Urls.Length}個）。generate-udon-atlas の出力と一致しているか確認してください。");
        }

        VRCPhotoWall wall = Object.FindObjectOfType<VRCPhotoWall>();
        if (wall == null)
        {
            EditorUtility.DisplayDialog("エラー", "シーン内に VRCPhotoWall が見つかりません。\nPhotoWallController に VRCPhotoWall を Add Component してください。", "OK");
            return;
        }

        SerializedObject so = new SerializedObject(wall);
        SerializedProperty urlsProp = so.FindProperty("atlasUrls");

        urlsProp.arraySize = Urls.Length;
        for (int i = 0; i < Urls.Length; i++)
        {
            SerializedProperty element = urlsProp.GetArrayElementAtIndex(i);
            SerializedProperty urlField = element.FindPropertyRelative("url");
            if (urlField != null)
                urlField.stringValue = Urls[i];
            else
                Debug.LogWarning($"[PhotoUrlPopulator] url フィールドが見つかりません (index {i})");
        }

        so.ApplyModifiedProperties();
        EditorUtility.SetDirty(wall);
        AssetDatabase.SaveAssets();

        EditorUtility.DisplayDialog("完了", $"{Urls.Length} 個のアトラスURLを設定しました。", "OK");
        Debug.Log($"[PhotoUrlPopulator] {Urls.Length} 個のアトラスURLを設定しました。");
    }
}
#endif
