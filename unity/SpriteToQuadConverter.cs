#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;

/// <summary>
/// 既存のSpriteRendererをQuad(MeshRenderer)に自動変換するEditorツール
///
/// 【使い方】
/// 1. このファイルを Assets/Editor/ フォルダに入れる
/// 2. Hierarchyで写真の親オブジェクトを選択
/// 3. メニュー → VRChat → Convert Sprites to Quads
/// 4. 生成された「PhotoWall_Quads」オブジェクトを確認
/// 5. VRCPhotoWall スクリプトをアタッチし、Quads を photoRenderers に登録
/// </summary>
public class SpriteToQuadConverter : MonoBehaviour
{
    [MenuItem("VRChat/Convert Sprites to Quads")]
    static void ConvertSpritesToQuads()
    {
        GameObject selected = Selection.activeGameObject;
        if (selected == null)
        {
            EditorUtility.DisplayDialog("エラー", "Hierarchyで写真の親オブジェクトを選択してください。", "OK");
            return;
        }

        SpriteRenderer[] sprites = selected.GetComponentsInChildren<SpriteRenderer>(true);
        if (sprites.Length == 0)
        {
            EditorUtility.DisplayDialog("エラー", "SpriteRendererが見つかりませんでした。", "OK");
            return;
        }

        // Unlit/Texture マテリアルを作成（ライティングの影響を受けない）
        Material mat = new Material(Shader.Find("Unlit/Texture"))
        {
            name = "PhotoWall_Material"
        };

        // Quads の親オブジェクトを作成
        GameObject quadParent = new GameObject("PhotoWall_Quads");
        if (selected.transform.parent != null)
            quadParent.transform.SetParent(selected.transform.parent);
        quadParent.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        quadParent.transform.localScale = Vector3.one;

        int count = 0;
        foreach (SpriteRenderer sr in sprites)
        {
            if (sr.sprite == null) continue;

            float ppu = sr.sprite.pixelsPerUnit;
            float texW = sr.sprite.rect.width;
            float texH = sr.sprite.rect.height;

            // ワールド空間での表示サイズを計算
            float worldW = (texW / ppu) * Mathf.Abs(sr.transform.lossyScale.x);
            float worldH = (texH / ppu) * Mathf.Abs(sr.transform.lossyScale.y);

            // Quad を生成
            GameObject quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            quad.name = sr.gameObject.name + "_Quad";
            quad.transform.SetParent(quadParent.transform);
            quad.transform.SetPositionAndRotation(sr.transform.position, sr.transform.rotation);
            quad.transform.localScale = new Vector3(worldW, worldH, 0.001f);

            // マテリアルを設定
            quad.GetComponent<MeshRenderer>().sharedMaterial = mat;

            // 不要なColliderを削除
            DestroyImmediate(quad.GetComponent<Collider>());

            count++;
        }

        // Undo登録
        Undo.RegisterCreatedObjectUndo(quadParent, "Convert Sprites to Quads");

        Debug.Log($"[SpriteToQuadConverter] {count}個のQuadを生成しました → {quadParent.name}");
        EditorUtility.DisplayDialog(
            "完了",
            $"{count}個のQuadを生成しました。\n\n" +
            "次の手順:\n" +
            "1. PhotoWall_Quads に VRCPhotoWall スクリプトをアタッチ\n" +
            "2. photoRenderers に全Quadを列順でドラッグ\n" +
            "3. photoUrls に generate-udon の出力をペースト",
            "OK"
        );

        Selection.activeGameObject = quadParent;
        EditorGUIUtility.PingObject(quadParent);
    }
}
#endif
