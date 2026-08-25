export function loadEnv(schema) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
        const missing = result.error.issues
            .map((i) => `  ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        throw new Error(`環境変数の設定エラー:\n${missing}`);
    }
    return result.data;
}
//# sourceMappingURL=env.js.map