import { LayoutDashboard, Users, BarChart3, FileText, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  {
    title: "لوحة المعلومات",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "إدارة المندوبين",
    url: "/dashboard/representatives",
    icon: Users,
  },
  {
    title: "الإحصائيات",
    url: "/dashboard/statistics",
    icon: BarChart3,
  },
  {
    title: "سجل البطاقات",
    url: "/dashboard/cards",
    icon: FileText,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
      toast({
        title: "تم تسجيل الخروج",
        description: "نراك قريباً",
      });
      setLocation("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-bold text-lg">نظام البطاقات</h2>
            <p className="text-xs text-muted-foreground">لوحة التحكم</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs px-4">القوائم الرئيسية</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.url.split('/').pop()}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleLogout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
