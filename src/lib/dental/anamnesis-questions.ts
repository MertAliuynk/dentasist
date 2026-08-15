// Structured anamnez (medical history) questionnaire — replaces the old
// free-text "Anamnez" box in Hasta Ekle with the section/question-based
// format used by real dental practice-management software. The section
// grouping and question set are an original synthesis grounded in the ADA
// Health History Form's structure and Turkish clinical-context sources
// (systemic conditions/medications most relevant to dental treatment
// planning in Turkey), not a copy of any single source.

export type BooleanDetailAnswer = { value: "EVET" | "HAYIR" | "BILMIYOR"; detail?: string };
export type AnamnesisAnswerValue = BooleanDetailAnswer | string;
export type AnamnesisAnswers = Record<string, AnamnesisAnswerValue>;

export type AnamnesisQuestion =
  | { id: string; type: "boolean_detail"; label: string; detailPlaceholder?: string }
  | { id: string; type: "select"; label: string; options: string[] }
  | { id: string; type: "text"; label: string; placeholder?: string };

export type AnamnesisSection = {
  key: string;
  title: string;
  questions: AnamnesisQuestion[];
};

export const ANAMNESIS_SECTIONS: AnamnesisSection[] = [
  {
    key: "genel",
    title: "Genel Sağlık Durumu",
    questions: [
      { id: "genel_degerlendirme", type: "select", label: "Genel sağlık durumunuzu nasıl değerlendirirsiniz?", options: ["İyi", "Orta", "Kötü"] },
      { id: "doktor_takibi", type: "boolean_detail", label: "Şu anda bir hekim/doktor takibinde misiniz?", detailPlaceholder: "Hangi durum / hekim adı" },
    ],
  },
  {
    key: "sistemik",
    title: "Sistemik Hastalıklar",
    questions: [
      { id: "diyabet", type: "boolean_detail", label: "Diyabet (şeker hastalığı)" },
      { id: "hipertansiyon", type: "boolean_detail", label: "Hipertansiyon / düşük tansiyon" },
      { id: "kalp_hastaligi", type: "boolean_detail", label: "Kalp hastalığı (anjina, kalp krizi, kapak hastalığı, kalp pili vb.)" },
      { id: "romatizmal_ates", type: "boolean_detail", label: "Romatizmal ateş / romatizmal kalp hastalığı" },
      { id: "solunum", type: "boolean_detail", label: "Astım veya diğer solunum yolu hastalıkları (KOAH, bronşit vb.)" },
      { id: "bobrek", type: "boolean_detail", label: "Böbrek hastalığı" },
      { id: "karaciger_hepatit", type: "boolean_detail", label: "Karaciğer hastalığı / Hepatit (B, C) / Sarılık" },
      { id: "tiroid", type: "boolean_detail", label: "Tiroid hastalığı" },
      { id: "epilepsi", type: "boolean_detail", label: "Epilepsi / nöbet geçirme öyküsü" },
      { id: "kanama_bozuklugu", type: "boolean_detail", label: "Kanama bozukluğu / pıhtılaşma sorunu" },
      { id: "anemi", type: "boolean_detail", label: "Anemi (kansızlık)" },
      { id: "kanser", type: "boolean_detail", label: "Kanser / kemoterapi / radyoterapi öyküsü" },
      { id: "hiv", type: "boolean_detail", label: "HIV/AIDS" },
      { id: "osteoporoz", type: "boolean_detail", label: "Osteoporoz" },
      { id: "diger_sistemik", type: "text", label: "Yukarıdakiler dışında bildirmek istediğiniz bir hastalık/durum var mı?" },
    ],
  },
  {
    key: "ilaclar",
    title: "Kullanılan İlaçlar",
    questions: [
      { id: "surekli_ilac", type: "boolean_detail", label: "Düzenli kullandığınız bir ilaç var mı?", detailPlaceholder: "İlaç adı / dozu" },
      { id: "kan_sulandirici", type: "boolean_detail", label: "Kan sulandırıcı / antikoagülan ilaç kullanıyor musunuz? (Aspirin, Coumadin, Xarelto vb.)" },
      { id: "bifosfonat", type: "boolean_detail", label: "Bifosfonat grubu ilaç (osteoporoz ilacı) kullanıyor musunuz / kullandınız mı?" },
      { id: "kortizon", type: "boolean_detail", label: "Kortizon (kortikosteroid) kullanıyor musunuz?" },
    ],
  },
  {
    key: "alerjiler",
    title: "Alerjiler",
    questions: [
      { id: "ilac_alerjisi", type: "boolean_detail", label: "İlaç alerjiniz var mı?", detailPlaceholder: "İlaç adı" },
      { id: "penisilin_alerjisi", type: "boolean_detail", label: "Penisilin / diğer antibiyotiklere karşı alerjiniz var mı?" },
      { id: "lokal_anestezi_alerjisi", type: "boolean_detail", label: "Lokal anestezi maddelerine karşı alerji/reaksiyon yaşadınız mı?" },
      { id: "lateks_alerjisi", type: "boolean_detail", label: "Lateks alerjiniz var mı?" },
      { id: "gida_alerjisi", type: "boolean_detail", label: "Gıda alerjiniz var mı?", detailPlaceholder: "Gıda adı" },
    ],
  },
  {
    key: "kadin",
    title: "Kadın Hastalara Özel",
    questions: [
      { id: "hamilelik", type: "boolean_detail", label: "Hamile misiniz veya hamile olabilir misiniz?", detailPlaceholder: "Tahmini gebelik haftası (varsa)" },
      { id: "emzirme", type: "boolean_detail", label: "Emziriyor musunuz?" },
    ],
  },
  {
    key: "aliskanliklar",
    title: "Sigara / Alkol Kullanımı",
    questions: [
      { id: "sigara", type: "boolean_detail", label: "Sigara/tütün ürünü kullanıyor musunuz?", detailPlaceholder: "Günde kaç adet, kaç yıldır" },
      { id: "alkol", type: "select", label: "Alkol kullanım sıklığınız", options: ["Hiç", "Nadiren", "Haftada birkaç kez", "Her gün"] },
    ],
  },
  {
    key: "dis_hekimligi_gecmisi",
    title: "Diş Hekimliği ile İlgili Geçmiş",
    questions: [
      { id: "anestezi_reaksiyon", type: "boolean_detail", label: "Daha önce lokal anesteziye karşı olumsuz bir reaksiyon yaşadınız mı?" },
      { id: "asiri_kanama", type: "boolean_detail", label: "Geçmişte bir diş tedavisi sırasında/sonrasında aşırı kanama yaşadınız mı?" },
      { id: "dis_eti_kanamasi", type: "boolean_detail", label: "Diş eti kanaması oluyor mu (fırçalarken/kendiliğinden)?" },
      { id: "bruksizm", type: "boolean_detail", label: "Dişlerinizi gıcırdatıyor veya sıkıyor musunuz (bruksizm)?" },
      { id: "tme_rahatsizligi", type: "boolean_detail", label: "Çene ekleminizde (TME) ağrı, ses veya açma-kapama güçlüğü yaşıyor musunuz?" },
      { id: "mevcut_sikayet", type: "text", label: "Mevcut şikayetiniz nedir?" },
    ],
  },
];
