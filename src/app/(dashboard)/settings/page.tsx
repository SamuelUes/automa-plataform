"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Cpu,
  Database,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
} from "lucide-react";

type NotificationPreferences = Record<string, boolean>;

type Section =
  | "profile"
  | "organization"
  | "users"
  | "departments"
  | "notifications"
  | "ai"
  | "automation"
  | "security";

type SettingsData = {
  profile: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
    role: string;
    settings: Record<string, unknown>;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, unknown>;
  } | null;
  departments: Array<{
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  }>;
  users: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    is_active: boolean;
  }>;
};

const fallbackData: SettingsData = {
  profile: {
    full_name: null,
    email: null,
    avatar_url: null,
    role: "agent",
    settings: {},
  },
  organization: {
    id: "demo-org",
    name: "Prologistica",
    slug: "prologistica",
    settings: {},
  },
  departments: [],
  users: [],
};

const sections: Array<{
  id: Section;
  label: string;
  icon: typeof Users;
}> = [
  { id: "profile", label: "Perfil", icon: CircleUserRound },
  { id: "organization", label: "Organización", icon: Database },
  { id: "users", label: "Usuarios y roles", icon: Users },
  { id: "departments", label: "Departamentos", icon: SlidersHorizontal },
  { id: "notifications", label: "Notificaciones", icon: Mail },
  { id: "ai", label: "Configuración de IA", icon: Cpu },
  { id: "automation", label: "Automatizaciones", icon: Workflow },
  { id: "security", label: "Seguridad", icon: ShieldCheck },
];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  const [data, setData] = useState<SettingsData>(fallbackData);
  const [profileName, setProfileName] = useState(
    fallbackData.profile.full_name || ""
  );
  const [orgName, setOrgName] = useState(
    fallbackData.organization?.name || ""
  );
  const [orgSlug, setOrgSlug] = useState(
    fallbackData.organization?.slug || ""
  );
  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    approval_required: true,
    urgent_case: true,
    workflow_failed: true,
    follow_up_due: true,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();

      if (user) {
        setProfileName(user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario");
        setData((current) => ({
          ...current,
          profile: {
            ...current.profile,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
            email: user.email || null,
          },
        }));
      }

      const { data: response } = await client.functions.invoke(
        "settings",
        {
          body: { operation: "get" },
        }
      );

      if (!response?.profile) {
        return;
      }

      const nextData = response as SettingsData;

      setData(nextData);
      setProfileName(nextData.profile.full_name || "");
      setOrgName(nextData.organization?.name || "");
      setOrgSlug(nextData.organization?.slug || "");

      const profileSettings = nextData.profile.settings;
      if (profileSettings && typeof profileSettings === "object") {
        const savedPreferences = (profileSettings as { notifications?: Record<string, boolean> }).notifications;
        if (savedPreferences) {
          setNotificationPreferences((current) => ({
            ...current,
            ...savedPreferences,
          }));
        }
      }
    })();
  }, []);

  async function save(
    operation: string,
    payload: Record<string, unknown>
  ) {
    setSaving(true);
    setMessage(null);

    const { error } = await createClient().functions.invoke("settings", {
      body: {
        operation,
        ...payload,
      },
    });

    setSaving(false);
    setMessage(
      error
        ? "No se pudo guardar la configuración."
        : "Cambios guardados correctamente."
    );
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) {
      return;
    }

    setSaving(true);
    setMessage(null);

    const { data: response, error } = await createClient().functions.invoke(
      "settings",
      {
        body: {
          operation: "invite_user",
          email: inviteEmail,
        },
      }
    );

    setSaving(false);

    if (error) {
      setMessage("No se pudo enviar la invitación.");
      return;
    }

    setData((current) => ({
      ...current,
      users: [
        ...current.users,
        {
          id: response?.user_id || `pending-${inviteEmail}`,
          full_name: null,
          email: inviteEmail,
          role: "agent",
          is_active: true,
        },
      ],
    }));
    setInviteEmail("");
    setMessage("Invitación enviada correctamente.");
  }

  async function addDepartment() {
    if (!departmentName.trim()) {
      return;
    }

    setSaving(true);

    const { data: response, error } = await createClient().functions.invoke(
      "settings",
      {
        body: {
          operation: "department",
          name: departmentName,
          description: departmentDescription,
        },
      }
    );

    setSaving(false);

    if (error) {
      setMessage("No se pudo crear el departamento.");
      return;
    }

    if (response?.department) {
      setData((current) => ({
        ...current,
        departments: [...current.departments, response.department],
      }));
    }

    setDepartmentName("");
    setDepartmentDescription("");
    setMessage("Departamento creado correctamente.");
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">
          System / Control plane
        </p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">
          Configuración
        </h1>
        <p className="text-muted-foreground mt-1.5">
          Administra tu espacio de trabajo y las reglas que protegen la operación.
        </p>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[230px_1fr]">
        <nav className="flex min-w-0 gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setMessage(null);
              }}
              className={`flex min-w-max shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors lg:w-full ${
                section === id
                  ? "bg-muted font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {section === id && <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          {section === "profile" && (
            <ProfileSection
              name={profileName}
              setName={setProfileName}
              email={data.profile.email || ""}
              role={data.profile.role}
              saving={saving}
              onSave={() =>
                void save("profile", { full_name: profileName })
              }
            />
          )}

          {section === "organization" && (
            <OrganizationSection
              name={orgName}
              setName={setOrgName}
              slug={orgSlug}
              setSlug={setOrgSlug}
              saving={saving}
              onSave={() =>
                void save("organization", {
                  name: orgName,
                  slug: orgSlug,
                  settings: data.organization?.settings || {},
                })
              }
            />
          )}

          {section === "users" && (
            <UsersSection
              users={data.users}
              onRoleChange={(userId, role) =>
                void save("user_role", {
                  user_id: userId,
                  role,
                })
              }
              inviteEmail={inviteEmail}
              setInviteEmail={setInviteEmail}
              onInvite={() => void inviteUser()}
            />
          )}

          {section === "departments" && (
            <DepartmentsSection
              departments={data.departments}
              name={departmentName}
              setName={setDepartmentName}
              description={departmentDescription}
              setDescription={setDepartmentDescription}
              saving={saving}
              onAdd={() => void addDepartment()}
            />
          )}

          {section === "notifications" && (
            <NotificationsSection
              preferences={notificationPreferences}
              setPreferences={setNotificationPreferences}
              onSave={() =>
                void save("preferences", {
                  preferences: notificationPreferences,
                })
              }
              saving={saving}
            />
          )}
          {section === "ai" && <AISection />}
          {section === "automation" && <AutomationSection />}
          {section === "security" && <SecuritySection />}

          {message && (
            <p
              role="status"
              className="flex items-center gap-2 text-xs text-success"
            >
              <Check className="h-4 w-4" />
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold tracking-tight mt-2">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function ProfileSection({
  name,
  setName,
  email,
  role,
  saving,
  onSave,
}: {
  name: string;
  setName: (value: string) => void;
  email: string;
  role: string;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="Personal"
        title="Perfil"
        description="Actualiza la información que utiliza tu equipo para identificarte."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Información personal</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="h-14 w-14 rounded-full bg-[#d7e7e2] text-[#28584e] flex items-center justify-center text-lg font-semibold">
              DG
            </div>
            <div>
              <p className="text-sm font-medium">{name || "Tu nombre"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Avatar generado a partir de tus iniciales
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full-name">Nombre completo</Label>
              <Input
                id="full-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Correo electrónico</Label>
              <Input id="profile-email" value={email} disabled />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">Rol actual</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tu rol determina las acciones disponibles.
              </p>
            </div>
            <Badge variant="info">{role}</Badge>
          </div>

          <Button onClick={onSave} disabled={saving} className="w-full sm:w-fit">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar cambios
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function OrganizationSection({
  name,
  setName,
  slug,
  setSlug,
  saving,
  onSave,
}: {
  name: string;
  setName: (value: string) => void;
  slug: string;
  setSlug: (value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="Workspace"
        title="Organización"
        description="Define la identidad y el espacio de trabajo de tu equipo."
      />

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nombre de la organización</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
            />
            <p className="text-[11px] text-muted-foreground">
              Solo letras minúsculas, números y guiones.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
            <Database className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs font-medium">Multi-tenant activo</p>
              <p className="text-xs text-muted-foreground mt-1">
                Los datos están aislados por organización mediante RLS de Supabase.
              </p>
            </div>
          </div>

          <Button onClick={onSave} disabled={saving} className="w-full sm:w-fit">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar organización
          </Button>
        </CardContent>
      </Card>
    </>
  );
}

function UsersSection({
  users,
  onRoleChange,
  inviteEmail,
  setInviteEmail,
  onInvite,
}: {
  users: SettingsData["users"];
  onRoleChange: (userId: string, role: string) => void;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  onInvite: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="Access control"
        title="Usuarios y roles"
        description="Administra el acceso de los miembros de tu organización."
      />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center px-5 py-4"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0">
                  {(user.full_name || "?")
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.full_name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>

                <Badge variant={user.is_active ? "success" : "secondary"}>
                  {user.is_active ? "Activo" : "Inactivo"}
                </Badge>

                <select
                  aria-label={`Rol de ${user.full_name}`}
                  defaultValue={user.role}
                  onChange={(event) =>
                    onRoleChange(user.id, event.target.value)
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-xs sm:w-auto"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="agent">Agent</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            ))}
          </div>

          <div className="p-5 border-t space-y-3">
            <p className="text-xs font-semibold">Invitar usuario</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="correo@empresa.com"
              />
              <Button
                variant="outline"
                onClick={onInvite}
                disabled={!inviteEmail.trim()}
              >
                <Plus />
                Enviar invitación
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function DepartmentsSection({
  departments,
  name,
  setName,
  description,
  setDescription,
  saving,
  onAdd,
}: {
  departments: SettingsData["departments"];
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  saving: boolean;
  onAdd: () => void;
}) {
  return (
    <>
      <SectionHeading
        eyebrow="Workspace"
        title="Departamentos"
        description="Organiza los casos por equipos y responsabilidades."
      />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {departments.map((department) => (
              <div
                key={department.id}
                className="flex flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{department.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {department.description || "Sin descripción"}
                  </p>
                </div>

                <Badge
                  variant={department.is_active ? "success" : "secondary"}
                >
                  {department.is_active ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            ))}
          </div>

          <div className="border-t p-5 space-y-4">
            <p className="text-xs font-semibold">Nuevo departamento</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre"
              />
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción"
              />
            </div>

            <Button className="w-full sm:w-fit" onClick={onAdd} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Añadir departamento
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function NotificationsSection({
  preferences,
  setPreferences,
  onSave,
  saving,
}: {
  preferences: Record<string, boolean>;
  setPreferences: (preferences: Record<string, boolean>) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const notifications = [
    [
      "approval_required",
      "Aprobaciones requeridas",
      "Cuando un agente necesita una decisión humana.",
    ],
    [
      "urgent_case",
      "Casos urgentes",
      "Cuando un caso es clasificado como urgente o crítico.",
    ],
    [
      "workflow_failed",
      "Workflow fallido",
      "Cuando una automatización no puede completar su ejecución.",
    ],
    [
      "follow_up_due",
      "Seguimientos vencidos",
      "Cuando una fecha de seguimiento ha pasado.",
    ],
  ];

  return (
    <>
      <SectionHeading
        eyebrow="Preferences"
        title="Notificaciones"
        description="Controla qué eventos requieren tu atención inmediata."
      />

      <Card>
        <CardContent className="divide-y p-0">
          {notifications.map(([key, title, description]) => (
            <label key={key} className="flex items-center gap-4 px-5 py-4 cursor-pointer">
              <div className="flex-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(preferences[key])}
                onChange={(event) =>
                  setPreferences({
                    ...preferences,
                    [key]: event.target.checked,
                  })
                }
                className="h-4 w-4 accent-foreground"
                aria-label={title}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Button onClick={onSave} disabled={saving} className="mt-4 w-full sm:w-fit">
        {saving ? <Loader2 className="animate-spin" /> : <Save />}
        Guardar preferencias
      </Button>
    </>
  );
}

function AISection() {
  return (
    <>
      <SectionHeading
        eyebrow="Intelligence layer"
        title="Configuración de IA"
        description="La IA se ejecuta de forma segura a través de n8n y Edge Functions."
      />

      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#d7e7e2] text-[#28584e] flex items-center justify-center">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium">OpenAI</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Proveedor conectado mediante n8n
                </p>
              </div>
            </div>

            <Badge variant="success">
              <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5" />
              Conectado
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <select
              defaultValue="gpt-4o-mini"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="gpt-4o-mini">GPT-4o mini</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 flex gap-3">
            <KeyRound className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              La API key está almacenada en las credenciales seguras de n8n.
              Nunca se transmite al navegador ni se muestra en esta interfaz.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function AutomationSection() {
  const settings = [
    [
      "Ejecución de workflows",
      "Las acciones pendientes se envían a n8n automáticamente.",
    ],
    [
      "Reintentos de entrega",
      "PE10 reintenta entregas fallidas según la política configurada.",
    ],
    [
      "Registro de ejecuciones",
      "Cada ejecución se persiste en workflow_executions.",
    ],
  ];

  return (
    <>
      <SectionHeading
        eyebrow="Orchestration"
        title="Configuración de automatizaciones"
        description="Controla cómo se comunican Supabase, n8n y tus workflows."
      />

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {settings.map(([title, description]) => (
            <div
              key={title}
              className="flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {description}
                </p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 accent-foreground"
                aria-label={title}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function SecuritySection() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  async function changePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }

    setChangingPassword(true);

    const { error: updateError } = await createClient().auth.updateUser({
      password: newPassword,
    });

    setChangingPassword(false);

    if (updateError) {
      setPasswordError(updateError.message);
      return;
    }

    setPasswordSuccess(true);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <>
      <SectionHeading
        eyebrow="Protection"
        title="Seguridad"
        description="Revisa las capas que protegen tu organización y tus datos."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cambiar contraseña</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva contraseña</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar contraseña</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {passwordError}
            </p>
          )}

          {passwordSuccess && (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="h-4 w-4" />
              Contraseña actualizada correctamente.
            </p>
          )}

          <Button className="w-full sm:w-fit" onClick={changePassword} disabled={changingPassword}>
            {changingPassword ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Actualizar contraseña
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <SecurityCard
          icon={<ShieldCheck />}
          title="Row Level Security"
          detail="Activo en todas las tablas expuestas."
        />
        <SecurityCard
          icon={<KeyRound />}
          title="Credenciales"
          detail="Secretos fuera del cliente y localStorage."
        />
        <SecurityCard
          icon={<Users />}
          title="RBAC"
          detail="Roles validados en Edge Functions."
        />
        <SecurityCard
          icon={<Database />}
          title="Aislamiento tenant"
          detail="Consultas limitadas a tu organización."
        />
      </div>
    </>
  );
}

function SecurityCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="h-8 w-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
          {icon}
        </div>
        <p className="text-sm font-medium mt-3">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        <Badge variant="success" className="mt-3">
          <Check className="h-3 w-3 mr-1" />
          Verificado
        </Badge>
      </CardContent>
    </Card>
  );
}
