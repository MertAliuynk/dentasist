"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  GitBranch,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { platformTrpc } from "@/lib/platform-trpc/client";
import { MODULE_LABEL, fmtDate } from "@/components/platform/platform-format";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types & constants

type Module = "DENTAL" | "MUHASEBE" | "LABORATUVAR";
type StaffRole = "SUBE_YONETICISI" | "DOKTOR" | "SEKRETER" | "TEKNISYEN";
type Duration = "14d" | "30d" | "3m" | "6m" | "1y" | "none" | "custom";

const MODULES: Module[] = ["DENTAL", "MUHASEBE", "LABORATUVAR"];

const ROLE_LABEL: Record<string, string> = {
  PATRON: "Klinik Sahibi (Patron)",
  "PATRON + DOKTOR": "Klinik Sahibi + Hekim",
  SUBE_YONETICISI: "Şube Yöneticisi",
  DOKTOR: "Hekim",
  SEKRETER: "Sekreter / Resepsiyon",
  TEKNISYEN: "Laboratuvar Teknisyeni",
};

const ROLE_HINT: Record<StaffRole, string> = {
  SUBE_YONETICISI: "Kendi şubesinin her şeyini yönetir.",
  DOKTOR: "Kendi takvimi, hastaları ve tedavileri.",
  SEKRETER: "Randevu, hasta kaydı ve kasa işlemleri.",
  TEKNISYEN: "Laboratuvar modülündeki işler.",
};

const DURATIONS: { value: Duration; label: string }[] = [
  { value: "14d", label: "14 gün" },
  { value: "30d", label: "30 gün" },
  { value: "3m", label: "3 ay" },
  { value: "6m", label: "6 ay" },
  { value: "1y", label: "1 yıl" },
  { value: "none", label: "Süresiz" },
  { value: "custom", label: "Tarih seç" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let keySeq = 0;
const nextKey = () => ++keySeq;

type BranchRow = { key: number; name: string; address: string; phone: string };
type PasswordState = { auto: boolean; value: string; show: boolean };
type StaffRow = {
  key: number;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  branchKey: number;
  title: string;
  commissionRate: string;
  password: PasswordState;
};

const newPassword = (): PasswordState => ({ auto: true, value: "", show: false });
const newBranch = (name = ""): BranchRow => ({ key: nextKey(), name, address: "", phone: "" });

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function computeEnd(duration: Duration, custom: string): Date | null {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  switch (duration) {
    case "14d":
      d.setDate(d.getDate() + 14);
      return d;
    case "30d":
      d.setDate(d.getDate() + 30);
      return d;
    case "3m":
      d.setMonth(d.getMonth() + 3);
      return d;
    case "6m":
      d.setMonth(d.getMonth() + 6);
      return d;
    case "1y":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case "none":
      return null;
    case "custom": {
      if (!custom) return null;
      const c = new Date(`${custom}T23:59:00`);
      return Number.isNaN(c.getTime()) ? null : c;
    }
  }
}

function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = new Uint32Array(10);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => alphabet[n % alphabet.length]).join("");
}

function money(kurus: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(kurus / 100);
}

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Small building blocks

function Section({
  step,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  step: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {step}
          </span>
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Icon className="size-4 text-muted-foreground" />
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PasswordField({ value, onChange, error }: { value: PasswordState; onChange: (v: PasswordState) => void; error?: string | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Şifre</Label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch size="sm" checked={value.auto} onCheckedChange={(auto) => onChange({ ...value, auto })} />
          Otomatik oluştur
        </label>
      </div>
      {value.auto ? (
        <p className="flex h-9 items-center gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground">
          <KeyRound className="size-3.5" /> Oluşturulunca güvenli bir şifre üretilip size gösterilecek.
        </p>
      ) : (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Input
              type={value.show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="En az 8 karakter"
              className="pr-9 font-mono"
              aria-invalid={!!error}
              value={value.value}
              onChange={(e) => onChange({ ...value, value: e.target.value })}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ ...value, show: !value.show })}
              aria-label={value.show ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {value.show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Rastgele şifre üret"
            onClick={() => onChange({ ...value, value: randomPassword(), show: true })}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result screen

type CreateResult = {
  organizationId: string;
  organizationName: string;
  planName: string;
  status: string;
  currentPeriodEnd: string | null;
  modules: string[];
  branches: string[];
  accounts: { name: string; email: string; role: string; branchName: string | null; password: string; generated: boolean }[];
};

function credentialsText(r: CreateResult) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const lines = [
    `${r.organizationName} — DişPanel hesabınız hazır.`,
    `Giriş adresi: ${origin}/giris`,
    "",
    ...r.accounts.flatMap((a) => [
      `${a.name} — ${ROLE_LABEL[a.role] ?? a.role}${a.branchName ? ` (${a.branchName})` : ""}`,
      `E-posta: ${a.email}`,
      `Şifre: ${a.password}`,
      "",
    ]),
    "Bu bilgileri kimseyle paylaşmayın.",
  ];
  return lines.join("\n");
}

function copy(text: string, what: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} kopyalandı.`),
    () => toast.error("Kopyalanamadı; metni elle seçip kopyalayın."),
  );
}

function ResultView({ result, onAnother }: { result: CreateResult; onAnother: () => void }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card className="border-emerald-500/40">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-500" />
          <div>
            <CardTitle className="text-lg">{result.organizationName} hesabı oluşturuldu</CardTitle>
            <CardDescription className="mt-1">
              Aşağıdaki giriş bilgilerini kliniğe iletin. <b className="text-foreground">Şifreler yalnızca şimdi görünür</b>; sayfadan
              ayrıldıktan sonra tekrar gösterilemez (gerekirse klinik sayfasından sıfırlanabilir).
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="font-medium">{result.planName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Durum</p>
            <p className="font-medium">{result.status === "TRIAL" ? "Deneme" : "Aktif"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bitiş</p>
            <p className="font-medium">{result.currentPeriodEnd ? fmtDate(result.currentPeriodEnd) : "Süresiz"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Modüller</p>
            <p className="font-medium">{result.modules.map((m) => MODULE_LABEL[m] ?? m).join(", ")}</p>
          </div>
          <div className="sm:col-span-4">
            <p className="text-xs text-muted-foreground">Şubeler</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {result.branches.map((b) => (
                <Badge key={b} variant="outline">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Giriş Bilgileri ({result.accounts.length} hesap)</CardTitle>
            <CardDescription>Tümünü kopyalayıp WhatsApp veya e-posta ile gönderebilirsiniz.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShown((s) => !s)}>
              {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {shown ? "Şifreleri gizle" : "Şifreleri göster"}
            </Button>
            <Button size="sm" onClick={() => copy(credentialsText(result), "Tüm giriş bilgileri")}>
              <Copy className="size-4" /> Tümünü kopyala
            </Button>
          </div>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {result.accounts.map((a) => (
            <div key={a.email} className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">
                  {a.name}{" "}
                  <Badge variant="secondary" className="ml-1 align-middle">
                    {ROLE_LABEL[a.role] ?? a.role}
                  </Badge>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.email}
                  {a.branchName ? ` · ${a.branchName}` : " · Tüm şubeler"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm tabular-nums">{shown ? a.password : "••••••••••"}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Bu kişinin bilgilerini kopyala"
                  onClick={() => copy(`E-posta: ${a.email}\nŞifre: ${a.password}`, `${a.name} bilgileri`)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onAnother}>
          <Plus className="size-4" /> Yeni hesap daha oluştur
        </Button>
        <Button nativeButton={false} render={<Link href={`/admin/organizasyonlar/${result.organizationId}`} />}>
          <Building2 className="size-4" /> Klinik sayfasına git
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function NewAccountPage() {
  const { data: plans } = platformTrpc.plan.list.useQuery();
  const create = platformTrpc.organization.createAccount.useMutation();

  const [result, setResult] = useState<CreateResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  // 1 — Clinic
  const [org, setOrg] = useState({ name: "", phone: "", address: "", taxNumber: "", taxOffice: "", billingEmail: "" });
  // 2 — Plan & membership
  const [planId, setPlanId] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [status, setStatus] = useState<"TRIAL" | "ACTIVE">("TRIAL");
  const [duration, setDuration] = useState<Duration>("30d");
  const [customEnd, setCustomEnd] = useState("");
  const [adminNote, setAdminNote] = useState("");
  // 3 — Branches
  const [branches, setBranches] = useState<BranchRow[]>(() => [newBranch("Merkez")]);
  // 4 — Owner
  const [owner, setOwner] = useState({ name: "", email: "", phone: "", isDoctor: false, title: "Dt.", commissionRate: "" });
  const [ownerPassword, setOwnerPassword] = useState<PasswordState>(newPassword);
  // 5 — Staff
  const [staff, setStaff] = useState<StaffRow[]>([]);

  const plan = plans?.find((p) => p.id === planId);
  const activePlans = plans?.filter((p) => p.isActive) ?? [];
  const endDate = computeEnd(duration, customEnd);

  const pickPlan = (id: string) => {
    setPlanId(id);
    const p = plans?.find((x) => x.id === id);
    if (p) setModules([...p.modules] as Module[]);
  };

  // E-mail availability (debounced) — catches typos before submit.
  const allEmails = [owner.email, ...staff.map((s) => s.email)].map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e));
  const debouncedEmails = useDebounced(allEmails.join(","));
  const { data: emailCheck } = platformTrpc.organization.checkEmails.useQuery(
    { emails: debouncedEmails ? debouncedEmails.split(",") : [] },
    { enabled: !!debouncedEmails },
  );
  const taken = new Set(emailCheck?.taken ?? []);

  // -------------------------------------------------------------------------
  // Validation (shown inline after the first submit attempt, always in the
  // summary panel).
  const errors = (() => {
    const e: Record<string, string> = {};
    if (org.name.trim().length < 2) e["org.name"] = "Klinik adı gerekli.";
    if (org.billingEmail.trim() && !EMAIL_RE.test(org.billingEmail.trim())) e["org.billingEmail"] = "Geçersiz e-posta.";
    if (!planId) e.plan = "Bir plan seçin.";
    if (modules.length === 0) e.modules = "En az bir modül seçin.";
    if (duration === "custom") {
      if (!customEnd) e.end = "Bitiş tarihi seçin.";
      else if (customEnd < todayInput()) e.end = "Bitiş tarihi geçmişte olamaz.";
    }
    const names = branches.map((b) => b.name.trim().toLocaleLowerCase("tr"));
    branches.forEach((b, i) => {
      if (b.name.trim().length < 2) e[`branch.${b.key}`] = "Şube adı gerekli.";
      else if (names.indexOf(names[i]) !== i) e[`branch.${b.key}`] = "Bu isimde başka bir şube var.";
    });
    const emails = [owner.email, ...staff.map((s) => s.email)].map((x) => x.trim().toLowerCase());
    const emailError = (email: string, idx: number) => {
      const v = email.trim().toLowerCase();
      if (!v) return "E-posta gerekli.";
      if (!EMAIL_RE.test(v)) return "Geçersiz e-posta.";
      if (emails.indexOf(v) !== idx) return "Bu e-posta formda zaten kullanılıyor.";
      if (taken.has(v)) return "Bu e-posta sistemde zaten kayıtlı.";
      return null;
    };
    if (owner.name.trim().length < 2) e["owner.name"] = "Ad soyad gerekli.";
    const oe = emailError(owner.email, 0);
    if (oe) e["owner.email"] = oe;
    if (!ownerPassword.auto && ownerPassword.value.length < 8) e["owner.password"] = "Şifre en az 8 karakter olmalı.";
    staff.forEach((s, i) => {
      if (s.name.trim().length < 2) e[`staff.${s.key}.name`] = "Ad soyad gerekli.";
      const se = emailError(s.email, i + 1);
      if (se) e[`staff.${s.key}.email`] = se;
      if (!branches.some((b) => b.key === s.branchKey)) e[`staff.${s.key}.branch`] = "Şube seçin.";
      if (!s.password.auto && s.password.value.length < 8) e[`staff.${s.key}.password`] = "Şifre en az 8 karakter olmalı.";
    });
    return e;
  })();

  const errorCount = Object.keys(errors).length;
  const err = (k: string) => (showErrors ? errors[k] ?? null : null);
  const userCount = 1 + staff.length;
  const planWarnings = [
    plan?.maxBranches != null && branches.length > plan.maxBranches
      ? `Plan en fazla ${plan.maxBranches} şube içeriyor (${branches.length} girildi).`
      : null,
    plan?.maxUsers != null && userCount > plan.maxUsers ? `Plan en fazla ${plan.maxUsers} kullanıcı içeriyor (${userCount} girildi).` : null,
    modules.includes("LABORATUVAR") && !staff.some((s) => s.role === "TEKNISYEN")
      ? "Laboratuvar modülü açık ama teknisyen eklenmedi (sonradan da eklenebilir)."
      : null,
  ].filter(Boolean) as string[];

  // Checklist for the summary panel.
  const steps = [
    { label: "Klinik bilgileri", ok: !errors["org.name"] && !errors["org.billingEmail"] },
    { label: "Plan ve üyelik", ok: !errors.plan && !errors.modules && !errors.end },
    { label: "Şubeler", ok: !Object.keys(errors).some((k) => k.startsWith("branch.")) },
    { label: "Klinik sahibi", ok: !Object.keys(errors).some((k) => k.startsWith("owner.")) },
    { label: "Personel", ok: !Object.keys(errors).some((k) => k.startsWith("staff.")) },
  ];

  function updateStaff(key: number, patch: Partial<StaffRow>) {
    setStaff((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addStaff(role: StaffRole = "DOKTOR") {
    setStaff((prev) => [
      ...prev,
      {
        key: nextKey(),
        name: "",
        email: "",
        phone: "",
        role,
        branchKey: branches[0]?.key ?? 0,
        title: role === "DOKTOR" ? "Dt." : "",
        commissionRate: "",
        password: newPassword(),
      },
    ]);
  }

  function removeBranch(key: number) {
    const fallback = branches.find((b) => b.key !== key)?.key ?? 0;
    setBranches((prev) => prev.filter((b) => b.key !== key));
    setStaff((prev) => prev.map((s) => (s.branchKey === key ? { ...s, branchKey: fallback } : s)));
  }

  function reset() {
    setResult(null);
    setShowErrors(false);
    setOrg({ name: "", phone: "", address: "", taxNumber: "", taxOffice: "", billingEmail: "" });
    setPlanId("");
    setModules([]);
    setStatus("TRIAL");
    setDuration("30d");
    setCustomEnd("");
    setAdminNote("");
    setBranches([newBranch("Merkez")]);
    setOwner({ name: "", email: "", phone: "", isDoctor: false, title: "Dt.", commissionRate: "" });
    setOwnerPassword(newPassword());
    setStaff([]);
    window.scrollTo({ top: 0 });
  }

  function submit() {
    setShowErrors(true);
    if (errorCount > 0) {
      toast.error(`${errorCount} alanda eksik veya hatalı bilgi var. Kırmızı alanları kontrol edin.`);
      return;
    }
    const rate = (v: string) => (v.trim() === "" ? undefined : Math.min(100, Math.max(0, Number(v.replace(",", ".")) || 0)));
    create.mutate(
      {
        organization: {
          name: org.name.trim(),
          phone: org.phone.trim(),
          address: org.address.trim(),
          taxNumber: org.taxNumber.trim(),
          taxOffice: org.taxOffice.trim(),
          billingEmail: org.billingEmail.trim(),
        },
        planId,
        status,
        currentPeriodEnd: endDate ? endDate.toISOString() : null,
        modules,
        adminNote: adminNote.trim(),
        branches: branches.map((b) => ({ name: b.name.trim(), address: b.address.trim(), phone: b.phone.trim() })),
        owner: {
          name: owner.name.trim(),
          email: owner.email.trim().toLowerCase(),
          phone: owner.phone.trim(),
          password: ownerPassword.auto ? "" : ownerPassword.value,
          isDoctor: owner.isDoctor,
          title: owner.isDoctor ? owner.title.trim() : "",
          commissionRate: owner.isDoctor ? rate(owner.commissionRate) : undefined,
        },
        staff: staff.map((s) => ({
          name: s.name.trim(),
          email: s.email.trim().toLowerCase(),
          phone: s.phone.trim(),
          role: s.role,
          branchIndex: Math.max(0, branches.findIndex((b) => b.key === s.branchKey)),
          password: s.password.auto ? "" : s.password.value,
          title: s.role === "DOKTOR" ? s.title.trim() : "",
          commissionRate: s.role === "DOKTOR" ? rate(s.commissionRate) : undefined,
        })),
      },
      {
        onSuccess: (r) => {
          setResult(r as CreateResult);
          window.scrollTo({ top: 0 });
          toast.success("Hesap oluşturuldu.");
        },
        onError: (e) => toast.error(e.message),
      },
    );
  }

  if (result) return <ResultView result={result} onAnother={reset} />;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/admin/organizasyonlar" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Klinikler
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Yeni Klinik Hesabı</h1>
          <p className="text-sm text-muted-foreground">
            Klinik, abonelik, şubeler ve kullanıcılar tek seferde oluşturulur. Şifreler sonunda bir kez gösterilir.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* 1 — Clinic */}
          <Section step={1} icon={Building2} title="Klinik Bilgileri" description="Faturalama alanları opsiyoneldir; klinik sonradan Ayarlar'dan güncelleyebilir.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Klinik / İşletme Adı" required error={err("org.name")} className="sm:col-span-2">
                <Input autoFocus value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} placeholder="Ör. Gülüş Ağız ve Diş Sağlığı" />
              </Field>
              <Field label="Telefon">
                <Input type="tel" value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} placeholder="0 (212) 000 00 00" />
              </Field>
              <Field label="Fatura E-postası" error={err("org.billingEmail")}>
                <Input type="email" value={org.billingEmail} onChange={(e) => setOrg({ ...org, billingEmail: e.target.value })} />
              </Field>
              <Field label="Adres" className="sm:col-span-2">
                <Input value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} />
              </Field>
              <Field label="Vergi Dairesi">
                <Input value={org.taxOffice} onChange={(e) => setOrg({ ...org, taxOffice: e.target.value })} />
              </Field>
              <Field label="Vergi / TC No">
                <Input inputMode="numeric" value={org.taxNumber} onChange={(e) => setOrg({ ...org, taxNumber: e.target.value })} />
              </Field>
            </div>
          </Section>

          {/* 2 — Plan */}
          <Section step={2} icon={CreditCard} title="Plan ve Üyelik" description="Plan modülleri otomatik seçer; pilot klinikler için modülleri ayrıca açıp kapatabilirsiniz.">
            <div className="space-y-1.5">
              <Label>
                Plan<span className="text-destructive">*</span>
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {activePlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickPlan(p.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      planId === p.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{p.name}</span>
                      {planId === p.id && <Check className="size-4 text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{money(p.priceMonthly)} / ay</span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      {p.modules.map((m) => (
                        <Badge key={m} variant="outline" className="text-[10px]">
                          {MODULE_LABEL[m] ?? m}
                        </Badge>
                      ))}
                    </span>
                    {(p.maxBranches != null || p.maxUsers != null) && (
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {p.maxBranches != null ? `${p.maxBranches} şube` : "Sınırsız şube"} · {p.maxUsers != null ? `${p.maxUsers} kullanıcı` : "sınırsız kullanıcı"}
                      </span>
                    )}
                  </button>
                ))}
                {!plans && <p className="text-sm text-muted-foreground">Planlar yükleniyor…</p>}
              </div>
              {err("plan") && <p className="text-xs text-destructive">{err("plan")}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Açık Modüller</Label>
              <div className="flex flex-wrap gap-4">
                {MODULES.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={modules.includes(m)}
                      onCheckedChange={(c) => setModules((prev) => (c ? [...prev, m] : prev.filter((x) => x !== m)))}
                    />
                    {MODULE_LABEL[m]}
                  </label>
                ))}
              </div>
              {err("modules") && <p className="text-xs text-destructive">{err("modules")}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Field label="Durum">
                <Select
                  value={status}
                  onValueChange={(v) => {
                    const s = (v ?? "TRIAL") as "TRIAL" | "ACTIVE";
                    setStatus(s);
                    if (duration !== "custom" && duration !== "none") setDuration(s === "TRIAL" ? "30d" : "1y");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => (v === "TRIAL" ? "Deneme (pilot)" : "Aktif (ücretli)")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TRIAL">Deneme (pilot)</SelectItem>
                    <SelectItem value="ACTIVE">Aktif (ücretli)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="space-y-1.5">
                <Label>Üyelik Süresi</Label>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((d) => (
                    <Button key={d.value} type="button" size="sm" variant={duration === d.value ? "default" : "outline"} onClick={() => setDuration(d.value)}>
                      {d.label}
                    </Button>
                  ))}
                </div>
                {duration === "custom" && (
                  <Input type="date" className="mt-2 w-48" min={todayInput()} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
                )}
                <p className={cn("text-xs", err("end") ? "text-destructive" : "text-muted-foreground")}>
                  {err("end") ??
                    (endDate
                      ? `Bitiş: ${fmtDate(endDate)} — bu tarihten sonra klinik giriş yapsa da modüllere erişemez; klinik sayfasından uzatabilirsiniz.`
                      : "Süresiz: siz kapatana kadar açık kalır.")}
                </p>
              </div>
            </div>

            <Field label="İç Not" hint="Sadece admin panelinde görünür; klinik göremez.">
              <Textarea rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Ör. Pilot klinik, 1. ay ücretsiz, iletişim: Ahmet Bey" />
            </Field>
          </Section>

          {/* 3 — Branches */}
          <Section
            step={3}
            icon={GitBranch}
            title={`Şubeler (${branches.length})`}
            description="Klinik sahibi tüm şubeleri görür; personel yalnızca atandığı şubeyi."
            action={
              <Button type="button" variant="outline" size="sm" disabled={branches.length >= 30} onClick={() => setBranches((p) => [...p, newBranch()])}>
                <Plus className="size-4" /> Şube
              </Button>
            }
          >
            <div className="space-y-3">
              {branches.map((b, i) => (
                <div key={b.key} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-start">
                  <Field label={`Şube ${i + 1} Adı`} required error={err(`branch.${b.key}`)}>
                    <Input value={b.name} onChange={(e) => setBranches((p) => p.map((x) => (x.key === b.key ? { ...x, name: e.target.value } : x)))} placeholder="Ör. Kadıköy" />
                  </Field>
                  <Field label="Adres">
                    <Input value={b.address} onChange={(e) => setBranches((p) => p.map((x) => (x.key === b.key ? { ...x, address: e.target.value } : x)))} />
                  </Field>
                  <Field label="Telefon">
                    <Input type="tel" value={b.phone} onChange={(e) => setBranches((p) => p.map((x) => (x.key === b.key ? { ...x, phone: e.target.value } : x)))} />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive sm:mt-6"
                    disabled={branches.length === 1}
                    title={branches.length === 1 ? "En az bir şube gerekli" : "Şubeyi kaldır"}
                    onClick={() => removeBranch(b.key)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Section>

          {/* 4 — Owner */}
          <Section step={4} icon={UserRound} title="Klinik Sahibi (Patron)" description="Tüm şubeleri, raporları, personeli ve yetkileri yönetir.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ad Soyad" required error={err("owner.name")}>
                <Input value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} />
              </Field>
              <Field label="E-posta (giriş için)" required error={err("owner.email")}>
                <Input type="email" autoComplete="off" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} />
              </Field>
              <Field label="Telefon">
                <Input type="tel" value={owner.phone} onChange={(e) => setOwner({ ...owner, phone: e.target.value })} />
              </Field>
              <PasswordField value={ownerPassword} onChange={setOwnerPassword} error={err("owner.password")} />
            </div>
            <div className="rounded-md border border-border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">Klinik sahibi aynı zamanda hekim</span>
                  <span className="block text-xs text-muted-foreground">Takvimde hekim olarak görünür, randevu ve tedavi alabilir ({branches[0]?.name || "ilk şube"}).</span>
                </span>
                <Switch checked={owner.isDoctor} onCheckedChange={(isDoctor) => setOwner({ ...owner, isDoctor })} />
              </label>
              {owner.isDoctor && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Unvan">
                    <Input value={owner.title} onChange={(e) => setOwner({ ...owner, title: e.target.value })} placeholder="Dt., Uzm. Dt., Prof. Dr." />
                  </Field>
                  <Field label="Hakediş Oranı (%)">
                    <Input inputMode="decimal" value={owner.commissionRate} onChange={(e) => setOwner({ ...owner, commissionRate: e.target.value })} placeholder="0" />
                  </Field>
                </div>
              )}
            </div>
          </Section>

          {/* 5 — Staff */}
          <Section
            step={5}
            icon={Users}
            title={`Personel (${staff.length})`}
            description="Opsiyonel. Klinik sahibi sonradan kendisi de ekleyebilir."
            action={
              <Button type="button" variant="outline" size="sm" disabled={staff.length >= 50} onClick={() => addStaff()}>
                <UserPlus className="size-4" /> Personel
              </Button>
            }
          >
            {staff.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Henüz personel eklenmedi.
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addStaff("DOKTOR")}>
                    <Plus className="size-4" /> Hekim
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addStaff("SEKRETER")}>
                    <Plus className="size-4" /> Sekreter
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => addStaff("SUBE_YONETICISI")}>
                    <Plus className="size-4" /> Şube Yöneticisi
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {staff.map((s, i) => (
                  <div key={s.key} className="space-y-3 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        Personel {i + 1}
                        {s.name.trim() && <span className="text-muted-foreground"> · {s.name.trim()}</span>}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        title="Kaldır"
                        onClick={() => setStaff((p) => p.filter((x) => x.key !== s.key))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Rol" hint={ROLE_HINT[s.role]}>
                        <Select
                          value={s.role}
                          onValueChange={(v) => {
                            const role = (v ?? "DOKTOR") as StaffRole;
                            updateStaff(s.key, { role, title: role === "DOKTOR" ? s.title || "Dt." : s.title });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue>{(v: string) => ROLE_LABEL[v]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(["DOKTOR", "SEKRETER", "SUBE_YONETICISI", "TEKNISYEN"] as StaffRole[]).map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Şube" required error={err(`staff.${s.key}.branch`)}>
                        <Select value={String(s.branchKey)} onValueChange={(v) => updateStaff(s.key, { branchKey: Number(v) })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Şube seçin">
                              {(v: string) => branches.find((b) => String(b.key) === v)?.name.trim() || "İsimsiz şube"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((b, bi) => (
                              <SelectItem key={b.key} value={String(b.key)}>
                                {b.name.trim() || `Şube ${bi + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Ad Soyad" required error={err(`staff.${s.key}.name`)}>
                        <Input value={s.name} onChange={(e) => updateStaff(s.key, { name: e.target.value })} />
                      </Field>
                      <Field label="E-posta (giriş için)" required error={err(`staff.${s.key}.email`)}>
                        <Input type="email" autoComplete="off" value={s.email} onChange={(e) => updateStaff(s.key, { email: e.target.value })} />
                      </Field>
                      <Field label="Telefon">
                        <Input type="tel" value={s.phone} onChange={(e) => updateStaff(s.key, { phone: e.target.value })} />
                      </Field>
                      <PasswordField value={s.password} onChange={(password) => updateStaff(s.key, { password })} error={err(`staff.${s.key}.password`)} />
                      {s.role === "DOKTOR" && (
                        <>
                          <Field label="Unvan">
                            <Input value={s.title} onChange={(e) => updateStaff(s.key, { title: e.target.value })} placeholder="Dt., Uzm. Dt." />
                          </Field>
                          <Field label="Hakediş Oranı (%)">
                            <Input inputMode="decimal" value={s.commissionRate} onChange={(e) => updateStaff(s.key, { commissionRate: e.target.value })} placeholder="0" />
                          </Field>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Özet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ul className="space-y-1.5">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    {s.ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <AlertCircle className="size-4 text-amber-500" />}
                    <span className={s.ok ? "" : "text-muted-foreground"}>{s.label}</span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Klinik</dt>
                  <dd className="truncate text-right font-medium">{org.name.trim() || "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="text-right font-medium">{plan?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Modüller</dt>
                  <dd className="text-right">{modules.length ? modules.map((m) => MODULE_LABEL[m]).join(", ") : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Durum</dt>
                  <dd className="text-right">{status === "TRIAL" ? "Deneme" : "Aktif"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Bitiş</dt>
                  <dd className="text-right">{endDate ? fmtDate(endDate) : duration === "none" ? "Süresiz" : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Şube / Kullanıcı</dt>
                  <dd className="text-right">
                    {branches.length} / {userCount}
                  </dd>
                </div>
              </dl>

              {planWarnings.length > 0 && (
                <div className="space-y-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                  {planWarnings.map((w) => (
                    <p key={w}>• {w}</p>
                  ))}
                </div>
              )}

              {showErrors && errorCount > 0 && (
                <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">{errorCount} alanı düzeltmeniz gerekiyor.</p>
              )}

              <Button className="w-full" size="lg" disabled={create.isPending} onClick={submit}>
                {create.isPending ? "Oluşturuluyor…" : "Hesabı Oluştur"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">Oluşturma işlemi denetim kaydına yazılır.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
