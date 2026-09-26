"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastError } from "@/lib/error-report";
import { CheckCircle2, Copy, MessageSquare, Pencil, Send, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const fmtDateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d));

function IpInfo({ serverIp }: { serverIp: string | null }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      <div className="space-y-1">
        <p className="font-medium text-foreground">IP kısıtlaması (isteğe bağlı, önerilir)</p>
        <p>
          NetGSM panelinde API kullanıcınıza IP kısıtlaması koyarsanız, şifreniz bir şekilde ele geçse bile SMS yalnızca
          bizim sunucumuzdan gönderilebilir. Sunucu IP adresi zaten herkese açık bir bilgidir; paylaşmak risk oluşturmaz,
          tam tersine hesabınızı korur.
        </p>
        {serverIp ? (
          <p className="flex items-center gap-2">
            İzin verilecek IP:
            <code className="rounded bg-background px-1.5 py-0.5 text-foreground">{serverIp}</code>
            <button
              type="button"
              className="hover:text-foreground"
              aria-label="Kopyala"
              onClick={() => {
                navigator.clipboard.writeText(serverIp);
                toast.success("IP kopyalandı.");
              }}
            >
              <Copy className="size-3.5" />
            </button>
          </p>
        ) : (
          <p>Sunucu IP adresini destek ekibimizden öğrenebilirsiniz.</p>
        )}
      </div>
    </div>
  );
}

function ConnectForm({
  s,
  onDone,
  onCancel,
}: {
  s: { connected: boolean; username: string; msgheader: string };
  onDone: () => void;
  onCancel?: () => void;
}) {
  const utils = trpc.useUtils();
  const [username, setUsername] = useState(s.username);
  const [password, setPassword] = useState("");
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [msgheader, setMsgheader] = useState(s.msgheader);

  const fetchHeaders = trpc.messaging.smsFetchHeaders.useMutation({
    onSuccess: ({ headers }) => {
      setHeaders(headers);
      if (headers.length === 0) toast.warning("Bağlantı başarılı ama hesapta onaylı SMS başlığı bulunamadı. Başlığı elle yazabilirsiniz.");
      else {
        toast.success("Bağlantı başarılı! Şimdi SMS başlığınızı seçin.");
        if (!headers.includes(msgheader)) setMsgheader(headers[0]);
      }
    },
    onError: (e) => toastError(e),
  });
  const save = trpc.messaging.smsSave.useMutation({
    onSuccess: (r) => {
      toast.success(r.firstTime ? "SMS hesabınız bağlandı! Otomatik mesajlarınızı kurabilirsiniz." : "SMS ayarları kaydedildi.");
      utils.messaging.smsSettings.invalidate();
      utils.messaging.smsStatus.invalidate();
      onDone();
    },
    onError: (e) => toastError(e),
  });

  const step2 = headers !== null || s.connected;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>NetGSM Kullanıcı Adı</Label>
          <Input
            value={username}
            autoComplete="off"
            placeholder="850xxxxxxx"
            onChange={(e) => {
              setUsername(e.target.value);
              setHeaders(null);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Şifre</Label>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={s.connected ? "Değiştirmeyecekseniz boş bırakın" : "API kullanıcısı şifresi"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setHeaders(null);
            }}
          />
        </div>
      </div>
      <Button
        variant={step2 ? "outline" : "default"}
        disabled={!username.trim() || (!s.connected && !password) || fetchHeaders.isPending}
        onClick={() => fetchHeaders.mutate({ username: username.trim(), password: password || undefined })}
      >
        {fetchHeaders.isPending ? "Bağlanıyor…" : "Bağlan ve Başlıkları Getir"}
      </Button>

      {step2 && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="max-w-xs space-y-1">
            <Label>SMS Başlığı (gönderen adı)</Label>
            {headers && headers.length > 0 ? (
              <Select value={msgheader} onValueChange={(v) => setMsgheader(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={msgheader} maxLength={20} onChange={(e) => setMsgheader(e.target.value)} />
            )}
            <p className="text-xs text-muted-foreground">Hastalarınızın telefonunda gönderen olarak görünür.</p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!username.trim() || !msgheader.trim() || save.isPending}
              onClick={() => save.mutate({ username: username.trim(), password: password || undefined, msgheader: msgheader.trim() })}
            >
              {save.isPending ? "Doğrulanıyor…" : s.connected ? "Kaydet" : "Bağlantıyı Tamamla"}
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Vazgeç
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Shown instead of the whole SMS page until an account is connected. */
export function SmsSetup({ canSettings }: { canSettings: boolean }) {
  const { data: s } = trpc.messaging.smsSettings.useQuery(undefined, { enabled: canSettings });

  if (!canSettings) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <MessageSquare className="mb-2 size-8 text-muted-foreground" />
          <CardTitle className="text-base">SMS hesabı henüz bağlanmadı</CardTitle>
          <CardDescription>
            SMS gönderimi ve otomatik mesajlar, klinik yöneticiniz NetGSM hesabını bağladığında burada açılacak.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (!s) return <p className="py-16 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS Hesabınızı Bağlayın</CardTitle>
          <CardDescription>
            SMS&apos;ler kliniğinizin kendi NetGSM hesabından, kendi başlığınızla gider; ücret NetGSM kredinizden düşer. Bağladıktan
            sonra şablonlar, otomatik hatırlatmalar, doğum günü mesajları ve gönderim ekranı açılır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectForm s={s} onDone={() => undefined} />
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Nasıl hazırlanırım?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-4 text-xs text-muted-foreground">
              <li>netgsm.com.tr üzerinden bir SMS paketi alın.</li>
              <li>SMS başlığınızı (ör. klinik adınız) NetGSM&apos;e onaylatın.</li>
              <li>
                NetGSM panelinde <b>API yetkili bir alt kullanıcı</b> oluşturun. Ana hesap şifrenizi vermenize gerek yok.
              </li>
              <li>Alt kullanıcının adını ve şifresini buraya girin, &quot;Bağlan&quot;a basın.</li>
            </ol>
          </CardContent>
        </Card>
        <IpInfo serverIp={s.serverIp} />
      </div>
    </div>
  );
}

export function SmsAccountTab() {
  const utils = trpc.useUtils();
  const { data: s } = trpc.messaging.smsSettings.useQuery();
  const [editing, setEditing] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const sendTest = trpc.messaging.smsSendTest.useMutation({
    onSuccess: () => toast.success("Test SMS'i gönderildi."),
    onError: (e) => toastError(e),
  });
  const disconnect = trpc.messaging.smsDisconnect.useMutation({
    onSuccess: () => {
      toast.success("SMS hesabı bağlantısı kaldırıldı. Otomatik mesajlar durduruldu.");
      utils.messaging.smsSettings.invalidate();
      utils.messaging.smsStatus.invalidate();
      utils.messaging.automations.invalidate();
    },
    onError: (e) => toastError(e),
  });

  if (!s) return <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-600" /> NetGSM Bağlı
            </CardTitle>
            <CardDescription>
              Kullanıcı: {s.username} · Başlık: <b>{s.msgheader}</b>
              {s.lastVerifiedAt && ` · Son doğrulama: ${fmtDateTime(s.lastVerifiedAt)}`}
            </CardDescription>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Bilgileri Değiştir
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {editing && <ConnectForm s={s} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />}
          <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Test SMS&apos;i gönder</Label>
              <Input className="w-48" placeholder="05xx xxx xx xx" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </div>
            <Button variant="outline" disabled={testPhone.length < 10 || sendTest.isPending} onClick={() => sendTest.mutate({ phone: testPhone })}>
              <Send className="size-4" /> Test Gönder
            </Button>
            <div className="flex-1" />
            {!confirmDisconnect ? (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDisconnect(true)}>
                Bağlantıyı Kaldır
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-sm">
                Otomatik mesajlar durur.
                <Button variant="destructive" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                  Kaldır
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDisconnect(false)}>
                  Vazgeç
                </Button>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
      <IpInfo serverIp={s.serverIp} />
      <p className="px-1 text-xs text-muted-foreground">
        Randevu hatırlatma, onay ve kontrol mesajları &quot;bilgilendirme&quot; olarak gönderilir ve İYS onayı gerektirmez.
        Kampanya / indirim / tanıtım içerikli mesajlar ticari ileti sayılır ve İYS kaydı gerektirir — bu tür içerikleri
        otomatik mesajlarda kullanmayın.
      </p>
    </div>
  );
}
