import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Representative, InsertRepresentative } from "@shared/schema";

const centerBadgeColors = {
  "طما": "bg-chart-1 text-white hover:bg-chart-1",
  "طهطا": "bg-chart-2 text-white hover:bg-chart-2",
  "جهينة": "bg-chart-3 text-white hover:bg-chart-3",
} as const;

export default function Representatives() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InsertRepresentative>({
    userId: "",
    username: "",
    center: "طما",
    status: "نشط",
  });
  const { toast } = useToast();

  const { data: representatives, isLoading } = useQuery<Representative[]>({
    queryKey: ["/api/representatives"],
  });

  const addMutation = useMutation({
    mutationFn: (data: InsertRepresentative) =>
      apiRequest<Representative>("POST", "/api/representatives", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setIsDialogOpen(false);
      setFormData({ userId: "", username: "", center: "طما", status: "نشط" });
      toast({
        title: "تم إضافة المندوب بنجاح",
        description: "يمكن للمندوب الآن استخدام البوت",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "فشل إضافة المندوب",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("DELETE", `/api/representatives/${userId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "تم حذف المندوب",
        description: "لم يعد بإمكان هذا المستخدم استخدام البوت",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">إدارة المندوبين</h1>
          <p className="text-muted-foreground">إضافة وإدارة المندوبين المصرح لهم</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-representative">
              <Plus className="w-4 h-4" />
              إضافة مندوب
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة مندوب جديد</DialogTitle>
              <DialogDescription>
                أدخل بيانات المندوب وحدد المركز التابع له
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  placeholder="مثال: 123456789"
                  required
                  data-testid="input-user-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">اسم المستخدم</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="مثال: ahmed_ali"
                  required
                  data-testid="input-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="center">المركز</Label>
                <Select
                  value={formData.center}
                  onValueChange={(value) => setFormData({ ...formData, center: value as "طما" | "طهطا" | "جهينة" })}
                >
                  <SelectTrigger id="center" data-testid="select-center">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="طما">طما</SelectItem>
                    <SelectItem value="طهطا">طهطا</SelectItem>
                    <SelectItem value="جهينة">جهينة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">الحالة</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as "نشط" | "غير نشط" })}
                >
                  <SelectTrigger id="status" data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="نشط">نشط</SelectItem>
                    <SelectItem value="غير نشط">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={addMutation.isPending}
                  data-testid="button-submit"
                >
                  {addMutation.isPending ? "جاري الإضافة..." : "إضافة"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة المندوبين</CardTitle>
          <CardDescription>
            إجمالي {representatives?.length || 0} مندوب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">User ID</TableHead>
                  <TableHead className="text-right">اسم المستخدم</TableHead>
                  <TableHead className="text-right">المركز</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                ) : representatives?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد بيانات. قم بإضافة مندوب جديد للبدء
                    </TableCell>
                  </TableRow>
                ) : (
                  representatives?.map((rep) => (
                    <TableRow key={rep.userId} data-testid={`row-representative-${rep.userId}`}>
                      <TableCell className="font-mono">{rep.userId}</TableCell>
                      <TableCell className="font-medium">{rep.username}</TableCell>
                      <TableCell>
                        <Badge className={centerBadgeColors[rep.center]}>
                          {rep.center}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rep.status === "نشط" ? "default" : "secondary"} className="gap-1">
                          {rep.status === "نشط" ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {rep.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(rep.dateAdded).toLocaleDateString('ar-EG')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(rep.userId)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${rep.userId}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
