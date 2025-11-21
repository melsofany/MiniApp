import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Filter } from "lucide-react";
import type { NationalIdCard } from "@shared/schema";

const centerBadgeColors = {
  "طما": "bg-chart-1 text-white hover:bg-chart-1",
  "طهطا": "bg-chart-2 text-white hover:bg-chart-2",
  "جهينة": "bg-chart-3 text-white hover:bg-chart-3",
} as const;

export default function Cards() {
  const [searchQuery, setSearchQuery] = useState("");
  const [centerFilter, setCenterFilter] = useState<string>("all");

  const { data: cards, isLoading } = useQuery<NationalIdCard[]>({
    queryKey: ["/api/cards"],
  });

  const filteredCards = cards?.filter((card) => {
    const matchesSearch = 
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.nationalId.includes(searchQuery) ||
      card.insertedByUsername.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCenter = centerFilter === "all" || card.center === centerFilter;
    
    return matchesSearch && matchesCenter;
  }) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">سجل البطاقات</h1>
        <p className="text-muted-foreground">جميع البطاقات المسجلة في النظام</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>فلترة البطاقات</CardTitle>
          <CardDescription>ابحث وفلتر البطاقات حسب المركز</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم، الرقم القومي، أو اسم المندوب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search"
              />
            </div>
            <div className="w-full md:w-48 relative">
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Select value={centerFilter} onValueChange={setCenterFilter}>
                <SelectTrigger className="pr-10" data-testid="select-center-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المراكز</SelectItem>
                  <SelectItem value="طما">طما</SelectItem>
                  <SelectItem value="طهطا">طهطا</SelectItem>
                  <SelectItem value="جهينة">جهينة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قائمة البطاقات</CardTitle>
          <CardDescription>
            عرض {filteredCards.length} من {cards?.length || 0} بطاقة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الرقم القومي</TableHead>
                  <TableHead className="text-right">المُدخِل</TableHead>
                  <TableHead className="text-right">User ID</TableHead>
                  <TableHead className="text-right">المركز</TableHead>
                  <TableHead className="text-right">تاريخ الإدخال</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery || centerFilter !== "all" 
                        ? "لا توجد نتائج تطابق البحث" 
                        : "لا توجد بطاقات مسجلة"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <TableRow key={card.nationalId} data-testid={`row-card-${card.nationalId}`}>
                      <TableCell className="font-medium">{card.name}</TableCell>
                      <TableCell className="font-mono text-sm">{card.nationalId}</TableCell>
                      <TableCell>{card.insertedByUsername}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {card.insertedByUserId}
                      </TableCell>
                      <TableCell>
                        <Badge className={centerBadgeColors[card.center]}>
                          {card.center}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(card.insertionDate).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
