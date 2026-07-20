import { z } from "zod";

/** Shared client/server validation for the Settings singleton form (no `server-only` import —
 * see src/lib/orders/schemas.ts for the pattern this mirrors). */
export const settingsFormSchema = z.object({
  whatsapp: z.string().trim().min(1).max(40),
  email: z.email(),
  instagram: z.string().trim().max(60).optional(),
  announcementAr: z.string().trim().max(500).optional(),
  announcementEn: z.string().trim().max(500).optional(),
  announcementActive: z.boolean(),
  customOtherEnabled: z.boolean(),
});

export type SettingsFormValues = z.infer<typeof settingsFormSchema>;
