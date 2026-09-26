import type { LucideIcon } from "lucide-react";

export function PageStub({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full flex max-w-lg flex-col items-center py-24 text-center">
      <Icon className="mb-4 size-5 text-muted-foreground" strokeWidth={1.5} />
      <h1 className="text-sm font-medium">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs text-muted-foreground">Bu bölüm yakında burada olacak.</p>
    </div>
  );
}
