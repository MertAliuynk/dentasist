import { SIGNUP_OPEN } from "@/lib/signup";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  ClipboardList,
  FlaskConical,
  Lock,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brand } from "@/lib/brand";
import { FadeIn } from "@/components/marketing/fade-in";
import { Mascot } from "@/components/marketing/mascot";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: brand.name,
        url: SITE_URL,
        description: brand.tagline,
      },
      {
        "@type": "SoftwareApplication",
        name: brand.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: brand.tagline,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "TRY",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,var(--accent),transparent)]" />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
          <FadeIn>
            <Mascot className="mb-4 h-28 w-28 sm:h-36 sm:w-36" />
          </FadeIn>
          <FadeIn>
            <Badge variant="secondary" className="mb-6">
              Tek platformda dental ve muhasebe
            </Badge>
          </FadeIn>
          <FadeIn delay={0.05}>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
              {brand.name}
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="mt-6 text-balance text-lg text-muted-foreground sm:text-xl">
              {brand.tagline} Kliniğinizi, şubelerinizi ve ekibinizi tek çatı altında yönetin.
            </p>
          </FadeIn>
          <FadeIn delay={0.15}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" nativeButton={false} render={<Link href={SIGNUP_OPEN ? "/kayit" : "/giris"} />}>
                {SIGNUP_OPEN ? "Ücretsiz Başla" : "Giriş Yap"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                nativeButton={false}
                render={<Link href="/fiyatlandirma" />}
              >
                Fiyatlandırmayı İncele
              </Button>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Nasıl çalışır?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Kaydolduktan birkaç dakika sonra kliniğiniz sistemde, ekibiniz kendi rolüne özel
              ekranlarla çalışmaya başlar.
            </p>
          </div>
        </FadeIn>
        <div className="grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Planınızı seçin, kaydolun",
              desc: "Dental, Muhasebe ya da ikisi birlikte — ihtiyacınıza uygun planı seçip klinik hesabınızı birkaç dakikada oluşturun.",
            },
            {
              step: "2",
              title: "Şube ve ekibinizi tanımlayın",
              desc: "Şubelerinizi, doktorlarınızı ve personelinizi ekleyin; her kullanıcıya rolüne uygun yetkiler otomatik atanır.",
            },
            {
              step: "3",
              title: "Randevu, tedavi ve kasayı yönetin",
              desc: "Takvim, hasta kartları, ödeme planları ve raporlar aynı gün kullanıma hazır.",
            },
          ].map((s, i) => (
            <FadeIn key={s.step} delay={i * 0.05}>
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {s.step}
                </span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section id="dental" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-3">
              Dental
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Hasta ve randevu yönetimi, tek ekrandan
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Doktor, sekreter, şube yöneticisi ve patron için ayrı ayrı tasarlanmış roller;
              sürükle-bırak randevu takvimi ve uçtan uca hasta takibi.
            </p>
          </div>
        </FadeIn>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: CalendarClock,
              title: "Şık Randevu Takvimi",
              desc: "Doktor bazlı renklendirme, sürükle-bırak ile yeniden planlama ve tek tıkla randevu oluşturma.",
            },
            {
              icon: Users,
              title: "Hasta Kartı",
              desc: "Önerilen, onaylanan ve tamamlanan tedaviler; notlar ve randevu geçmişi tek sayfada.",
            },
            {
              icon: ClipboardList,
              title: "Toplu Hasta Ekleme",
              desc: "Tek seferde 50'ye kadar hasta kaydı, zorunlu alanlarla hızlı veri girişi.",
            },
          ].map((f, i) => (
            <FadeIn key={f.title} delay={i * 0.05}>
              <Card className="h-full">
                <CardHeader>
                  <f.icon className="size-6 text-primary" />
                  <CardTitle className="mt-2">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <section id="muhasebe" className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-3">
              Muhasebe
            </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Kasa, ödeme planları ve hekim hakedişleri
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Günlük kasa takibinden esnek taksitlendirmeye, şubeler arası karşılaştırmalı
                raporlara kadar kliniğinizin finansal görünürlüğü.
              </p>
            </div>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Wallet,
                title: "Günlük Kasa",
                desc: "Nakit, havale ve kredi kartı bazında anlık kasa durumu ve gelir-gider takibi.",
              },
              {
                icon: Receipt,
                title: "Esnek Ödeme Planları",
                desc: "Taksit sayısı ve tutarını istediğiniz gibi düzenleyin, kalan bakiye otomatik dağılsın.",
              },
              {
                icon: ShieldCheck,
                title: "Şubeler Arası Raporlar",
                desc: "Hekim başı hakediş, bekleyen ve gecikmiş tahsilatlar tek bakışta.",
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <Card className="h-full bg-background">
                  <CardHeader>
                    <f.icon className="size-6 text-primary" />
                    <CardTitle className="mt-2">{f.title}</CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <FadeIn>
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-3">
              Roller
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Herkes kendi işine odaklanır
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Dental ve Muhasebe modüllerinin her biri, kliniğinizdeki gerçek görev dağılımına
              göre tasarlanmış rollerle gelir; her kullanıcı yalnızca kendi işiyle ilgili verileri
              görür.
            </p>
          </div>
        </FadeIn>
        <div className="grid gap-6 lg:grid-cols-2">
          <FadeIn>
            <Card className="h-full">
              <CardHeader>
                <Stethoscope className="size-6 text-primary" />
                <CardTitle className="mt-2">Dental rolleri</CardTitle>
                <CardDescription>Patron, Şube Yöneticisi, Doktor, Sekreter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Patron</span>, tüm şubeleri ve
                  şubeler arası performansı tek yerden izler.
                </p>
                <p>
                  <span className="font-medium text-foreground">Şube Yöneticisi</span>, yalnızca
                  kendi şubesinin randevu, hasta ve raporlarını yönetir.
                </p>
                <p>
                  <span className="font-medium text-foreground">Doktor</span>, kendi hastalarını,
                  randevularını ve önerdiği tedavileri görür.
                </p>
                <p>
                  <span className="font-medium text-foreground">Sekreter</span>, tüm doktorların
                  takvimini yönetir, hasta kaydı ve randevu oluşturur.
                </p>
              </CardContent>
            </Card>
          </FadeIn>
          <FadeIn delay={0.05}>
            <Card className="h-full">
              <CardHeader>
                <UserCog className="size-6 text-primary" />
                <CardTitle className="mt-2">Muhasebe rolleri</CardTitle>
                <CardDescription>Patron, Şube Yöneticisi, Sekreter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Patron</span>, tüm şubelerin
                  günlük kasasını ve hekim hakedişlerini karşılaştırmalı görür.
                </p>
                <p>
                  <span className="font-medium text-foreground">Şube Yöneticisi</span>, kendi
                  şubesinin gelir-gider, ödeme planı ve raporlarını yönetir.
                </p>
                <p>
                  <span className="font-medium text-foreground">Sekreter</span>, günlük kasa
                  girişlerini, tahsilatları ve taksit takibini yürütür.
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>

      <section className="bg-secondary/40 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <div className="mb-12 text-center">
              <Badge variant="outline" className="mb-3">
                Güvenlik
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Klinik verileriniz izole ve denetimli
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Çok kiracılı mimari, her kliniğin verisini diğerlerinden tamamen ayırır;
                hassas işlemler denetim kaydına düşer.
              </p>
            </div>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Building2,
                title: "Tam veri izolasyonu",
                desc: "Her klinik kendi organizasyon alanında çalışır, verileriniz başka kliniklerle asla karışmaz.",
              },
              {
                icon: Lock,
                title: "Denetim kaydı",
                desc: "Ödeme planı onaylama, taksit düzenleme, hasta silme gibi kritik işlemler kim, ne zaman yaptı bilgisiyle kayıt altına alınır.",
              },
              {
                icon: ShieldCheck,
                title: "Korumalı erişim",
                desc: "Giriş denemeleri kötüye kullanıma karşı sınırlandırılır, rol bazlı yetkilendirme her ekranda uygulanır.",
              },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.05}>
                <Card className="h-full bg-background">
                  <CardHeader>
                    <f.icon className="size-6 text-primary" />
                    <CardTitle className="mt-2">{f.title}</CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <FadeIn>
          <FlaskConical className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Laboratuvar modülü</h2>
          <p className="mt-2 text-muted-foreground">Çok yakında.</p>
        </FadeIn>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-24 text-center sm:px-6">
        <FadeIn>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Kliniğinizi bugün dijitalleştirin
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Dental ve Muhasebe modüllerini ayrı ayrı ya da birlikte kullanın, dilediğiniz
                zaman yükseltin.
              </p>
              <Button size="lg" nativeButton={false} render={<Link href={SIGNUP_OPEN ? "/kayit" : "/giris"} />}>
                {SIGNUP_OPEN ? "Ücretsiz Başla" : "Giriş Yap"}
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      </section>
    </div>
  );
}
