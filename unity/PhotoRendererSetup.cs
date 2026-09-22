#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;

public class PhotoRendererSetup
{
    [MenuItem("VRChat/Setup Photo Renderers")]
    static void SetupRenderers()
    {
        VRCPhotoWall wall = Object.FindObjectOfType<VRCPhotoWall>();
        if (wall == null)
        {
            EditorUtility.DisplayDialog("エラー", "VRCPhotoWall が見つかりません。", "OK");
            return;
        }

        const int PageCount = 5;
        var pages = new GameObject[PageCount];
        var missing = new System.Collections.Generic.List<int>();
        for (int i = 0; i < PageCount; i++)
        {
            pages[i] = GameObject.Find($"PhotoWall_Quads_Page{i + 1}");
            if (pages[i] == null) missing.Add(i + 1);
        }

        if (missing.Count > 0)
        {
            var lines = new System.Collections.Generic.List<string>();
            for (int i = 0; i < PageCount; i++)
                lines.Add($"Page{i + 1}: {(pages[i] == null ? "❌ なし" : "✓")}");

            EditorUtility.DisplayDialog("エラー",
                $"見つからないオブジェクト:\n{string.Join("\n", lines)}\n\n" +
                $"PhotoWall_Quads_Page1〜{PageCount} の名前を確認してください。",
                "OK");
            return;
        }

        var renderers = new System.Collections.Generic.List<Renderer>();
        foreach (GameObject page in pages)
            renderers.AddRange(page.GetComponentsInChildren<Renderer>());

        SerializedObject so = new SerializedObject(wall);
        SerializedProperty prop = so.FindProperty("photoRenderers");
        prop.arraySize = renderers.Count;
        for (int i = 0; i < renderers.Count; i++)
            prop.GetArrayElementAtIndex(i).objectReferenceValue = renderers[i];
        so.ApplyModifiedProperties();
        EditorUtility.SetDirty(wall);

        EditorUtility.DisplayDialog("完了", $"{renderers.Count} 個の Renderer を登録しました。", "OK");
        Debug.Log($"[PhotoRendererSetup] {renderers.Count} 個の Renderer を登録しました。");
    }
}
#endif
