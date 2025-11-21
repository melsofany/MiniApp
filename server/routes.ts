import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import multer from "multer";
import crypto from "crypto";
import { 
  getAllRepresentatives, 
  getRepresentativeByUserId,
  addRepresentative, 
  deleteRepresentative,
  getAllCards,
  getCardByNationalId,
  addCard,
  ensureSheetsStructure 
} from "./services/google-sheets";
import { processIdCardImage } from "./services/gemini";
import { 
  insertRepresentativeSchema,
  loginSchema,
  type Representative,
  type NationalIdCard,
  type CenterStats,
  type DailyStats 
} from "@shared/schema";
import { fromError } from "zod-validation-error";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('فقط الصور مسموح بها'));
    }
    cb(null, true);
  }
});

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyAndExtractTelegramData(initData: string, telegramBotToken: string): { valid: boolean; userId?: string; username?: string } {
  if (!initData) return { valid: false };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(telegramBotToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secret)
      .update(sortedParams)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userParam = params.get('user');
    if (!userParam) return { valid: false };

    const user = JSON.parse(userParam);
    return {
      valid: true,
      userId: user.id?.toString(),
      username: user.username || user.first_name || 'مستخدم'
    };
  } catch (error) {
    console.error('Error verifying Telegram WebApp data:', error);
    return { valid: false };
  }
}

declare module 'express-session' {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || '';
  const SESSION_SECRET = process.env.SESSION_SECRET?.trim() || '';
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';

  console.log('Environment variable check:');
  console.log('- ADMIN_PASSWORD:', ADMIN_PASSWORD ? '✓ Set' : '✗ Missing');
  console.log('- SESSION_SECRET:', SESSION_SECRET ? '✓ Set' : '✗ Missing');
  console.log('- TELEGRAM_BOT_TOKEN:', TELEGRAM_BOT_TOKEN ? '✓ Set' : '✗ Missing');

  if (!ADMIN_PASSWORD || !SESSION_SECRET || !TELEGRAM_BOT_TOKEN) {
    const missing = [];
    if (!ADMIN_PASSWORD) missing.push('ADMIN_PASSWORD');
    if (!SESSION_SECRET) missing.push('SESSION_SECRET');
    if (!TELEGRAM_BOT_TOKEN) missing.push('TELEGRAM_BOT_TOKEN');
    
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please check the Secrets tab in Replit and ensure these secrets have values set.`
    );
  }

  const ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);

  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      }
    })
  );

  await ensureSheetsStructure();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromError(validation.error).toString() 
        });
      }

      const { password } = validation.data;
      const passwordHash = hashPassword(password);

      if (passwordHash === ADMIN_PASSWORD_HASH) {
        req.session.isAuthenticated = true;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        return res.json({ success: true });
      }

      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "خطأ في تسجيل الدخول" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "خطأ في تسجيل الخروج" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    res.json({ isAuthenticated: req.session.isAuthenticated || false });
  });

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.isAuthenticated) {
      return res.status(401).json({ error: "غير مصرح" });
    }
    next();
  };

  app.get("/api/representatives", requireAuth, async (req, res) => {
    try {
      const reps = await getAllRepresentatives();
      res.json(reps);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/representatives", requireAuth, async (req, res) => {
    try {
      const validation = insertRepresentativeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: fromError(validation.error).toString() 
        });
      }

      const repData = validation.data;

      const existing = await getRepresentativeByUserId(repData.userId);
      if (existing) {
        return res.status(400).json({ error: "هذا المستخدم موجود بالفعل" });
      }

      await addRepresentative(repData);
      const newRep = await getRepresentativeByUserId(repData.userId);
      res.json(newRep);
    } catch (error: any) {
      console.error("Add representative error:", error);
      res.status(500).json({ error: error.message || "فشل إضافة المندوب" });
    }
  });

  app.delete("/api/representatives/:userId", requireAuth, async (req, res) => {
    try {
      await deleteRepresentative(req.params.userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/cards", requireAuth, async (req, res) => {
    try {
      const cards = await getAllCards();
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/process-card", upload.single('image'), async (req, res) => {
    try {
      const { initData } = req.body;

      const telegramData = verifyAndExtractTelegramData(initData, TELEGRAM_BOT_TOKEN);
      if (!telegramData.valid || !telegramData.userId || !telegramData.username) {
        console.warn('Invalid Telegram WebApp signature or missing user data');
        return res.status(403).json({ error: "توقيع تطبيق Telegram غير صالح" });
      }

      const userId = telegramData.userId;
      const username = telegramData.username;

      if (!req.file) {
        return res.status(400).json({ error: "لم يتم رفع صورة" });
      }

      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: "الملف يجب أن يكون صورة" });
      }

      const rep = await getRepresentativeByUserId(userId);
      if (!rep || rep.status !== 'نشط') {
        console.warn(`Unauthorized card upload attempt by user ${userId}`);
        return res.status(403).json({ error: `غير مصرح لك باستخدام هذا النظام\n\nUser ID: ${userId}\nUsername: ${username}` });
      }

      const imageBase64 = req.file.buffer.toString('base64');

      const extractedData = await processIdCardImage(imageBase64);

      const existing = await getCardByNationalId(extractedData.nationalId);
      if (existing) {
        console.info(`Duplicate card detected: ${extractedData.nationalId} by user ${userId}`);
        
        const originalRep = await getRepresentativeByUserId(existing.insertedByUserId);
        const originalUsername = originalRep ? originalRep.username : existing.insertedByUsername;
        
        return res.json({
          isDuplicate: true,
          existingCard: {
            ...existing,
            insertedByUsername: originalUsername
          }
        });
      }

      await addCard({
        name: extractedData.name,
        nationalId: extractedData.nationalId,
        insertedByUserId: userId,
        insertedByUsername: username,
        center: rep.center
      });

      console.info(`Card added successfully: ${extractedData.nationalId} by user ${userId} (${rep.center})`);

      res.json({
        success: true,
        isDuplicate: false,
        name: extractedData.name,
        nationalId: extractedData.nationalId
      });
    } catch (error: any) {
      console.error("Card processing error:", error);
      res.status(500).json({ 
        success: false,
        error: error.message || "فشل معالجة البطاقة"
      });
    }
  });

  app.get("/api/stats/centers", requireAuth, async (req, res) => {
    try {
      const reps = await getAllRepresentatives();
      const cards = await getAllCards();

      const today = new Date().toISOString().split('T')[0];

      const centers: ("طما" | "طهطا" | "جهينة")[] = ["طما", "طهطا", "جهينة"];
      const stats: CenterStats[] = centers.map(center => {
        const centerCards = cards.filter(c => c.center === center);
        const todayCards = centerCards.filter(c => 
          c.insertionDate.split('T')[0] === today
        );
        const activeReps = reps.filter(r => 
          r.center === center && r.status === 'نشط'
        );

        return {
          center,
          totalCards: centerCards.length,
          todayCards: todayCards.length,
          activeRepresentatives: activeReps.length
        };
      });

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stats/daily", requireAuth, async (req, res) => {
    try {
      const cards = await getAllCards();

      const dailyMap = new Map<string, { طما: number; طهطا: number; جهينة: number }>();

      cards.forEach(card => {
        const date = card.insertionDate.split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { طما: 0, طهطا: 0, جهينة: 0 });
        }
        const dayStats = dailyMap.get(date)!;
        dayStats[card.center]++;
      });

      const stats: DailyStats[] = Array.from(dailyMap.entries())
        .map(([date, counts]) => ({
          date,
          ...counts
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ping", async (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      message: "System is alive"
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
