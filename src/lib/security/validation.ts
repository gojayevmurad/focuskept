import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128);
export const credentialsSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});
export function safeRedirect(value: string | undefined) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\\r\n]/.test(value)
    ? value
    : "/dashboard";
}
export function sameOrigin(request: Request, origin: string) {
  return request.headers.get("origin") === new URL(origin).origin;
}
