import { z } from "zod";

// Representative/User schema
export const representativeSchema = z.object({
  userId: z.string().min(1, "User ID مطلوب"),
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  center: z.enum(["طما", "طهطا", "جهينة"], {
    errorMap: () => ({ message: "يجب اختيار المركز" })
  }),
  status: z.enum(["نشط", "غير نشط"]).default("نشط"),
  dateAdded: z.string()
});

export type Representative = z.infer<typeof representativeSchema>;

export const insertRepresentativeSchema = representativeSchema.omit({ dateAdded: true });
export type InsertRepresentative = z.infer<typeof insertRepresentativeSchema>;

// National ID Card schema
export const nationalIdCardSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  nationalId: z.string().regex(/^\d{14}$/, "الرقم القومي يجب أن يكون 14 رقماً"),
  insertedByUserId: z.string(),
  insertedByUsername: z.string(),
  center: z.enum(["طما", "طهطا", "جهينة"]),
  insertionDate: z.string()
});

export type NationalIdCard = z.infer<typeof nationalIdCardSchema>;

export const insertNationalIdCardSchema = nationalIdCardSchema.omit({ insertionDate: true });
export type InsertNationalIdCard = z.infer<typeof insertNationalIdCardSchema>;

// Statistics schema
export const centerStatsSchema = z.object({
  center: z.enum(["طما", "طهطا", "جهينة"]),
  totalCards: z.number(),
  todayCards: z.number(),
  activeRepresentatives: z.number()
});

export type CenterStats = z.infer<typeof centerStatsSchema>;

export const dailyStatsSchema = z.object({
  date: z.string(),
  طما: z.number(),
  طهطا: z.number(),
  جهينة: z.number()
});

export type DailyStats = z.infer<typeof dailyStatsSchema>;

// Duplicate check response
export const duplicateCheckSchema = z.object({
  isDuplicate: z.boolean(),
  existingCard: nationalIdCardSchema.optional()
});

export type DuplicateCheck = z.infer<typeof duplicateCheckSchema>;

// Image processing result from Gemini AI
export const imageProcessingResultSchema = z.object({
  success: z.boolean(),
  name: z.string().optional(),
  nationalId: z.string().optional(),
  error: z.string().optional()
});

export type ImageProcessingResult = z.infer<typeof imageProcessingResultSchema>;

// Login schema
export const loginSchema = z.object({
  password: z.string().min(1, "كلمة المرور مطلوبة")
});

export type Login = z.infer<typeof loginSchema>;

// Session verification
export const sessionSchema = z.object({
  isAuthenticated: z.boolean()
});

export type Session = z.infer<typeof sessionSchema>;
