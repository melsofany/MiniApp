import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

interface GeminiResponse {
  firstNameLine: string;
  secondNameLine: string;
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

export async function processIdCardImage(imageBase64: string): Promise<ExtractedCardData> {
  try {
    const prompt = `أنت خبير في قراءة البطاقات الشخصية المصرية.

في البطاقة المصرية، الاسم يظهر على سطرين منفصلين:

السطر الأول (الأعلى): الاسم الأول فقط
مثال: "محمد" أو "فاطمة" أو "أحمد"

السطر الثاني (الأسفل): اسم الأب + الجد + العائلة
مثال: "علي محمود حسن"

استخرج:
1. السطر الأول للاسم (firstNameLine)
2. السطر الثاني للاسم (secondNameLine)
3. الرقم القومي (14 رقم)

ملاحظة مهمة جداً: السطران منفصلان - لا تدمجهما! أعطني كل سطر لوحده.`;

    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            firstNameLine: { 
              type: "string",
              description: "السطر الأول من الاسم - الاسم الأول فقط مثل: محمد، أحمد، فاطمة"
            },
            secondNameLine: { 
              type: "string",
              description: "السطر الثاني من الاسم - اسم الأب والجد والعائلة مثل: علي محمود حسن"
            },
            nationalId: { 
              type: "string",
              description: "الرقم القومي المكون من 14 رقم فقط"
            },
          },
          required: ["firstNameLine", "secondNameLine", "nationalId"],
        },
      },
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: "image/jpeg",
          },
        },
        prompt,
      ],
    });

    const response = await withTimeout(
      processPromise, 
      30000,
      "انتهى الوقت المحدد. حاول مرة أخرى."
    );

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("فشل قراءة البطاقة. التقط صورة أوضح وحاول مرة أخرى.");
    }

    const data: GeminiResponse = JSON.parse(rawJson);

    if (!data.firstNameLine || !data.secondNameLine || !data.nationalId) {
      throw new Error("فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.");
    }

    // دمج السطرين لتكوين الاسم الكامل
    const fullName = `${data.firstNameLine.trim()} ${data.secondNameLine.trim()}`;

    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    if (cleanedNationalId.length !== 14) {
      throw new Error(`الرقم القومي غير مكتمل (${cleanedNationalId.length} رقم). التقط صورة أوضح للرقم القومي.`);
    }

    console.log(`✓ تم استخراج البيانات بنجاح:`);
    console.log(`  - السطر الأول: "${data.firstNameLine}"`);
    console.log(`  - السطر الثاني: "${data.secondNameLine}"`);
    console.log(`  - الاسم الكامل: "${fullName}"`);
    console.log(`  - الرقم القومي: "${cleanedNationalId}"`);

    return {
      name: fullName,
      nationalId: cleanedNationalId
    };
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    
    if (error.message.includes("timeout") || error.message.includes("انتهى الوقت")) {
      throw new Error("العملية استغرقت وقتاً طويلاً. حاول مرة أخرى بصورة أوضح.");
    }
    
    throw new Error(error.message || "فشل معالجة الصورة. تأكد من وضوح الصورة وحاول مرة أخرى.");
  }
}
