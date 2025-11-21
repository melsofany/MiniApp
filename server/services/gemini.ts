import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedCardData {
  name: string;
  nationalId: string;
}

export async function processIdCardImage(imageBase64: string): Promise<ExtractedCardData> {
  try {
    const prompt = `
أنت نظام ذكاء اصطناعي متخصص في استخراج البيانات من البطاقات الشخصية المصرية.

المهام المطلوبة:
1. تحليل الصورة المرفقة للبطاقة الشخصية المصرية
2. تصحيح اتجاه الصورة تلقائياً إذا كانت مقلوبة أو مائلة
3. استخراج البيانات التالية بدقة عالية:
   - الاسم الكامل (بالعربية)
   - الرقم القومي (14 رقماً)

يجب أن تكون النتيجة بصيغة JSON فقط بالشكل التالي:
{
  "name": "الاسم الكامل بالعربية",
  "nationalId": "الرقم القومي 14 رقم"
}

ملاحظات مهمة:
- الرقم القومي يجب أن يكون 14 رقماً بالضبط
- الاسم يجب أن يكون بالعربية
- لا تضف أي تفسيرات أو نصوص إضافية، فقط JSON
- إذا لم تتمكن من قراءة البيانات بوضوح، أرجع خطأ
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            name: { type: "string" },
            nationalId: { type: "string" },
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

    const rawJson = response.text;
    
    if (!rawJson) {
      throw new Error("لم يتم الحصول على استجابة من النموذج");
    }

    const data: ExtractedCardData = JSON.parse(rawJson);

    if (!data.name || !data.nationalId) {
      throw new Error("فشل استخراج البيانات من البطاقة");
    }

    if (!/^\d{14}$/.test(data.nationalId)) {
      throw new Error("الرقم القومي يجب أن يكون 14 رقماً");
    }

    return data;
  } catch (error: any) {
    console.error("Gemini AI error:", error);
    throw new Error(error.message || "فشل معالجة الصورة بالذكاء الاصطناعي");
  }
}
