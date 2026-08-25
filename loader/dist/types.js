import { z } from "zod";
export const EnvSchema = z.object({
    GITHUB_USERNAME: z.string().min(1),
    GITHUB_REPO: z.string().min(1),
    VRCHAT_PHOTOS_REPO: z.string().min(1),
});
//# sourceMappingURL=types.js.map