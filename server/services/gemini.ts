import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Error messages in Arabic
const ERROR_MESSAGES = {
  PARSE_FAILED: "فشل قراءة استجابة الذكاء الاصطناعي. حاول مرة أخرى.",
  EXTRACTION_FAILED: "فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.",
  NAME_NOT_FOUND: "لم يتم العثور على الاسم كاملاً. تأكد من وضوح الصورة.",
  NATIONAL_ID_NOT_FOUND: "لم يتم العثور على الرقم القومي. تأكد من ظهور الرقم القومي بوضوح في الصورة.",
  NATIONAL_ID_INCOMPLETE: (len: number) => `الرقم القومي غير مكتمل (${len} رقم فقط من 14). التقط صورة أوضح للرقم القومي الكامل.`,
  READ_CARD_FAILED: "فشل قراءة البطاقة. التقط صورة أوضح وحاول مرة أخرى.",
  TIMEOUT: "انتهى الوقت المحدد. حاول مرة أخرى.",
  TIMEOUT_LONG: "العملية استغرقت وقتاً طويلاً. حاول مرة أخرى بصورة أوضح.",
  PROCESSING_FAILED: "فشل معالجة الصورة. تأكد من وضوح الصورة وحاول مرة أخرى.",
  API_KEY_ERROR: "مفتاح API غير صحيح. تأكد من إعداد GEMINI_API_KEY."
};

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

interface GeminiResponse {
  firstLine: string;
  secondLine: string;
  additionalLines: string[];
  nationalId: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * معالجة الصورة قبل إرسالها للذكاء الاصطناعي
 * - تصحيح اتجاه الصورة تلقائياً
 * - تحسين الجودة والوضوح
 * - ضبط السطوع والتباين
 * - تقليل الحجم للسرعة
 */
async function preprocessImage(imageBase64: string): Promise<string> {
  try {
    console.log('🖼️  بدء معالجة الصورة لتحسين قراءة الرقم القومي...');
    
    // تحويل من base64 إلى buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    
    // معالجة الصورة باستخدام Sharp - تحسين خاص لقراءة الأرقام
    const processedBuffer = await sharp(imageBuffer)
      // 1. تصحيح الاتجاه تلقائياً باستخدام بيانات EXIF
      .rotate()
      
      // 2. تحويل لـ grayscale لتحسين قراءة الأرقام بشكل أفضل
      .grayscale()
      
      // 3. ضبط حجم الصورة - الحد الأقصى 2500px للحصول على تفاصيل أكثر
      .resize(2500, 2500, {
        fit: 'inside',
        withoutEnlargement: true
      })
      
      // 4. زيادة الحدة بشكل أكبر لتحسين وضوح الأرقام
      .sharpen({
        sigma: 2.0,  // زيادة مقدار الحدة للأرقام
        m1: 1.5,     // مستوى تفاصيل أعلى
        m2: 3.0      // حواف أوضح للأرقام
      })
      
      // 5. تحسين التباين بشكل أقوى لإبراز الأرقام
      .normalize({
        lower: 2,
        upper: 98
      })
      
      // 6. زيادة السطوع والتباين لجعل الأرقام أكثر وضوحاً
      .modulate({
        brightness: 1.15,  // زيادة السطوع أكثر
        saturation: 0.7    // تقليل التشبع لجعل الأرقام أوضح
      })
      
      // 7. تطبيق threshold لجعل الأرقام أكثر وضوحاً (اختياري - للبطاقات ذات الجودة المنخفضة)
      .linear(1.3, -(128 * 1.3) + 128)  // زيادة التباين
      
      // 8. تحويل إلى JPEG بأعلى جودة
      .jpeg({
        quality: 98,
        progressive: true,
        optimizeScans: true
      })
      
      // تحويل إلى Buffer
      .toBuffer();
    
    // تحويل النتيجة إلى base64
    const processedBase64 = processedBuffer.toString('base64');
    
    const originalSize = (imageBuffer.length / 1024).toFixed(2);
    const processedSize = (processedBuffer.length / 1024).toFixed(2);
    
    console.log('✅ اكتملت معالجة الصورة:');
    console.log('   📏 الحجم الأصلي:', originalSize, 'KB');
    console.log('   📏 الحجم بعد المعالجة:', processedSize, 'KB');
    console.log('   🔄 تصحيح الاتجاه: تلقائي');
    console.log('   ✨ تحسين الجودة: نعم');
    console.log('   🔍 زيادة الحدة: نعم');
    console.log('   ☀️  تحسين السطوع والتباين: نعم');
    
    return processedBase64;
  } catch (error: any) {
    console.error('❌ Image preprocessing error:', error);
    console.warn('⚠️  Will use original image without preprocessing');
    // في حالة الخطأ، نرجع الصورة الأصلية
    return imageBase64;
  }
}

export async function processIdCardImage(imageBase64: string): Promise<ExtractedCardData> {
  try {
    // معالجة الصورة قبل إرسالها للذكاء الاصطناعي
    const processedImageBase64 = await preprocessImage(imageBase64);
    
    const prompt = `استخرج البيانات من البطاقة الشخصية المصرية بدقة 100%.

🚨🚨🚨 تحذير مهم جداً: الرقم القومي هو أهم عنصر! 🚨🚨🚨
يجب قراءة كل رقم من الأرقام ال 14 بدقة تامة بدون أي خطأ.

═══════════════════════════════════════════════════════════
📋 الجزء 1: استخراج الرقم القومي (الأولوية القصوى!)
═══════════════════════════════════════════════════════════

🔍 كيف تجد الرقم القومي في البطاقة:
1. الرقم القومي يكون في أحد هذه الأماكن:
   ✓ في أسفل البطاقة (عادة)
   ✓ في الجانب الأيمن أو الأيسر
   ✓ بجانب كلمة: "الرقم القومي" أو "رقم قومي" أو "National ID" أو "National No" أو "ID Number"

2. شكل الرقم القومي:
   ✓ دائماً 14 رقم بالضبط - لا أكثر ولا أقل
   ✓ الأرقام متصلة بدون مسافات
   ✓ لا يحتوي على حروف أو رموز
   ✓ مثال: 29501011234567

🎯 خطوات قراءة الرقم القومي (اتبعها بدقة):
خطوة 1️⃣: ابحث عن منطقة الرقم القومي في البطاقة
خطوة 2️⃣: ركز جيداً على الأرقام
خطوة 3️⃣: اقرأ الرقم الأول ← 2
خطوة 4️⃣: اقرأ الرقم الثاني ← 9
خطوة 5️⃣: اقرأ الرقم الثالث ← 5
خطوة 6️⃣: اقرأ الرقم الرابع ← 0
خطوة 7️⃣: اقرأ الرقم الخامس ← 1
خطوة 8️⃣: اقرأ الرقم السادس ← 0
خطوة 9️⃣: اقرأ الرقم السابع ← 1
خطوة 🔟: اقرأ الرقم الثامن ← 1
خطوة 1️⃣1️⃣: اقرأ الرقم التاسع ← 2
خطوة 1️⃣2️⃣: اقرأ الرقم العاشر ← 3
خطوة 1️⃣3️⃣: اقرأ الرقم الحادي عشر ← 4
خطوة 1️⃣4️⃣: اقرأ الرقم الثاني عشر ← 5
خطوة 1️⃣5️⃣: اقرأ الرقم الثالث عشر ← 6
خطوة 1️⃣6️⃣: اقرأ الرقم الرابع عشر ← 7
خطوة 1️⃣7️⃣: تأكد أنك قرأت 14 رقم بالضبط
خطوة 1️⃣8️⃣: اجمع الأرقام معاً بدون مسافات: 29501011234567

⚠️ احذر من هذه الأخطاء الشائعة:
❌ قراءة 13 رقم فقط (ناقص رقم!)
❌ قراءة 15 رقم (زيادة رقم!)
❌ الخلط بين الأرقام المتشابهة:
   • لا تخلط بين 0 (صفر) و O (حرف أو)
   • لا تخلط بين 1 (واحد) و I (حرف آي) و l (حرف إل)
   • لا تخلط بين 5 (خمسة) و S (حرف إس)
   • لا تخلط بين 8 (ثمانية) و B (حرف بي)
❌ إضافة مسافات بين الأرقام
❌ نسيان رقم من الأرقام

✅ أمثلة صحيحة للرقم القومي (كلها 14 رقم):
• 29501011234567
• 30105251234567
• 29612051234567
• 28803141234567
• 31204151234567
• 27509281234567
• 30010011234567
• 29912311234567

═══════════════════════════════════════════════════════════
📋 الجزء 2: استخراج الاسم
═══════════════════════════════════════════════════════════

البطاقة المصرية تعرض الاسم في منطقة "الاسم" أو "Name":

┌─────────────────────────────┐
│ الاسم / Name                │
│ ┌─────────────────────────┐ │
│ │ السطر الأول (في الأعلى) │ │  ← اسم الشخص فقط (1-2 كلمة)
│ │ السطر الثاني            │ │  ← اسم الأب + الجد + العائلة
│ │ (قد يوجد سطر ثالث)      │ │  ← تكملة الأسماء (نادراً)
│ └─────────────────────────┘ │
└─────────────────────────────┘

🔴 خطوات استخراج الاسم:
1️⃣ ابحث عن كلمة "الاسم" أو "Name"
2️⃣ اقرأ السطر الأول تحتها مباشرة → ضعه في firstLine
3️⃣ اقرأ السطر الثاني تحت السطر الأول → ضعه في secondLine
4️⃣ إذا كان هناك سطر ثالث → ضعه في additionalLines

مثال كامل:
البطاقة تعرض:
┌──────────────────┐
│ Name             │
│ أحمد محمد        │  ← firstLine
│ حسن علي السيد    │  ← secondLine
└──────────────────┘
الرقم القومي: 29501011234567  ← nationalId (14 رقم!)

النتيجة:
{
  "firstLine": "أحمد محمد",
  "secondLine": "حسن علي السيد",
  "additionalLines": [],
  "nationalId": "29501011234567"
}

═══════════════════════════════════════════════════════════
🎯 التعليمات النهائية
═══════════════════════════════════════════════════════════

✅ افعل:
1. ركز على الرقم القومي أولاً - هو الأهم!
2. اقرأ كل رقم من الأرقام ال 14 بتركيز شديد
3. تأكد أن الرقم القومي = 14 رقم بالضبط
4. ضع الأرقام فقط بدون مسافات أو رموز
5. راجع الرقم مرتين قبل الإرجاع

❌ لا تفعل:
1. لا تنسى أي رقم من الأرقام ال 14
2. لا تضع مسافات في الرقم القومي
3. لا تخلط بين الأرقام والحروف
4. لا تضع أي نص أو رموز مع الرقم القومي

أرجع البيانات بصيغة JSON فقط.`;

    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstLine: { 
              type: "string",
              description: "السطر الأول من اسم البطاقة - اسم الشخص فقط الموجود في الأعلى (1-2 كلمة عادةً) - لا يحتوي على اسم الأب"
            },
            secondLine: { 
              type: "string",
              description: "السطر الثاني من اسم البطاقة مباشرةً تحت السطر الأول - يبدأ باسم الأب ثم الجد ثم العائلة (2-4 كلمات عادةً)"
            },
            additionalLines: {
              type: "array",
              items: { type: "string" },
              description: "أسطر إضافية إن وجدت (السطر الثالث والرابع إلخ). إذا لم يكن هناك أسطر إضافية، أرجع مصفوفة فارغة []"
            },
            nationalId: { 
              type: "string",
              description: "🚨 الرقم القومي - الأهم من كل شيء! 🚨 يتكون من 14 رقم بالضبط (لا أكثر ولا أقل). اقرأ كل رقم بتركيز شديد. ابحث عن كلمة 'الرقم القومي' أو 'National ID' في البطاقة. أمثلة صحيحة: 29501011234567, 30105251234567, 28803141234567. ضع الأرقام فقط بدون مسافات أو رموز أو نصوص. يجب أن يكون 14 رقم بالضبط - راجع مرتين!"
            },
          },
          required: ["firstLine", "secondLine", "additionalLines", "nationalId"],
        },
      },
      contents: [
        {
          inlineData: {
            data: processedImageBase64,
            mimeType: "image/jpeg",
          },
        },
        prompt,
      ],
    });

    const response = await withTimeout(
      processPromise, 
      30000,
      ERROR_MESSAGES.TIMEOUT
    );

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error(ERROR_MESSAGES.READ_CARD_FAILED);
    }

    console.log('🔍 استجابة Gemini AI الكاملة:', rawJson);

    let data: GeminiResponse;
    try {
      data = JSON.parse(rawJson);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON from Gemini:', parseError);
      throw new Error(ERROR_MESSAGES.PARSE_FAILED);
    }

    console.log('📋 Extracted data:');
    console.log('  - First line:', data.firstLine || '❌ missing');
    console.log('  - Second line:', data.secondLine || '❌ missing');
    console.log('  - Additional lines:', data.additionalLines || []);
    console.log('  - National ID:', data.nationalId || '❌ missing');

    // التحقق من وجود البيانات المطلوبة
    if (!data.firstLine || !data.secondLine || !data.nationalId) {
      throw new Error(ERROR_MESSAGES.EXTRACTION_FAILED);
    }

    // تنظيف الأسطر
    const firstLine = data.firstLine.trim();
    const secondLine = data.secondLine.trim();
    const additionalLines = (data.additionalLines || [])
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (!firstLine || !secondLine) {
      throw new Error(ERROR_MESSAGES.NAME_NOT_FOUND);
    }

    console.log('\n\n📊 تحليل الأسطر المستخرجة');
    console.log('==============================================');
    console.log('First line (owner name):', firstLine);
    console.log('Word count:', firstLine.split(/\s+/).filter(w => w.length > 0).length);
    console.log('----------------------------------------------');
    console.log('Second line (father + grandfather + family):', secondLine);
    console.log('Word count:', secondLine.split(/\s+/).filter(w => w.length > 0).length);
    
    if (additionalLines.length > 0) {
      console.log('----------------------------------------------');
      console.log('Additional lines:');
      additionalLines.forEach((line, idx) => {
        console.log('  Line', idx + 3, ':', line);
      });
    }
    console.log('==============================================');

    // بناء الاسم الكامل بالترتيب الصحيح
    // الاسم الكامل = السطر الأول + السطر الثاني + أي أسطر إضافية
    const nameParts = [firstLine, secondLine, ...additionalLines];
    const fullName = nameParts.join(' ').trim();

    // تنظيف الرقم القومي
    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    console.log('🔢 National ID cleanup:', data.nationalId, '->', cleanedNationalId, '(', cleanedNationalId.length, 'digits)');
    
    if (!cleanedNationalId || cleanedNationalId.length === 0) {
      console.error('❌ National ID is completely empty');
      throw new Error(ERROR_MESSAGES.NATIONAL_ID_NOT_FOUND);
    }
    
    if (cleanedNationalId.length !== 14) {
      console.error('National ID incomplete:', cleanedNationalId.length, 'digits instead of 14');
      throw new Error(ERROR_MESSAGES.NATIONAL_ID_INCOMPLETE(cleanedNationalId.length));
    }

    // التحقق النهائي من عدد الكلمات
    const totalWords = fullName.split(/\s+/).filter(w => w.length > 0).length;
    
    if (totalWords < 2) {
      console.warn('⚠️ Warning: Full name contains only one word - there may be a reading error');
    }

    if (totalWords > 6) {
      console.warn('⚠️ Warning: Full name contains more than 6 words - verify extraction accuracy');
    }

    console.log('\n✅ ✅ ✅ Data extraction successful');
    console.log('==============================================');
    console.log('📝 Full name:', fullName);
    console.log('');
    console.log('👤 Line breakdown:');
    console.log('  • First line:', firstLine);
    console.log('  • Second line:', secondLine);
    if (additionalLines.length > 0) {
      additionalLines.forEach((line, idx) => {
        console.log('  • Line', idx + 3, ':', line);
      });
    }
    console.log('');
    console.log('🆔 National ID:', cleanedNationalId);
    console.log('📊 Total words:', totalWords);
    console.log('==============================================');

    return {
      name: fullName,
      nationalId: cleanedNationalId
    };
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    
    if (error.message && (error.message.includes("timeout") || error.message.includes(ERROR_MESSAGES.TIMEOUT))) {
      throw new Error(ERROR_MESSAGES.TIMEOUT_LONG);
    }
    
    if (error.message && error.message.includes("API key")) {
      throw new Error(ERROR_MESSAGES.API_KEY_ERROR);
    }
    
    throw new Error(error.message || ERROR_MESSAGES.PROCESSING_FAILED);
  }
}
