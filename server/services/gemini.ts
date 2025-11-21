import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedCardData {
  name: string;
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
    const prompt = `استخرج من البطاقة الشخصية المصرية فقط:
1. الاسم الكامل (بالعربية فقط)
2. الرقم القومي (14 رقماً فقط - بدون مسافات أو علامات)

ملاحظات مهمة:
- الرقم القومي: استخرج الأرقام ال14 فقط
- الاسم: بالعربية كما هو في البطاقة
- لا تضف أي تفسيرات، فقط البيانات المطلوبة

إذا كانت الصورة مقلوبة، صححها قبل القراءة.`;

    const processPromise = ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "الاسم الكامل بالعربية" },
            nationalId: { type: "string", description: "الرقم القومي 14 رقم" },
          },
          required: ["name", "nationalId"],
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
      15000,
      "انتهى الوقت المحدد لمعالجة الصورة. حاول التقاط صورة أوضح."
    );

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("فشل قراءة البطاقة. التقط صورة أوضح وحاول مرة أخرى.");
    }

    const data: ExtractedCardData = JSON.parse(rawJson);

    if (!data.name || !data.nationalId) {
      throw new Error("فشل استخراج البيانات. تأكد أن الصورة واضحة وتحتوي على البطاقة كاملة.");
    }

    const cleanedNationalId = data.nationalId.replace(/\D/g, '');
    
    if (cleanedNationalId.length !== 14) {
      throw new Error(`الرقم القومي غير مكتمل (${cleanedNationalId.length} رقم). التقط صورة أوضح للرقم القومي.`);
    }

    return {
      name: data.name.trim(),
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
