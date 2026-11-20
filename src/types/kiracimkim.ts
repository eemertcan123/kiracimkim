export type TenantScreenId = 'login' | 'handover' | 'receipts' | 'trust-card';
export type LandlordScreenId =
  | 'landlord-handover'
  | 'landlord-payments'
  | 'landlord-candidates';

export type ScreenId = TenantScreenId | LandlordScreenId;

export type UserRole = 'tenant' | 'landlord';

export type RoomId = 'salon' | 'mutfak' | 'yatak-odasi' | 'banyo' | 'sayaclar';

export interface HandoverPhoto {
  id: string;
  roomId: RoomId;
  roomLabel: string;
  imageUrl: string;
  closeUpImageUrl?: string;
  capturedAt: string;
  location: string;
  condition: 'hasarsiz' | 'kusurlu';
  note: string;
  hash: string;
}

export interface RoomDefinition {
  id: RoomId;
  label: string;
  requiredCount: number;
  guidance: string;
}

export type LandlordReviewStatus = 'pending' | 'approved' | 'objected';

export interface HandoverChecklistState {
  electricMeterNo: string;
  electricMeterPhoto?: string;
  waterMeterNo: string;
  waterMeterPhoto?: string;
  gasMeterNo: string;
  gasMeterPhoto?: string;
  keysCount: number;
  sealed: boolean;
  sealedAt?: string;
  sealHash?: string;
  landlordStatus: LandlordReviewStatus;
  landlordNote?: string;
  landlordReviewedAt?: string;
}

export type PaymentStatus =
  | 'Dekont Bekleniyor'
  | 'Ev Sahibi Onayı Bekliyor'
  | 'Onaylandı'
  | 'İtirazlı';

export interface RentReceipt {
  id: string;
  propertyId?: string;
  propertyNickname?: string;
  monthLabel: string;
  year: number;
  type: 'Kira Bedeli' | 'Aidat';
  amount: number;
  dueDate: string;
  paidDate?: string;
  delayDays?: number;
  status: PaymentStatus;
  iban: string;
  ibanMatched: boolean;
  senderName: string;
  ocrAmount?: string;
  ocrDate?: string;
  sha256Hash?: string;
  fileName?: string;
  previewImageUrl?: string;
  fileUrl?: string;
  tenantId?: string;
  landlordApprovedAt?: string;
  objectionNote?: string;
}

export interface RentIncreaseRecord {
  id: string;
  periodLabel: string;
  previousRent: number;
  newRent: number;
  rateLabel: string;
  legalBasis: string;
}

export interface ReferenceCriteriaRatings {
  paymentDiscipline: 'Eksiksiz & Zamanında' | 'Kısmi Gecikmeli' | 'Düzensiz';
  propertyCondition: 'Hasarsız & Temiz' | 'Olağan Kullanım İzi' | 'Onarım Gerektirdi';
  communication: 'Şeffaf & Ulaşılabilir' | 'Orta Düzey' | 'Zor İletişim';
  contractCompliance: 'Sözleşmeye Tam Uyum' | 'Küçük İhlaller' | 'Uyumsuz';
}

export interface LandlordReference {
  landlordName: string;
  districtLabel: string;
  criteria: ReferenceCriteriaRatings;
  comment: string;
  signedAt: string;
  signatureHash: string;
  verified: boolean;
  tenantReply?: string;
  tenantRepliedAt?: string;
}

export interface CandidateProfile {
  tenantId?: string;
  code: string;
  maskedName: string;
  maskedDistrict: string;
  isFirstRental?: boolean;
  transparentEntryPledged?: boolean;
  verifiedPaymentsSummary: string;
  delayDetails: string;
  handoverCountText: string;
  referenceCountText: string;
  eDevletVerified: boolean;
  previousLandlordNote: string;
}

export interface PendingTenantInvite {
  fullName?: string;
  phone: string;
  maskedPhone: string;
  invitedAt: string;
}

export interface LandlordProperty {
  id: string;
  nickname: string; // Sadece Ev Sahibi panelinde görünür
  officialLocation: string; // Sistem doğrulamalı resmi bölge (örn. Kadıköy / Caferağa)
  fullAddress: string;
  tenantName: string | null;
  tenantMaskedName: string | null;
  pendingInvite?: PendingTenantInvite | null;
  iban: string;
  contractStartDate: string;
  monthlyRent: number;
  verificationStatus: 'verified' | 'draft_pending_otp';
  verificationDocName?: string;
  photos: HandoverPhoto[];
  checklist: HandoverChecklistState;
  receipts: RentReceipt[];
  rentIncreases: RentIncreaseRecord[];
  reference: LandlordReference | null;
  rentalId?: string | null;
  rentalStatus?: string | null;
  tenantSubmitted?: boolean;
  landlordUserId?: string | null;
}

export function formatMaskedPhone(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/\D/g, '');
  let normalized = digitsOnly;
  if (normalized.startsWith('90') && normalized.length === 12) {
    normalized = '0' + normalized.slice(2);
  } else if (normalized.startsWith('5') && normalized.length === 10) {
    normalized = '0' + normalized;
  }
  if (normalized.length === 11) {
    return `${normalized.slice(0, 4)} ••• ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
  }
  if (normalized.length >= 7) {
    return `${normalized.slice(0, 4)} ••• ${normalized.slice(-4, -2)} ${normalized.slice(-2)}`;
  }
  return rawPhone.trim();
}

export const TR_LOCATION_TREE: Record<string, Record<string, string[]>> = {
  İstanbul: {
    Kadıköy: ['Caferağa Mah.', 'Suadiye Mah.', 'Moda Mah.', 'Fenerbahçe Mah.', 'Bostancı Mah.'],
    Beşiktaş: ['Levent Mah.', 'Etiler Mah.', 'Bebek Mah.', 'Ortaköy Mah.', 'Dikilitaş Mah.'],
    Ataşehir: ['Barbaros Mah.', 'Atatürk Mah.', 'Küçükbakkalköy Mah.', 'İçerenköy Mah.'],
    Şişli: ['Teşvikiye Mah.', 'Meşrutiyet Mah.', 'Fulya Mah.', 'Esentepe Mah.'],
  },
  Ankara: {
    Çankaya: ['Ayrancı Mah.', 'Bahçelievler Mah.', 'Kavaklıdere Mah.', 'Ümitköy Mah.'],
    Yenimahalle: ['Batıkent Mah.', 'Demetevler Mah.', 'Yaşamkent Mah.'],
  },
  İzmir: {
    Karşıyaka: ['Bostanlı Mah.', 'Mavişehir Mah.', 'Alaybey Mah.'],
    Konak: ['Alsancak Mah.', 'Güzelyalı Mah.', 'Göztepe Mah.'],
  },
};

export interface ActivityEvent {
  id: string;
  timestamp: string;
  actorName: string;
  propertyId: string;
  propertyNickname: string;
  description: string;
  actionLabel: string;
  targetScreen: LandlordScreenId;
  candidateCode?: string;
  receiptId?: string;
}

export interface UserSession {
  authenticated: boolean;
  userId: string;
  fullName: string;
  maskedName: string;
  phone: string;
  role: UserRole;
  verifiedViaEDevlet: boolean;
  activeTenantPropertyId: string;
  carnetCode: string;
}

export const ROOM_DEFINITIONS: RoomDefinition[] = [
  {
    id: 'salon',
    label: 'Salon',
    requiredCount: 2,
    guidance: 'Zemin parkesi, pencere doğramaları ve duvar boyasını geniş açıdan çekin.',
  },
  {
    id: 'mutfak',
    label: 'Mutfak',
    requiredCount: 2,
    guidance: 'Tezgah yüzeyi, eviye bataryası, ankastre ve dolap kapaklarını görüntüleyin.',
  },
  {
    id: 'yatak-odasi',
    label: 'Yatak Odası',
    requiredCount: 1,
    guidance: 'Gardırop kapakları, prizler ve tavan köşelerini net şekilde fotoğraflayın.',
  },
  {
    id: 'banyo',
    label: 'Banyo',
    requiredCount: 1,
    guidance: 'Duşakabin contaları, seramik derzleri ve tesisat akışını belgeleyin.',
  },
  {
    id: 'sayaclar',
    label: 'Sayaçlar',
    requiredCount: 1,
    guidance: 'Elektrik, su ve doğalgaz sayaç endekslerini okunaklı biçimde kaydedin.',
  },
];

export const INITIAL_PROPERTIES: LandlordProperty[] = [
  {
    id: 'prop-moda',
    nickname: 'Moda Sahil Dairesi 2+1',
    officialLocation: 'Kadıköy / Caferağa',
    fullAddress: 'Caferağa Mah. Moda Cad. No: 48 D: 6 · Kadıköy',
    tenantName: 'Ahmet Yılmaz',
    tenantMaskedName: 'Ahmet Y.',
    iban: 'TR42 0006 2000 4120 0006 2984 11',
    contractStartDate: '01.07.2025',
    monthlyRent: 24500,
    verificationStatus: 'verified',
    verificationDocName: 'tapu_kadikoy_caferaga.pdf',
    photos: [
      {
        id: 'ph-1',
        roomId: 'salon',
        roomLabel: 'Salon',
        imageUrl: '/src/assets/images/room_living_check_1794831352125.jpg',
        capturedAt: '01.08.2026 · 10:24',
        location: 'Kadıköy / Caferağa',
        condition: 'hasarsiz',
        note: 'Meşe parke zemin ve saten duvar boyası teslim anında temiz ve hasarsız.',
        hash: 'SHA256-9F4A18E2',
      },
      {
        id: 'ph-2',
        roomId: 'mutfak',
        roomLabel: 'Mutfak',
        imageUrl: '/src/assets/images/room_kitchen_check_1794831352502.jpg',
        capturedAt: '01.08.2026 · 10:31',
        location: 'Kadıköy / Caferağa',
        condition: 'hasarsiz',
        note: 'Granit tezgah, ankastre ocak ve eviye bataryası çalışır durumda.',
        hash: 'SHA256-3C7B91D0',
      },
    ],
    checklist: {
      electricMeterNo: '14.820 kWh',
      waterMeterNo: '412 m³',
      gasMeterNo: '1.290 m³',
      keysCount: 3,
      sealed: false,
      landlordStatus: 'pending',
    },
    receipts: [
      {
        id: 'rc-2026-11',
        monthLabel: 'Kasım 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.11.2026',
        paidDate: '04.11.2026',
        status: 'Ev Sahibi Onayı Bekliyor',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Ahmet Yılmaz',
        ocrAmount: '24.500,00 ₺',
        ocrDate: '04.11.2026',
        sha256Hash: 'sha256:4a91f30c...8e12b7',
        fileName: 'kasim_2026_kira_dekont.pdf',
      },
      {
        id: 'rc-2026-10',
        monthLabel: 'Ekim 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.10.2026',
        paidDate: '03.10.2026',
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Ahmet Yılmaz',
        ocrAmount: '24.500,00 ₺',
        ocrDate: '03.10.2026',
        sha256Hash: 'sha256:9f82c1a4...e71b09',
        fileName: 'ekim_2026_kira_dekont.pdf',
        landlordApprovedAt: '04.10.2026 · 11:20',
      },
      {
        id: 'rc-2026-09',
        monthLabel: 'Eylül 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.09.2026',
        paidDate: '02.09.2026',
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Ahmet Yılmaz',
        ocrAmount: '24.500,00 ₺',
        ocrDate: '02.09.2026',
        sha256Hash: 'sha256:7d14e22b...31a0c4',
        fileName: 'eylul_2026_kira_dekont.pdf',
        landlordApprovedAt: '03.09.2026 · 09:45',
      },
      {
        id: 'rc-2026-08',
        monthLabel: 'Ağustos 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.08.2026',
        paidDate: '09.08.2026',
        delayDays: 4,
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Ahmet Yılmaz',
        ocrAmount: '24.500,00 ₺',
        ocrDate: '09.08.2026',
        sha256Hash: 'sha256:2b65a91f...c049e1',
        fileName: 'agustos_2026_kira_dekont.pdf',
        landlordApprovedAt: '10.08.2026 · 14:12',
      },
      {
        id: 'rc-2026-07',
        monthLabel: 'Temmuz 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.07.2026',
        paidDate: '08.07.2026',
        delayDays: 3,
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Ahmet Yılmaz',
        ocrAmount: '24.500,00 ₺',
        ocrDate: '08.07.2026',
        sha256Hash: 'sha256:6e30d84a...99b2f5',
        fileName: 'temmuz_2026_kira_dekont.pdf',
        landlordApprovedAt: '08.07.2026 · 18:05',
      },
      {
        id: 'rc-2026-12',
        monthLabel: 'Aralık 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 24500,
        dueDate: '05.12.2026',
        status: 'Dekont Bekleniyor',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: false,
        senderName: 'Ahmet Yılmaz',
      },
    ],
    rentIncreases: [
      {
        id: 'inc-2025',
        periodLabel: 'Temmuz 2025 Yenileme',
        previousRent: 18500,
        newRent: 24500,
        rateLabel: '+%32,43',
        legalBasis: '12 Aylık TÜFE Ortalaması Sözleşme Artışı',
      },
      {
        id: 'inc-2026',
        periodLabel: 'Temmuz 2026 → Temmuz 2027',
        previousRent: 24500,
        newRent: 31000,
        rateLabel: '+%26,53',
        legalBasis: 'Karşılıklı Onaylı Kira Yenileme Dönemi',
      },
    ],
    reference: {
      landlordName: 'Selim Karahan',
      districtLabel: 'Mülk Sahibi · Kadıköy / Caferağa',
      criteria: {
        paymentDiscipline: 'Eksiksiz & Zamanında',
        propertyCondition: 'Hasarsız & Temiz',
        communication: 'Şeffaf & Ulaşılabilir',
        contractCompliance: 'Sözleşmeye Tam Uyum',
      },
      comment:
        '24 aylık sözleşme süresince tüm kira ve aidat ödemeleri düzenli yatırıldı. Çıkış teslim tutanağında daireyi teslim aldığı kondisyonda ve hasarsız şekilde teslim etti.',
      signedAt: '15.07.2026',
      signatureHash: 'KMK-OTP-7821A',
      verified: true,
    },
  },
  {
    id: 'prop-bagdat',
    nickname: 'Bağdat Cad. 3+1',
    officialLocation: 'Kadıköy / Suadiye',
    fullAddress: 'Suadiye Mah. Bağdat Cad. No: 312 D: 9 · Kadıköy',
    tenantName: 'Zeynep Demirci',
    tenantMaskedName: 'Zeynep D.',
    iban: 'TR42 0006 2000 4120 0006 2984 11',
    contractStartDate: '01.10.2026',
    monthlyRent: 38000,
    verificationStatus: 'verified',
    verificationDocName: 'dask_suadiye_2026.pdf',
    photos: [
      {
        id: 'ph-bg-1',
        roomId: 'salon',
        roomLabel: 'Salon',
        imageUrl: '/src/assets/images/hero_trust_residence_1794831351232.jpg',
        capturedAt: '15.11.2026 · 09:42',
        location: 'Kadıköy / Suadiye',
        condition: 'hasarsiz',
        note: 'Geniş salon parkeleri ve balkon cam doğramaları sağlam teslim edildi.',
        hash: 'SHA256-5A18D201',
      },
      {
        id: 'ph-bg-2',
        roomId: 'mutfak',
        roomLabel: 'Mutfak',
        imageUrl: '/src/assets/images/room_kitchen_check_1794831352502.jpg',
        capturedAt: '15.11.2026 · 09:45',
        location: 'Kadıköy / Suadiye',
        condition: 'hasarsiz',
        note: 'Mutfak dolapları ve ankastre set yeni teslim edildi.',
        hash: 'SHA256-8E24B91C',
      },
    ],
    checklist: {
      electricMeterNo: '04.110 kWh',
      waterMeterNo: '118 m³',
      gasMeterNo: '340 m³',
      keysCount: 4,
      sealed: true,
      sealedAt: '15.11.2026 · 09:45',
      sealHash: 'KMK-TT-2026-44C2',
      landlordStatus: 'approved',
      landlordReviewedAt: '15.11.2026 · 11:10',
    },
    receipts: [
      {
        id: 'rc-bg-2026-11',
        monthLabel: 'Kasım 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 38000,
        dueDate: '05.11.2026',
        paidDate: '01.11.2026',
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Zeynep Demirci',
        ocrAmount: '38.000,00 ₺',
        ocrDate: '01.11.2026',
        sha256Hash: 'sha256:8c12f41b...91a4d2',
        fileName: 'kasim_2026_suadiye_dekont.pdf',
        landlordApprovedAt: '02.11.2026 · 10:15',
      },
      {
        id: 'rc-bg-2026-10',
        monthLabel: 'Ekim 2026',
        year: 2026,
        type: 'Kira Bedeli',
        amount: 38000,
        dueDate: '05.10.2026',
        paidDate: '01.10.2026',
        status: 'Onaylandı',
        iban: 'TR42 0006 2000 4120 0006 2984 11',
        ibanMatched: true,
        senderName: 'Zeynep Demirci',
        ocrAmount: '38.000,00 ₺',
        ocrDate: '01.10.2026',
        sha256Hash: 'sha256:1b48e90c...54f1a8',
        fileName: 'ekim_2026_suadiye_dekont.pdf',
        landlordApprovedAt: '01.10.2026 · 16:40',
      },
    ],
    rentIncreases: [
      {
        id: 'inc-bg-2026',
        periodLabel: 'Ekim 2026 Başlangıç Sözleşmesi',
        previousRent: 38000,
        newRent: 38000,
        rateLabel: 'İlk Yıl',
        legalBasis: 'Yeni 12 Aylık Kira Sözleşmesi',
      },
    ],
    reference: null,
  },
  {
    id: 'prop-atasehir',
    nickname: 'Ataşehir Rezidans 1+1',
    officialLocation: 'Ataşehir / Barbaros',
    fullAddress: 'Barbaros Mah. Ihlamur Bulvarı No: 14 D: 22 · Ataşehir',
    tenantName: null,
    tenantMaskedName: null,
    iban: 'TR42 0006 2000 4120 0006 2984 11',
    contractStartDate: '01.12.2026',
    monthlyRent: 29000,
    verificationStatus: 'draft_pending_otp',
    photos: [],
    checklist: {
      electricMeterNo: '00.410 kWh',
      waterMeterNo: '024 m³',
      gasMeterNo: '085 m³',
      keysCount: 2,
      sealed: false,
      landlordStatus: 'pending',
    },
    receipts: [],
    rentIncreases: [],
    reference: null,
  },
];

export const INITIAL_ACTIVITIES: ActivityEvent[] = [
  {
    id: 'act-1',
    timestamp: '16.11.2026 • 14:20',
    actorName: 'Ahmet Yılmaz',
    propertyId: 'prop-moda',
    propertyNickname: 'Moda Sahil Dairesi 2+1',
    description: 'Kasım 2026 dekontunu yükledi',
    actionLabel: 'İncele & Onayla',
    targetScreen: 'landlord-payments',
    receiptId: 'rc-2026-11',
  },
  {
    id: 'act-2',
    timestamp: '15.11.2026 • 09:45',
    actorName: 'Zeynep Demirci',
    propertyId: 'prop-bagdat',
    propertyNickname: 'Bağdat Cad. 3+1',
    description: 'teslim tutanağına 2 fotoğraf ekledi',
    actionLabel: 'Tutanağa Git',
    targetScreen: 'landlord-handover',
  },
  {
    id: 'act-3',
    timestamp: '12.11.2026 • 18:10',
    actorName: 'Murat Kaya (Aday)',
    propertyId: 'prop-atasehir',
    propertyNickname: 'Ataşehir Rezidans 1+1',
    description: 'için Güven Karnesini paylaştı',
    actionLabel: 'Karneyi Gör',
    targetScreen: 'landlord-candidates',
    candidateCode: 'KMK-2026-3921',
  },
];

export const SAMPLE_CANDIDATES: CandidateProfile[] = [
  {
    code: 'KMK-2026-5104',
    maskedName: 'Zeynep D.',
    maskedDistrict: 'Kadıköy / Suadiye',
    verifiedPaymentsSummary: '18/18 Ev Sahibi Onaylı Ödeme',
    delayDetails: '0 gecikme · Tüm ödemeler vade günü veya öncesinde',
    handoverCountText: '2 Zaman Damgalı Teslim Tutanağı',
    referenceCountText: '2 Doğrulanmış Ev Sahibi Referansı',
    eDevletVerified: true,
    previousLandlordNote:
      'Ödemelerini düzenli olarak ayın 1. gününde yaptı, daireyi boyalı ve eksiksiz teslim etti.',
  },
  {
    code: 'KMK-2026-3921',
    maskedName: 'Murat K.',
    maskedDistrict: 'Çankaya / Ayrancı',
    verifiedPaymentsSummary: '14/14 Ev Sahibi Onaylı Ödeme',
    delayDetails: '1 gecikme (2 gün · 07.04.2026)',
    handoverCountText: '1 Zaman Damgalı Teslim Tutanağı',
    referenceCountText: '1 Doğrulanmış Ev Sahibi Referansı',
    eDevletVerified: true,
    previousLandlordNote:
      'İletişimi güçlü, yalnızca 1 kez resmi tatil nedeniyle 2 gün gecikmeli ödeme bildirimi yaptı.',
  },
  {
    code: 'KMK-2026-1094',
    maskedName: 'Caner T.',
    maskedDistrict: 'İlk Kiralama',
    isFirstRental: true,
    transparentEntryPledged: true,
    verifiedPaymentsSummary: 'Şeffaf Giriş Taahhütlü Aday',
    delayDetails:
      'Henüz geçmiş sistem kaydı bulunmuyor; ancak eve girişte fotoğraflı teslim tutanağı tutmayı ve aylık kira dekontlarını onaylatmayı peşinen taahhüt etti.',
    handoverCountText: 'Giriş Tutanağı Taahhütlü',
    referenceCountText: 'İlk Kiralama (Geçmiş Kayıt Yok)',
    eDevletVerified: true,
    previousLandlordNote: '',
  },
];
