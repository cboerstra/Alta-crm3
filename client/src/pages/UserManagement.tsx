import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  MoreHorizontal,
  UserCog,
  Clock,
  Mail,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Link,
  AlertCircle,
  CalendarDays,
  Pencil,
  Phone,
  KeyRound,
} from "lucide-react";

type EditForm = {
  userId: number;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "user";
  newPassword: string;
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");

  // Invite dialog state
  const [inviteDialog, setInviteDialog] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "user" as "admin" | "user" });
  const [inviteResult, setInviteResult] = useState<{ token: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState(false);

  // Edit user dialog state
  const [editDialog, setEditDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    userId: 0, name: "", email: "", phone: "", role: "user", newPassword: "",
  });

  // Confirm dialogs
  const [confirmRole, setConfirmRole] = useState<{
    open: boolean; userId: number; userName: string; newRole: "admin" | "user";
  }>({ open: false, userId: 0, userName: "", newRole: "user" });
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean; userId: number; userName: string;
  }>({ open: false, userId: 0, userName: "" });
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState<{
    open: boolean; inviteId: number; inviteEmail: string;
  }>({ open: false, inviteId: 0, inviteEmail: "" });

  const utils = trpc.useUtils();

  const { data: usersList, isLoading } = trpc.userManagement.list.useQuery({
    search: search || undefined,
    role: roleFilter,
  });
  const { data: stats } = trpc.userManagement.stats.useQuery();
  const { data: invites, isLoading: invitesLoading } = trpc.userManagement.listInvites.useQuery();

  const updateRole = trpc.userManagement.updateRole.useMutation({
    onSuccess: () => {
      utils.userManagement.list.invalidate();
      utils.userManagement.stats.invalidate();
      toast.success("User role updated successfully");
    },
    onError: (err) => toast.error(err.message || "Failed to update role"),
  });

  const updateUser = trpc.userManagement.updateUser.useMutation({
    onSuccess: () => {
      utils.userManagement.list.invalidate();
      utils.userManagement.stats.invalidate();
      setEditDialog(false);
      toast.success("User updated successfully");
    },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });

  const deleteUser = trpc.userManagement.deleteUser.useMutation({
    onSuccess: () => {
      utils.userManagement.list.invalidate();
      utils.userManagement.stats.invalidate();
      toast.success("User removed from the system");
    },
    onError: (err) => toast.error(err.message || "Failed to remove user"),
  });

  const createInvite = trpc.userManagement.createInvite.useMutation({
    onSuccess: (data) => {
      setInviteResult(data);
      utils.userManagement.listInvites.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create invite"),
  });

  const revokeInvite = trpc.userManagement.deleteInvite.useMutation({
    onSuccess: () => {
      utils.userManagement.listInvites.invalidate();
      toast.success("Invite deleted");
    },
    onError: (err) => toast.error(err.message || "Failed to delete invite"),
  });

  const handleCreateInvite = () => {
    if (!inviteForm.name.trim()) { toast.error("Name is required"); return; }
    if (!inviteForm.email.trim()) { toast.error("Email is required"); return; }
    createInvite.mutate(inviteForm);
  };

  const handleCopyInviteLink = (token: string) => {
    const link = `${window.location.origin}/?invite=${token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Invite link copied to clipboard");
    });
  };

  const handleCloseInviteDialog = () => {
    setInviteDialog(false);
    setInviteResult(null);
    setInviteForm({ name: "", email: "", role: "user" });
    setCopied(false);
  };

  const openEditDialog = (u: NonNullable<typeof usersList>[number]) => {
    setEditForm({
      userId: u.id,
      name: u.name || "",
      email: u.email || "",
      phone: (u as any).phone || "",
      role: u.role as "admin" | "user",
      newPassword: "",
    });
    setEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.name.trim()) { toast.error("Name is required"); return; }
    if (!editForm.email.trim()) { toast.error("Email is required"); return; }
    updateUser.mutate({
      userId: editForm.userId,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      phone: editForm.phone.trim() || undefined,
      role: editForm.role,
      newPassword: editForm.newPassword || undefined,
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  };

  const isExpired = (date: Date | string) => new Date(date) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "Raleway, sans-serif" }}>
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage team access, assign roles, and invite new employees
          </p>
        </div>
        <Button
          onClick={() => setInviteDialog(true)}
          className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Employee
        </Button>
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

      {/* Tabs: Active Users & Pending Invites */}
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Active Users
            {usersList && <Badge variant="secondary" className="ml-1 text-xs">{usersList.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Link className="h-4 w-4" />
            Pending Invites
            {invites && invites.filter(i => !i.acceptedAt && !isExpired(i.expiresAt)).length > 0 && (
              <Badge className="ml-1 text-xs bg-brand-gold/20 text-brand-gold-dark border-brand-gold/30">
                {invites.filter(i => !i.acceptedAt && !isExpired(i.expiresAt)).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Active Users Tab */}
        <TabsContent value="users">
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
                        <TableHead>Phone</TableHead>
                        <TableHead>Role</TableHead>
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
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                {u.email || "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                {(u as any).phone || "—"}
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
                                {formatDateTime(u.lastSignedIn)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex items-center justify-end gap-1">
                                {/* Always-visible Edit button */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                                  onClick={() => openEditDialog(u)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </Button>
                                {/* More actions dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    {u.role === "user" ? (
                                      <DropdownMenuItem
                                        onClick={() => setConfirmRole({ open: true, userId: u.id, userName: u.name || "this user", newRole: "admin" })}
                                        className="gap-2"
                                      >
                                        <ShieldCheck className="h-4 w-4 text-brand-gold" />
                                        Promote to Admin
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => !isCurrentUser && setConfirmRole({ open: true, userId: u.id, userName: u.name || "this user", newRole: "user" })}
                                        disabled={isCurrentUser}
                                        className="gap-2"
                                      >
                                        <Shield className="h-4 w-4 text-blue-500" />
                                        Demote to User
                                      </DropdownMenuItem>
                                    )}
                                    {!isCurrentUser && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => setConfirmDelete({ open: true, userId: u.id, userName: u.name || "this user" })}
                                          className="gap-2 text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          Remove User
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
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

          {/* Role Permissions Legend */}
          <Card className="mt-4 bg-muted/30 border-dashed">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Role Permissions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-brand-gold" />
                    <span className="font-semibold text-foreground">Admin</span>
                  </div>
                  <ul className="text-muted-foreground space-y-1 text-xs ml-6">
                    <li>• Full CRM access (leads, webinars, deals)</li>
                    <li>• Manage users and assign roles</li>
                    <li>• Configure integrations and settings</li>
                    <li>• Access revenue and analytics dashboards</li>
                    <li>• Manage media library and landing pages</li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-foreground">User</span>
                  </div>
                  <ul className="text-muted-foreground space-y-1 text-xs ml-6">
                    <li>• View and manage leads and pipeline</li>
                    <li>• Create and manage webinars</li>
                    <li>• Access scheduling and deals</li>
                    <li>• View analytics dashboard</li>
                    <li>• No access to settings or user management</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Invites Tab */}
        <TabsContent value="invites">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link className="h-5 w-5 text-brand-green" />
                  Pending Invites
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setInviteDialog(true)}
                  className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  New Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {invitesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
                </div>
              ) : !invites?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Link className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No pending invites</p>
                  <p className="text-xs mt-1">Click "Add Employee" to invite team members</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6">Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((inv) => {
                        const expired = isExpired(inv.expiresAt);
                        const accepted = !!inv.acceptedAt;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="pl-6 font-medium text-sm">{inv.name || "—"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Mail className="h-3.5 w-3.5" />
                                {inv.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              {inv.role === "admin" ? (
                                <Badge className="bg-brand-gold/15 text-brand-gold-dark border-brand-gold/30">
                                  <ShieldCheck className="h-3 w-3 mr-1" />Admin
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-muted-foreground">
                                  <Shield className="h-3 w-3 mr-1" />User
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {accepted ? (
                                <Badge className="bg-green-100 text-green-700 border-green-200">
                                  <Check className="h-3 w-3 mr-1" />Accepted
                                </Badge>
                              ) : expired ? (
                                <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                                  <AlertCircle className="h-3 w-3 mr-1" />Expired
                                </Badge>
                              ) : (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                  <Clock className="h-3 w-3 mr-1" />Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDate(inv.expiresAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">{formatDate(inv.createdAt)}</span>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              {/* Always-visible action buttons — no hover required */}
                              <div className="flex items-center justify-end gap-2">
                                {!accepted && !expired && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => handleCopyInviteLink(inv.token)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Copy Link
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setConfirmRevokeInvite({ open: true, inviteId: inv.id, inviteEmail: inv.email })}
                                  title="Delete invitation"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
        </TabsContent>
      </Tabs>

      {/* ── Edit User Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brand-green" />
              Edit Team Member
            </DialogTitle>
            <DialogDescription>
              Update profile information. Leave the password field blank to keep the existing password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="e.g. Jane Smith"
                value={editForm.name}
                onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-email"
                type="email"
                placeholder="e.g. jane@clarkeassociates.com"
                value={editForm.email}
                onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone" className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone Number
                <span className="text-xs text-muted-foreground font-normal">(used for admin SMS alerts)</span>
              </Label>
              <Input
                id="edit-phone"
                type="tel"
                placeholder="e.g. +1 801 555 0100"
                value={editForm.phone}
                onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Access Level</Label>
              <Select
                value={editForm.role}
                onValueChange={(v) => setEditForm(f => ({ ...f, role: v as "admin" | "user" }))}
                disabled={editForm.userId === currentUser?.id}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      User
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-brand-gold" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {editForm.userId === currentUser?.id && (
                <p className="text-xs text-muted-foreground">You cannot change your own role.</p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-password" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                New Password
                <span className="text-xs text-muted-foreground font-normal">(leave blank to keep current)</span>
              </Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Min. 6 characters"
                value={editForm.newPassword}
                onChange={(e) => setEditForm(f => ({ ...f, newPassword: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateUser.isPending}
              className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
            >
              {updateUser.isPending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Employee / Create Invite Dialog ─────────────────────────────── */}
      <Dialog open={inviteDialog} onOpenChange={(open) => { if (!open) handleCloseInviteDialog(); else setInviteDialog(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-green" />
              Add Employee
            </DialogTitle>
            <DialogDescription>
              {inviteResult
                ? "Invite created successfully. Share this link with the employee."
                : "Create an invite link for a new team member. The link expires in 7 days."}
            </DialogDescription>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-semibold">Invite Created!</span>
                </div>
                <p className="text-xs text-green-600">
                  Share this link with the employee. They'll be automatically added to the CRM when they sign in.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Invite Link</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                    {`${window.location.origin}/?invite=${inviteResult.token}`}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => handleCopyInviteLink(inviteResult.token)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Expires: {new Date(inviteResult.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <DialogFooter>
                <Button onClick={handleCloseInviteDialog} className="w-full bg-brand-green hover:bg-brand-green-dark text-white">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invite-name"
                  placeholder="e.g. Jane Smith"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="e.g. jane@clarkeassociates.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Access Level</Label>
                <Select value={inviteForm.role} onValueChange={(v) => setInviteForm(f => ({ ...f, role: v as "admin" | "user" }))}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="font-medium">User</p>
                          <p className="text-xs text-muted-foreground">Can manage leads, webinars, and deals</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-brand-gold" />
                        <div>
                          <p className="font-medium">Admin</p>
                          <p className="text-xs text-muted-foreground">Full access including settings and user management</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                <p className="font-semibold mb-1">How it works:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>You'll receive an invite link after clicking "Create Invite"</li>
                  <li>Share the link with the employee via email or message</li>
                  <li>When they click the link and sign in, they're automatically added with the assigned role</li>
                </ol>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseInviteDialog}>Cancel</Button>
                <Button
                  onClick={handleCreateInvite}
                  disabled={createInvite.isPending}
                  className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
                >
                  {createInvite.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Create Invite
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm Role Change ──────────────────────────────────────────────── */}
      <AlertDialog open={confirmRole.open} onOpenChange={(open) => !open && setConfirmRole(p => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmRole.newRole === "admin" ? "promote" : "demote"}{" "}
              <strong>{confirmRole.userName}</strong> to{" "}
              <strong>{confirmRole.newRole === "admin" ? "Admin" : "User"}</strong>?
              {confirmRole.newRole === "admin" && " They will gain access to Settings and User Management."}
              {confirmRole.newRole === "user" && " They will lose access to Settings and User Management."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                updateRole.mutate({ userId: confirmRole.userId, role: confirmRole.newRole });
                setConfirmRole(p => ({ ...p, open: false }));
              }}
              className="bg-brand-green hover:bg-brand-green-dark text-white"
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Delete User ──────────────────────────────────────────────── */}
      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => !open && setConfirmDelete(p => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Remove User
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{confirmDelete.userName}</strong> from the CRM?
              They will lose all access immediately. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteUser.mutate({ userId: confirmDelete.userId });
                setConfirmDelete(p => ({ ...p, open: false }));
              }}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm Delete Invite ────────────────────────────────────────────── */}
      <AlertDialog open={confirmRevokeInvite.open} onOpenChange={(open) => !open && setConfirmRevokeInvite(p => ({ ...p, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Invitation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the invitation for <strong>{confirmRevokeInvite.inviteEmail}</strong>?
              The invite link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                revokeInvite.mutate({ inviteId: confirmRevokeInvite.inviteId });
                setConfirmRevokeInvite(p => ({ ...p, open: false }));
              }}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Delete Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
