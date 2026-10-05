export const FAQ_ITEMS = [
  {
    question: "DişPanel tam olarak nedir?",
    answer:
      "Diş kliniklerinin hasta, randevu ve tedavi süreçlerini yönettiği Dental modülü ile kasa, ödeme planı ve hekim hakediş takibini yönettiği Muhasebe modülünü tek bir platformda birleştiren bir bulut yazılımıdır. İki modül birbirinden bağımsız da, birlikte de kullanılabilir.",
  },
  {
    question: "Dental ve Muhasebe modüllerini ayrı ayrı satın alabilir miyim?",
    answer:
      "Evet. Fiyatlandırma sayfamızda üç seçenek bulunur: yalnızca Dental, yalnızca Muhasebe veya ikisi bir arada. İhtiyacınız değiştikçe planınızı yükseltebilirsiniz.",
  },
  {
    question: "Birden fazla şubemiz var, sistem buna uygun mu?",
    answer:
      "Evet. Sistem çoklu şube yapısı için tasarlandı. Patron tüm şubeleri tek yerden görebilir, şube yöneticileri yalnızca kendi şubelerini yönetir; hasta, randevu ve kasa verileri şube bazında ayrışır.",
  },
  {
    question: "Doktor, sekreter ve şube yöneticisi farklı şeyler mi görüyor?",
    answer:
      "Evet. Her rolün (Patron, Şube Yöneticisi, Doktor, Sekreter) kendine özel yetkileri ve ekranları vardır — bir doktor yalnızca kendi hasta ve randevularını görürken, sekreter tüm doktorların takvimini görebilir, şube yöneticisi ayrıca raporlara erişebilir.",
  },
  {
    question: "Hastalarımızın verileri güvende mi?",
    answer:
      "Evet. Her klinik verisi diğer kliniklerden tamamen izole tutulur, tüm bağlantılar şifrelenir, kritik işlemler (ödeme planı onaylama, taksit düzenleme, hasta silme gibi) denetim kaydına düşer ve giriş denemeleri kötüye kullanıma karşı sınırlandırılır.",
  },
  {
    question: "Ödeme planı ve taksitlendirme nasıl çalışıyor?",
    answer:
      "Muhasebe modülünde bir hasta için toplam tutar ve taksit sayısı girilir, sistem otomatik olarak eşit taksitlere böler. Taksit sayısını veya bir taksitin tutarını sonradan değiştirdiğinizde, kalan taksitler otomatik olarak yeniden dağıtılır; daha önce elle düzenlediğiniz taksitler sabit kalır.",
  },
  {
    question: "Randevu takvimini nasıl kullanıyoruz?",
    answer:
      "Sürükle-bırak ile randevuları taşıyabilir, kenarından tutup süresini uzatıp kısaltabilir, takvimde boş bir alana tıklayarak yeni randevu oluşturabilirsiniz. Her doktorun randevuları kendi rengiyle gösterilir.",
  },
  {
    question: "Ücretsiz deneme veya iptal koşulları nedir?",
    answer:
      "Kayıt olduğunuzda seçtiğiniz plan hemen aktif olur. Aboneliğinizi dilediğiniz zaman yükseltebilir ya da bizimle iletişime geçerek iptal edebilirsiniz.",
  },
  {
    question: "Sistemi kullanmaya nasıl başlarız?",
    answer:
      "Fiyatlandırma sayfasından bir plan seçip birkaç dakikada kayıt oluşturursunuz. Ardından şubenizi, doktorlarınızı ve personelinizi Ayarlar sayfasından ekleyerek hemen kullanmaya başlayabilirsiniz.",
  },
  {
    question: "Bir sorun yaşarsak destek alabiliyor muyuz?",
    answer:
      "Evet, müşteri temsilcilerimiz talepleri yanıtlamak ve klinik hesabınızla ilgili sorunları çözmek için hazır bulunur.",
  },
] as const;
