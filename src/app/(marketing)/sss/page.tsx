import type { Metadata } from "next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_ITEMS } from "@/lib/faq-data";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular",
  description: `${brand.name} hakkında merak edilenler: fiyatlandırma, roller, güvenlik, ödeme planları ve daha fazlası.`,
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sıkça Sorulan Sorular</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Aradığınız cevabı bulamadınız mı? Bizimle iletişime geçin.
        </p>
      </div>

      <Accordion className="w-full">
        {FAQ_ITEMS.map((item, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
