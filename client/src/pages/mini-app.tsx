import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, CheckCircle2, XCircle, AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ImageProcessingResult, DuplicateCheck } from "@shared/schema";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
      };
    };
  }
}

type ProcessingState = "idle" | "capturing" | "processing" | "success" | "error" | "duplicate";

export default function MiniApp() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImageProcessingResult | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheck | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      const user = tg.initDataUnsafe.user;
      if (user) {
        setUserId(user.id.toString());
        setUsername(user.username || user.first_name || "مستخدم");
      }
    }
  }, []);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("processing");
    setError("");
    setResult(null);
    setDuplicateInfo(null);

    try {
      const initData = window.Telegram?.WebApp?.initData || '';
      
      const formData = new FormData();
      formData.append("image", file);
      formData.append("initData", initData);

      const response = await fetch("/api/process-card", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "فشل معالجة الصورة");
      }

      const data = await response.json();

      if (data.isDuplicate) {
        setState("duplicate");
        setDuplicateInfo(data);
      } else if (data.success) {
        setState("success");
        setResult(data);
      } else {
        setState("error");
        setError(data.error || "فشل استخراج البيانات من البطاقة");
      }
    } catch (err: any) {
      setState("error");
      setError(err.message || "حدث خطأ أثناء معالجة الصورة");
    }
  };

  const handleReset = () => {
    setState("idle");
    setError("");
    setResult(null);
    setDuplicateInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="max-w-md mx-auto space-y-4 py-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">التقاط البطاقة الشخصية</h1>
          <p className="text-sm text-muted-foreground">
            قم بتصوير الوجه الأمامي للبطاقة الشخصية
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          data-testid="input-file"
        />

        {state === "idle" && (
          <Card className="border-dashed border-2">
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center min-h-[300px] space-y-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Camera className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">ابدأ التصوير</h3>
                <p className="text-sm text-muted-foreground">
                  تأكد من وضوح البطاقة وعدم وجود ظلال
                </p>
              </div>
              <Button size="lg" onClick={handleCapture} className="gap-2" data-testid="button-capture">
                <Camera className="w-5 h-5" />
                التقاط صورة البطاقة
              </Button>
            </CardContent>
          </Card>
        )}

        {state === "processing" && (
          <Card>
            <CardContent className="pt-6 pb-6 flex flex-col items-center justify-center min-h-[300px] space-y-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">جاري معالجة الصورة...</h3>
                <p className="text-sm text-muted-foreground">
                  يتم الآن تصحيح الاتجاه، تحسين الجودة، واستخراج البيانات
                </p>
                <p className="text-xs text-muted-foreground">
                  قد يستغرق الأمر بضع ثوانٍ
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {state === "success" && result && (
          <Card className="border-green-500/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-green-700 dark:text-green-400">تم بنجاح!</CardTitle>
              <CardDescription>تم استخراج البيانات وحفظها في النظام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الاسم الكامل</p>
                  <p className="font-semibold text-lg" data-testid="text-extracted-name">{result.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الرقم القومي</p>
                  <p className="font-mono font-semibold text-lg" data-testid="text-extracted-id">{result.nationalId}</p>
                </div>
              </div>
              <Button onClick={handleReset} className="w-full gap-2" data-testid="button-new-card">
                <RotateCw className="w-4 h-4" />
                التقاط بطاقة جديدة
              </Button>
            </CardContent>
          </Card>
        )}

        {state === "duplicate" && duplicateInfo?.existingCard && (
          <Card className="border-yellow-500/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mb-2">
                <AlertTriangle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
              </div>
              <CardTitle className="text-yellow-700 dark:text-yellow-400">بطاقة مكررة!</CardTitle>
              <CardDescription>هذه البطاقة تم إدخالها مسبقاً في النظام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الاسم</p>
                  <p className="font-semibold">{duplicateInfo.existingCard.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الرقم القومي</p>
                  <p className="font-mono font-semibold">{duplicateInfo.existingCard.nationalId}</p>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">تم الإدخال بواسطة</p>
                  <p className="font-semibold">{duplicateInfo.existingCard.insertedByUsername}</p>
                  <p className="text-xs text-muted-foreground">
                    User ID: {duplicateInfo.existingCard.insertedByUserId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    المركز: {duplicateInfo.existingCard.center}
                  </p>
                </div>
              </div>
              <Button onClick={handleReset} variant="outline" className="w-full gap-2" data-testid="button-try-another">
                <RotateCw className="w-4 h-4" />
                محاولة بطاقة أخرى
              </Button>
            </CardContent>
          </Card>
        )}

        {state === "error" && (
          <Card className="border-destructive/50">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-2">
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <CardTitle className="text-destructive">فشلت العملية</CardTitle>
              <CardDescription>{error || "حدث خطأ غير متوقع"}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleReset} variant="outline" className="w-full gap-2" data-testid="button-retry">
                <RotateCw className="w-4 h-4" />
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
