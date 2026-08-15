import type { ConsentTemplate } from "@/lib/dental/consent-form-templates";

type PatientInfo = {
  fullName: string;
  tcKimlikNo: string | null;
  birthDate: string | Date | null;
  phone: string;
  primaryDoctor?: { user: { name: string } } | null;
};

type BranchInfo = { name: string; address: string | null; phone: string | null } | null | undefined;

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(date));
}

// The printable document itself — deliberately styled in fixed light
// colors (not theme tokens) since it represents a physical paper form
// regardless of the app's current theme, on screen or on paper.
export function ConsentFormPrintView({
  organizationName,
  branch,
  patient,
  template,
}: {
  organizationName: string;
  branch: BranchInfo;
  patient: PatientInfo;
  template: ConsentTemplate;
}) {
  return (
    <div className="mx-auto max-w-3xl rounded-md border border-neutral-300 bg-white p-8 text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="mb-6 flex items-start justify-between border-b-2 border-neutral-900 pb-3">
        <div>
          <p className="text-lg font-bold">{organizationName}</p>
          {branch && (
            <p className="text-xs text-neutral-600">
              {branch.name}
              {branch.address && ` · ${branch.address}`}
              {branch.phone && ` · ${branch.phone}`}
            </p>
          )}
        </div>
        <p className="text-right text-[10px] text-neutral-500">
          Form Tarihi
          <br />
          {formatDate(new Date())}
        </p>
      </header>

      <h1 className="mb-4 text-center text-base font-bold uppercase tracking-wide">{template.title}</h1>

      <section className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-neutral-300 p-3 text-xs">
        <p>
          <span className="font-medium">Hasta Adı Soyadı:</span> {patient.fullName}
        </p>
        <p>
          <span className="font-medium">T.C. Kimlik No:</span> {patient.tcKimlikNo || "—"}
        </p>
        <p>
          <span className="font-medium">Doğum Tarihi:</span> {patient.birthDate ? formatDate(patient.birthDate) : "—"}
        </p>
        <p>
          <span className="font-medium">Telefon:</span> {patient.phone}
        </p>
        <p className="col-span-2">
          <span className="font-medium">Tedaviyi Uygulayacak Hekim:</span> {patient.primaryDoctor?.user.name ?? "—"}
        </p>
      </section>

      <div className="space-y-3.5">
        {template.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-800">{section.heading}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line text-xs leading-relaxed text-neutral-800">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-10 text-xs">
        <div>
          <p className="mb-10 font-medium">Hasta / Veli-Vasi Adı Soyadı, İmza, Tarih</p>
          <div className="border-t border-neutral-400" />
        </div>
        <div>
          <p className="mb-10 font-medium">Hekim Adı Soyadı, İmza, Tarih</p>
          <div className="border-t border-neutral-400" />
        </div>
      </div>
    </div>
  );
}
