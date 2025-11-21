import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, TrendingUp, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CenterStats } from "@shared/schema";

const centerColors = {
  "طما": "bg-chart-1 text-white",
  "طهطا": "bg-chart-2 text-white",
  "جهينة": "bg-chart-3 text-white",
} as const;

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<CenterStats[]>({
    queryKey: ["/api/stats/centers"],
  });

  const totalCards = stats?.reduce((acc, stat) => acc + stat.totalCards, 0) || 0;
  const totalRepresentatives = stats?.reduce((acc, stat) => acc + stat.activeRepresentatives, 0) || 0;
  const todayCards = stats?.reduce((acc, stat) => acc + stat.todayCards, 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">لوحة المعلومات</h1>
        <p className="text-muted-foreground">نظرة عامة على إحصائيات النظام</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي البطاقات</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-cards">{totalCards.toLocaleString('ar-EG')}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">جميع البطاقات المسجلة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المندوبين النشطين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-representatives">{totalRepresentatives.toLocaleString('ar-EG')}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">في جميع المراكز</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">بطاقات اليوم</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-today-cards">{todayCards.toLocaleString('ar-EG')}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">تم إدخالها اليوم</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">إحصائيات المراكز</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-20" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            stats?.map((stat) => (
              <Card key={stat.center} className="hover-elevate">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    {stat.center}
                  </CardTitle>
                  <Badge className={centerColors[stat.center]}>{stat.center}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold" data-testid={`text-center-${stat.center}-total`}>
                      {stat.totalCards.toLocaleString('ar-EG')}
                    </div>
                    <p className="text-sm text-muted-foreground">إجمالي البطاقات</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">اليوم:</span>
                    <span className="font-semibold" data-testid={`text-center-${stat.center}-today`}>
                      {stat.todayCards.toLocaleString('ar-EG')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">المندوبين:</span>
                    <span className="font-semibold" data-testid={`text-center-${stat.center}-reps`}>
                      {stat.activeRepresentatives.toLocaleString('ar-EG')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
