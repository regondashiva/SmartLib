import { useState } from "react";
import { Link } from "react-router-dom";
import {
  UserCog,
  UserPlus,
  Shield,
  CheckCircle2,
  Lock,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

interface StaffAccount {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "LIBRARIAN" | "STAFF" | "VIEWER";
  status: "ACTIVE" | "SUSPENDED";
  lastLogin: string;
}

const INITIAL_USERS: StaffAccount[] = [
  {
    id: "usr_admin_01",
    name: "System Administrator",
    email: "admin@smartlib.ac.in",
    role: "ADMIN",
    status: "ACTIVE",
    lastLogin: "Just now",
  },
  {
    id: "usr_lib_01",
    name: "Chief Librarian",
    email: "librarian@smartlib.ac.in",
    role: "LIBRARIAN",
    status: "ACTIVE",
    lastLogin: "2 hours ago",
  },
  {
    id: "usr_staff_01",
    name: "Circulation Staff Desk 1",
    email: "circ1@smartlib.ac.in",
    role: "STAFF",
    status: "ACTIVE",
    lastLogin: "Yesterday",
  },
];

const RBAC_MATRIX = [
  { module: "Dashboard & Analytics", admin: true, librarian: true, staff: true, viewer: true },
  { module: "Book Catalog & Cataloguing", admin: true, librarian: true, staff: false, viewer: false },
  { module: "Acquisitions & Serials (ISSN)", admin: true, librarian: true, staff: false, viewer: false },
  { module: "Member Management & Circulation", admin: true, librarian: true, staff: true, viewer: false },
  { module: "RFID Tagging, Inventory & Gate", admin: true, librarian: true, staff: true, viewer: false },
  { module: "Enterprise Data Migration", admin: true, librarian: true, staff: false, viewer: false },
  { module: "System Settings & Policies", admin: true, librarian: false, staff: false, viewer: false },
  { module: "User, Role & Audit Administration", admin: true, librarian: false, staff: false, viewer: false },
];

export default function UserManagementPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<StaffAccount[]>(INITIAL_USERS);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffAccount | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    role: "LIBRARIAN" as StaffAccount["role"],
    status: "ACTIVE" as StaffAccount["status"],
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormState({ name: "", email: "", role: "LIBRARIAN", status: "ACTIVE" });
    setShowModal(true);
  };

  const openEditModal = (target: StaffAccount) => {
    setEditingUser(target);
    setFormState({
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.status,
    });
    setShowModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.email.trim()) return;
    if (editingUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, ...formState } : u
        )
      );
    } else {
      setUsers((prev) => [
        ...prev,
        {
          id: `usr_${Date.now().toString().slice(-5)}`,
          name: formState.name.trim(),
          email: formState.email.trim(),
          role: formState.role,
          status: formState.status,
          lastLogin: "Never",
        },
      ]);
    }
    setShowModal(false);
  };

  const filteredUsers = users.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="User & Role Management (RBAC)"
        description="Manage institutional staff credentials, role assignments, account status, and fine-grained access control matrices"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "User & Role Management" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/roles">
                <Lock className="size-3.5" />
                Full RBAC Matrix
              </Link>
            </Button>
            <Button size="sm" onClick={openCreateModal}>
              <UserPlus className="size-4" />
              Create Staff User
            </Button>
          </div>
        }
      />

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Staff Accounts"
          value={users.length}
          icon={UserCog}
          variant="default"
        />
        <StatCard
          label="Active Operators"
          value={users.filter((u) => u.status === "ACTIVE").length}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="System Administrators"
          value={users.filter((u) => u.role === "ADMIN").length}
          icon={Shield}
          variant="indigo"
        />
        <StatCard
          label="RBAC Roles Enforced"
          value="4 Tiers"
          icon={Lock}
          variant="rfid"
        />
      </div>

      {/* Staff Accounts Table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-base font-bold text-[#0F172A]">
                System Operator Accounts
              </CardTitle>
              <CardDescription>
                Staff accounts authorized to operate SmartLib administration and circulation desks
              </CardDescription>
            </div>
            <Input
              placeholder="Search staff by name, email or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap pl-5">User ID</TableHead>
                  <TableHead className="whitespace-nowrap">Full Name</TableHead>
                  <TableHead className="whitespace-nowrap">Email Address</TableHead>
                  <TableHead className="whitespace-nowrap">Assigned Role</TableHead>
                  <TableHead className="whitespace-nowrap">Account Status</TableHead>
                  <TableHead className="whitespace-nowrap">Last Active</TableHead>
                  <TableHead className="whitespace-nowrap pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="identifier text-xs text-[#2563EB] whitespace-nowrap pl-5">{u.id}</TableCell>
                    <TableCell className="font-bold text-[#0F172A] min-w-[160px]">
                      {u.name}
                      {user?.email === u.email && (
                        <Badge variant="default" className="ml-2 text-[10px] whitespace-nowrap">
                          Current Session
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 min-w-[180px]">{u.email}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={u.status === "ACTIVE" ? "success" : "destructive"}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">{u.lastLogin}</TableCell>
                    <TableCell className="whitespace-nowrap pr-5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(u)}
                      >
                        <Edit3 className="size-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Permission Overview Matrix */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#0F172A]">
                Role & Permission Access Matrix
              </CardTitle>
              <CardDescription>
                JWT middleware and route-level RBAC enforcement across institutional roles
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 whitespace-nowrap">JWT RBAC Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap pl-5">Functional Module</TableHead>
                  <TableHead className="whitespace-nowrap text-center font-bold text-[#2563EB]">ADMIN</TableHead>
                  <TableHead className="whitespace-nowrap text-center font-bold">LIBRARIAN</TableHead>
                  <TableHead className="whitespace-nowrap text-center font-bold">STAFF</TableHead>
                  <TableHead className="whitespace-nowrap pr-5 text-center font-bold text-slate-500">VIEWER</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RBAC_MATRIX.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-semibold text-[#0F172A] whitespace-nowrap pl-5">{row.module}</TableCell>
                    <TableCell className="text-center">
                      {row.admin ? (
                        <Check className="mx-auto size-4 text-[#16A34A]" />
                      ) : (
                        <X className="mx-auto size-4 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.librarian ? (
                        <Check className="mx-auto size-4 text-[#16A34A]" />
                      ) : (
                        <X className="mx-auto size-4 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.staff ? (
                        <Check className="mx-auto size-4 text-[#16A34A]" />
                      ) : (
                        <X className="mx-auto size-4 text-slate-300" />
                      )}
                    </TableCell>
                    <TableCell className="text-center pr-5">
                      {row.viewer ? (
                        <Check className="mx-auto size-4 text-[#16A34A]" />
                      ) : (
                        <X className="mx-auto size-4 text-slate-300" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader>
              <CardTitle>
                {editingUser ? "Edit Staff Account" : "Create Staff Account"}
              </CardTitle>
              <CardDescription>
                Assign institutional credentials, role tier, and account status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Full Name *
                  </label>
                  <Input
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Dr. Priya Sharma"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Institutional Email *
                  </label>
                  <Input
                    required
                    type="email"
                    value={formState.email}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="e.g. priya.sharma@smartlib.ac.in"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Assigned Role
                    </label>
                    <select
                      value={formState.role}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          role: e.target.value as StaffAccount["role"],
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#0F172A]"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="LIBRARIAN">LIBRARIAN</option>
                      <option value="STAFF">STAFF</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">
                      Account Status
                    </label>
                    <select
                      value={formState.status}
                      onChange={(e) =>
                        setFormState((prev) => ({
                          ...prev,
                          status: e.target.value as StaffAccount["status"],
                        }))
                      }
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#0F172A]"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingUser ? "Save Changes" : "Create Account"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
