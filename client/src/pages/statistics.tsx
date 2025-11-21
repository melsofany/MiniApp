import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { DailyStats, CenterStats } from "@shared/schema";
import { TrendingUp, Calendar } from "lucide-react";

export default function Statistics() {
  const { data: dailyStats, isLoading: isDailyLoading } = useQuery<DailyStats[]>({
    queryKey: ["/api/stats/daily"],
  });

  const { data: centerStats, isLoading: isCenterLoading } = useQuery<CenterStats[]>({
    queryKey: ["/api/stats/centers"],
  });

  const chartData = dailyStats?.slice(-7).map(stat => ({
    date: new Date(stat.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
    طما: stat.طما,
    طهطا: stat.طهطا,
    جهينة: stat.جهينة,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">الإحصائيات</h1>
        <p className="text-muted-foreground">تحليل أداء المراكز والعمليات اليومية</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {isCenterLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          centerStats?.map((stat) => (
            <Card key={stat.center} className="hover-elevate">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{stat.center}</CardTitle>
                <CardDescription>إحصائيات المركز</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">إجمالي البطاقات</span>
                  <span className="text-2xl font-bold">{stat.totalCards.toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">بطاقات اليوم</span>
                  <span className="text-lg font-semibold text-primary">{stat.todayCards.toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">المندوبين</span>
                  <span className="text-lg font-semibold">{stat.activeRepresentatives.toLocaleString('ar-EG')}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                العمليات اليومية حسب المراكز
              </CardTitle>
              <CardDescription className="mt-1">آخر 7 أيام</CardDescription>
            </div>
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          {isDailyLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : chartData.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              لا توجد بيانات لعرضها
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.5rem',
                    direction: 'rtl'
                  }}
                />
                <Legend 
                  wrapperStyle={{ direction: 'rtl' }}
                />
                <Bar dataKey="طما" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="طهطا" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="جهينة" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
