import { SIGNUP_OPEN } from "@/lib/signup";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { FadeIn } from "@/components/marketing/fade-in";
import { CalendarMock, CashMock, LabMock, PatientCardMock } from "@/components/marketing/product-mocks";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PRIMARY_HREF = SIGNUP_OPEN ? "/kayit" : "/giris";
const PRIMARY_LABEL = SIGNUP_OPEN ? "Ücretsiz Başla" : "Giriş Yap";

const DAY = [
  {
    time: "08:45",
    who: "Sekreter",
    what: "Günün takvimini açar; gelmeyen hastayı “gelmedi” olarak işaretler, boşalan saati sürükleyerek başka hastaya verir.",
  },
  {
    time: "09:30",
    who: "Doktor",
    what: "Hasta kartında diş şemasından 36 ve 37'yi seçip tedavi önerir. Öneri, hastanın geçmişiyle birlikte kartta kalır.",
  },
  {
    time: "11:00",
    who: "Sekreter",
    what: "Hasta onay verince 6 taksitlik ödeme planı oluşturur. Bir taksiti değiştirirse kalan bakiye diğerlerine kendiliğinden dağılır.",
  },
  {
    time: "14:20",
    who: "Laboratuvar",
    what: "Klinikten gelen kron işini kaydeder; hangi klinikten ne kadar alacağı olduğunu ayrı ayrı görür.",
  },
  {
    time: "18:00",
    who: "Şube yöneticisi",
    what: "Günlük kasayı nakit, kart ve havale olarak kapatır; bekleyen ve geciken tahsilatlara bakar.",
  },
  {
    time: "18:15",
    who: "Patron",
    what: "Bütün şubeleri ve hekim hakedişlerini aynı tabloda karşılaştırır.",
  },
];

const ROLES = [
  { name: "Patron", desc: "Tüm şubeleri, kasaları ve hekim hakedişlerini tek yerden izler." },
  { name: "Şube yöneticisi", desc: "Yalnızca kendi şubesinin randevu, hasta, kasa ve raporlarını yönetir." },
  { name: "Doktor", desc: "Kendi hastalarını, randevularını ve önerdiği tedavileri görür." },
  { name: "Sekreter", desc: "Bütün doktorların takvimini yönetir, hasta kaydı açar, tahsilat girer." },
];

function ModuleRow({
  id,
  index,
  name,
  title,
  body,
  points,
  mock,
  reverse,
}: {
  id: string;
  index: string;
  name: string;
  title: string;
  body: string;
  points: string[];
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16">
        <FadeIn className={reverse ? "lg:order-2" : ""}>
          <div>
            <p className="font-mono text-xs text-muted-foreground">
              {index} <span className="mx-1.5 text-border">/</span>
              <span className="text-brand">{name}</span>
            </p>
            <h2 className="mt-3 max-w-md text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
            <p className="mt-4 max-w-md text-muted-foreground">{body}</p>
            <ul className="mt-6 max-w-md space-y-2.5 text-sm">
              {points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-2 h-px w-3 shrink-0 bg-foreground/40" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
        <FadeIn delay={0.08} className={reverse ? "lg:order-1" : ""}>
          {mock}
        </FadeIn>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: brand.name, url: SITE_URL, description: brand.tagline },
      {
        "@type": "SoftwareApplication",
        name: brand.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: brand.tagline,
        offers: { "@type": "AggregateOffer", priceCurrency: "TRY", availability: "https://schema.org/InStock" },
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-24">
        <div>
          <p className="text-sm text-muted-foreground">
            Diş klinikleri ve laboratuvarlar için yönetim yazılımı
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Randevudan kasaya, kliniğin bütün günü{" "}
            <span className="text-brand">tek ekranda.</span>
          </h1>
          <p className="mt-6 max-w-lg text-pretty text-lg text-muted-foreground">
            Takvim, hasta kartı, ödeme planı ve günlük kasa birbirinden habersiz çalışmasın.
            {" "}{brand.name}, şubelerinizi ve ekibinizi aynı kayıt üzerinde buluşturur.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button size="lg" nativeButton={false} render={<Link href={PRIMARY_HREF} />}>
              {PRIMARY_LABEL}
            </Button>
            <Link
              href="/fiyatlandirma"
              className="group inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
            >
              Fiyatları gör
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          {!SIGNUP_OPEN && (
            <p className="mt-4 text-xs text-muted-foreground">
              Pilot dönemde hesaplar ekibimiz tarafından açılıyor.
            </p>
          )}
        </div>

        <div className="relative">
          <CalendarMock />
          <div className="relative -mt-8 ml-auto hidden w-[78%] sm:block lg:-mr-6">
            <PatientCardMock />
          </div>
        </div>
      </section>

      {/* Facts strip */}
      <section className="border-y border-border bg-muted/40">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
          {[
            { k: "3 modül", v: "Dental, muhasebe ve laboratuvar; ayrı ya da birlikte" },
            { k: "Çok şubeli", v: "Her şubenin takvimi ve kasası ayrı, raporu ortak" },
            { k: "4 rol", v: "Herkes yalnızca kendi işiyle ilgili ekranı görür" },
            { k: "Denetim kaydı", v: "Kritik işlemlerde kim, ne zaman yaptı bilgisi" },
          ].map((f) => (
            <div key={f.k} className="py-6 pr-4">
              <dt className="text-sm font-semibold">{f.k}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{f.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* A day in the clinic */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Klinikte sıradan bir salı
          </h2>
          <p className="mt-4 max-w-sm text-muted-foreground">
            Aynı hasta sabah takvimde, öğlen hasta kartında, akşam kasada. Kimse bilgiyi bir
            yerden başka bir yere taşımak zorunda kalmaz.
          </p>
        </div>
        <ol className="relative border-l border-border">
          {DAY.map((d, i) => (
            <li key={d.time + d.who} className={`relative pl-8 ${i === DAY.length - 1 ? "" : "pb-9"}`}>
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-background bg-brand ring-1 ring-brand/40" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm tabular-nums text-muted-foreground">{d.time}</span>
                <span className="text-sm font-semibold">{d.who}</span>
              </div>
              <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-foreground/85">{d.what}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Modules */}
      <ModuleRow
        id="dental"
        index="01"
        name="Dental"
        title="Hasta kartı, diş şeması ve takvim aynı yerde"
        body="Doktorun önerdiği tedavi, sekreterin verdiği randevu ve hastanın geçmişi tek kartta birikir."
        points={[
          "Doktor bazlı renkli takvim; sürükle-bırak ile yeniden planlama",
          "Sürekli ve süt dişleri için tıklanabilir diş şeması",
          "Önerilen, onaylanan ve tamamlanan tedaviler ayrı ayrı izlenir",
          "Tek seferde 50 hastaya kadar toplu kayıt",
        ]}
        mock={<PatientCardMock />}
      />
      <ModuleRow
        id="muhasebe"
        index="02"
        name="Muhasebe"
        title="Kasa, taksitler ve hekim hakedişleri"
        body="Günlük kasadan şubeler arası rapora kadar kliniğin parası nereye gidiyor, açıkça görünür."
        points={[
          "Nakit, kredi kartı ve havale bazında günlük kasa",
          "Taksit sayısı ve tutarı düzenlenebilen ödeme planları",
          "Hekim başı hakediş ve geciken tahsilat listesi",
          "Şubeleri yan yana karşılaştıran raporlar",
        ]}
        mock={<CashMock />}
        reverse
      />
      <ModuleRow
        id="laboratuvar"
        index="03"
        name="Laboratuvar"
        title="Klinikten gelen işler ve alacaklar"
        body="Laboratuvarlar çalıştıkları klinikleri, gelen işleri ve tahsilatları kendi panelinden yönetir."
        points={[
          "Klinik ve hasta bazında iş kaydı",
          "Her kliniğin ödemesini ayrı takip",
          "Kasa ve dönemsel raporlar",
        ]}
        mock={<LabMock />}
      />

      {/* Roles */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            Herkes kendi işini görür, fazlasını değil
          </h2>
          <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.name} className="border-t border-foreground/80 pt-4">
                <dt className="font-semibold">{r.name}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{r.desc}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-12 max-w-2xl text-sm text-muted-foreground">
            Her klinik kendi organizasyon alanında çalışır; veriler başka kliniklerle karışmaz.
            Ödeme planı onayı, taksit düzenleme ve hasta silme gibi işlemler denetim kaydına
            düşer, giriş denemeleri kötüye kullanıma karşı sınırlandırılır.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="max-w-xl text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Kliniğinizi bir sonraki salıdan önce taşıyalım.
            </h2>
            <p className="mt-3 max-w-lg text-background/70">
              Modülleri ayrı ayrı ya da birlikte kullanın, dilediğiniz zaman yükseltin. Merak
              ettikleriniz için{" "}
              <Link href="/sss" className="underline underline-offset-4 hover:text-background">
                sık sorulan sorular
              </Link>
              .
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="self-start md:self-auto"
            nativeButton={false}
            render={<Link href={PRIMARY_HREF} />}
          >
            {PRIMARY_LABEL}
          </Button>
        </div>
      </section>
    </div>
  );
}
