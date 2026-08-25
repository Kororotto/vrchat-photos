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

        GameObject page1 = GameObject.Find("PhotoWall_Quads_Page1");
        GameObject page2 = GameObject.Find("PhotoWall_Quads_Page2");
        GameObject page3 = GameObject.Find("PhotoWall_Quads_Page3");

        if (page1 == null || page2 == null || page3 == null)
        {
            EditorUtility.DisplayDialog("エラー",
                $"見つからないオブジェクト:\n" +
                $"Page1: {(page1 == null ? "❌ なし" : "✓")}\n" +
                $"Page2: {(page2 == null ? "❌ なし" : "✓")}\n" +
                $"Page3: {(page3 == null ? "❌ なし" : "✓")}\n\n" +
                "PhotoWall_Quads_Page1/2/3 の名前を確認してください。",
                "OK");
            return;
        }

        var renderers = new System.Collections.Generic.List<Renderer>();
        renderers.AddRange(page1.GetComponentsInChildren<Renderer>());
        renderers.AddRange(page2.GetComponentsInChildren<Renderer>());
        renderers.AddRange(page3.GetComponentsInChildren<Renderer>());

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
