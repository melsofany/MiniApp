# نشر المشروع على Render

## المتغيرات البيئية المطلوبة (Environment Variables)

عند نشر المشروع على Render، أضف المتغيرات التالية:

### 1. Google Sheets (Service Account)
```
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
GOOGLE_SHEET_ID=15hjsS5SvoZP2Qlt4tBSnczR40yZcn3HD31lpqU_BtVs
```

**كيفية الحصول على Service Account:**
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/)
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. فعّل Google Sheets API من Library
4. اذهب إلى **Credentials** → **Create Credentials** → **Service Account**
5. حمّل ملف JSON
6. انسخ محتوى الملف بالكامل وضعه في `GOOGLE_SERVICE_ACCOUNT_JSON`
7. شارك Google Sheet مع البريد الموجود في الملف (client_email)

### 2. Gemini API
```
GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
```

### 3. Telegram Bot
```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_from_botfather
```

### 4. Admin & Session
```
ADMIN_PASSWORD=your_secure_password
SESSION_SECRET=random_string_at_least_32_characters
```

### 5. WEBHOOK_URL (مهم جداً!)
```
WEBHOOK_URL=https://your-app-name.onrender.com
```

⚠️ **مهم جداً**: استبدل `your-app-name` باسم تطبيقك الفعلي على Render!

**لماذا نحتاج WEBHOOK_URL؟**
1. **Keep-Alive System**: يمنع التطبيق من النوم بعد 15 دقيقة
2. **Mini App URL**: يستخدمه البوت لإرسال رابط التطبيق المصغر الصحيح
3. يجب أن يكون رابط تطبيقك الكامل على Render (بدون `/api/ping` أو `/mini-app`)

### 6. إعدادات البيئة الإنتاجية
```
NODE_ENV=production
```

⚠️ **مهم**: عند النشر على Render، تأكد من إضافة `NODE_ENV=production` لتفعيل الإعدادات الأمنية الصحيحة.

---

## خطوات النشر على Render

1. **إنشاء Web Service جديد**
   - اختر "Web Service"
   - اربط مستودع GitHub الخاص بك

2. **إعدادات البناء**
   - Build Command: `npm install`
   - Start Command: `npm run dev`
   - Environment: `Node`

3. **أضف المتغيرات البيئية**
   - اذهب إلى Environment
   - أضف جميع المتغيرات المذكورة أعلاه

4. **انشر المشروع**
   - اضغط على "Create Web Service"

---

## ملاحظات مهمة

- ✅ التطبيق يدعم طريقتين للاتصال بـ Google Sheets:
  - **Replit**: OAuth Connector (تلقائي)
  - **Render**: Service Account JSON (يدوي)

- ⚠️ تأكد من مشاركة Google Sheet مع البريد الإلكتروني للـ Service Account

- 🔐 جميع المتغيرات حساسة - لا تشاركها علناً

- 🔄 **نظام Keep-Alive**: 
  - يعمل تلقائياً بعد إضافة `WEBHOOK_URL`
  - يرسل ping كل 5 دقائق إلى `/api/ping`
  - يمنع نوم التطبيق على Render المجاني

- 🤖 **تعارض البوت (Bot Conflict)**:
  - البوت يجب أن يعمل في مكان واحد فقط
  - على Replit: تم تعطيل البوت تلقائياً (DISABLE_BOT=true)
  - على Render: البوت سيعمل بشكل طبيعي
  - ⚠️ **مهم**: لا تشغل التطبيق على Replit و Render في نفس الوقت!

- 🔒 **إعدادات Session**:
  - تم إضافة `trust proxy` للعمل خلف proxy Render
  - Session cookies تعمل بشكل صحيح في Production
  - تم حفظ الـ session بشكل صريح بعد تسجيل الدخول

---

## كيفية التحقق من عمل Keep-Alive

بعد النشر، راقب السجلات (Logs) في Render:

**عند بدء التطبيق:**
```
✓ Keep-alive system initialized using WEBHOOK_URL (pings every 5 minutes)
  Target URL: https://your-app.onrender.com
```

**كل 5 دقائق:**
```
✓ Keep-alive ping successful: 2024-01-01T00:00:00.000Z
```

إذا رأيت هذه الرسائل، فالنظام يعمل بشكل صحيح! ✅

---

## اختبار الاتصال

بعد النشر، اختبر الاتصال عبر:
```
https://your-app-name.onrender.com/api/ping
```

يجب أن ترى:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "message": "System is alive"
}
```
