import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  UserCog,
  Clock,
  Mail,
} from "lucide-react";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: number;
    userName: string;
    newRole: "admin" | "user";
  }>({ open: false, userId: 0, userName: "", newRole: "user" });

  const utils = trpc.useUtils();

  const { data: usersList, isLoading } = trpc.userManagement.list.useQuery({
    search: search || undefined,
    role: roleFilter,
  });

  const { data: stats } = trpc.userManagement.stats.useQuery();

  const updateRole = trpc.userManagement.updateRole.useMutation({
    onSuccess: () => {
      utils.userManagement.list.invalidate();
      utils.userManagement.stats.invalidate();
      toast.success("User role updated successfully");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update role");
    },
  });

  const handleRoleChange = (userId: number, userName: string, newRole: "admin" | "user") => {
    setConfirmDialog({ open: true, userId, userName, newRole });
  };

  const confirmRoleChange = () => {
    updateRole.mutate({
      userId: confirmDialog.userId,
      role: confirmDialog.newRole,
    });
    setConfirmDialog({ open: false, userId: 0, userName: "", newRole: "user" });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "Raleway, sans-serif" }}>
          User Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage team access and assign roles to CRM users
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-brand-green/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.total ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-brand-green/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-brand-green" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-brand-gold/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admins</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.admins ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-brand-gold" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Regular Users</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats?.users ?? 0}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCog className="h-5 w-5 text-brand-green" />
              Team Members
            </CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="user">Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
            </div>
          ) : !usersList?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Role
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersList.map((u) => {
                    const isCurrentUser = u.id === currentUser?.id;
                    const initials = (u.name || "?").charAt(0).toUpperCase();
                    return (
                      <TableRow key={u.id} className="group">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-brand-green/20">
                              <AvatarFallback className="text-xs font-semibold bg-brand-green/10 text-brand-green">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm text-foreground">
                                {u.name || "Unnamed User"}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                )}
                              </p>
                              {u.loginMethod && (
                                <p className="text-xs text-muted-foreground capitalize">{u.loginMethod}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" />
                            {u.email || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge className="bg-brand-gold/15 text-brand-gold-dark border-brand-gold/30 hover:bg-brand-gold/20">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-muted-foreground">
                              <Shield className="h-3 w-3 mr-1" />
                              User
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDate(u.lastSignedIn)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(u.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {u.role === "user" ? (
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(u.id, u.name || "this user", "admin")}
                                  className="cursor-pointer"
                                >
                                  <ShieldCheck className="mr-2 h-4 w-4 text-brand-gold" />
                                  Promote to Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleRoleChange(u.id, u.name || "this user", "user")}
                                  disabled={isCurrentUser}
                                  className="cursor-pointer"
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Demote to User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                ID: {u.id} · {u.openId?.slice(0, 12)}...
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Legend */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="h-4 w-4 text-brand-gold" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Admin</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full access to all CRM features including user management, settings, integrations, and all data.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">User</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Access to leads, pipeline, webinars, deals, scheduling, and revenue. Cannot manage users or settings.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ ...confirmDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.newRole === "admin" ? "Promote to Admin?" : "Demote to User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.newRole === "admin"
                ? `This will give ${confirmDialog.userName} full admin access including user management, settings, and integrations.`
                : `This will remove admin privileges from ${confirmDialog.userName}. They will no longer be able to manage users or access settings.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleChange}
              className={
                confirmDialog.newRole === "admin"
                  ? "bg-brand-green hover:bg-brand-green-dark"
                  : "bg-destructive hover:bg-destructive/90"
              }
            >
              {confirmDialog.newRole === "admin" ? "Promote" : "Demote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
