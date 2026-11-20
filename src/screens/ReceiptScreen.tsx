import { useRef, useState } from 'react';
import {
  FileUp,
  CheckCircle2,
  Clock,
  FileText,
  Eye,
  Sparkles,
  AlertTriangle,
  X,
  ArrowRight,
} from 'lucide-react';
import { ReceiptInspectModal } from '../components/ReceiptInspectModal';
import { periodFromIsoDate } from '../lib/payments';
import { PaymentStatus, RentIncreaseRecord, RentReceipt, ScreenId } from '../types/kiracimkim';

interface ReceiptScreenProps {
  receipts: RentReceipt[];
  rentIncreases: RentIncreaseRecord[];
  senderName: string;
  monthlyRent: number;
  onVerifyReceipt: (payload: {
    amount: number;
    period: string;
    paymentDate: string;
    file: File;
  }) => Promise<void> | void;
  onNavigate?: (screen: ScreenId) => void;
  onNotify: (message: string) => void;
  handoverApproved?: boolean;
}

function parseTrDateUtc(str?: string): number | null {
  if (!str) return null;
  const parts = str.split('.').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return Date.UTC(parts[2], parts[1] - 1, parts[0]);
}

// Delay is strictly calculated from bank transaction date (ocrDate / paidDate) vs dueDate,
// NEVER from landlord approval timestamp.
function getBankDelayDays(receipt: RentReceipt): number {
  const bankDateStr = receipt.ocrDate ?? receipt.paidDate;
  const bankMs = parseTrDateUtc(bankDateStr);
  const dueMs = parseTrDateUtc(receipt.dueDate);
  if (bankMs === null || dueMs === null) {
    return receipt.delayDays ?? 0;
  }
  return Math.max(0, Math.round((bankMs - dueMs) / 86400000));
}

function formatShortPeriod(periodLabel: string): string {
  return periodLabel.split(' → ')[0].replace(' Yenileme', '').replace(' Başlangıç Sözleşmesi', '');
}

function formatShortRate(rateLabel: string): string {
  return rateLabel.replace(/(\d+),(\d)\d+/, '$1,$2');
}

export function ReceiptScreen({
  receipts,
  rentIncreases,
  monthlyRent,
  onVerifyReceipt,
  onNavigate,
  onNotify,
  handoverApproved = false,
}: ReceiptScreenProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'Tümü' | Exclude<PaymentStatus, 'Dekont Bekleniyor'>
  >('Tümü');

  const [amount, setAmount] = useState<string>(String(monthlyRent));
  const [paidDate, setPaidDate] = useState<string>('2026-12-03');
  const [period, setPeriod] = useState(periodFromIsoDate('2026-12-03'));
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [inspectedReceipt, setInspectedReceipt] = useState<RentReceipt | null>(null);

  const hasFile = Boolean(uploadedFile);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' ₺';

  const handleFilePicked = (file: File | undefined) => {
    if (!file) return;
    setUploadedFile(file);
    setAmount(String(monthlyRent));
    setPaidDate('2026-12-03');
    setPeriod(periodFromIsoDate('2026-12-03'));
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPreviewImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewImageUrl(undefined);
    }
    onNotify(`"${file.name}" seçildi. Tutar ve dönemi kontrol edip onaya gönderebilirsiniz.`);
  };

  const handleLoadSample = () => {
    const sample = new File(
      [`Kiracımkim örnek dekont\nDönem: Aralık 2026\nTutar: ${monthlyRent}`],
      'aralik_2026_kira_dekont.txt',
      { type: 'text/plain' }
    );
    setUploadedFile(sample);
    setPreviewImageUrl(undefined);
    setAmount(String(monthlyRent));
    setPaidDate('2026-12-03');
    setPeriod('Aralık 2026');
    onNotify('Aralık 2026 örnek kira dekontu hazır.');
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setPreviewImageUrl(undefined);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedFile || sending) return;

    const numericAmount = Number(amount.replace(/[^\d.]/g, '')) || monthlyRent;
    const cleanPeriod = period.trim();
    if (!cleanPeriod) {
      onNotify('Lütfen ödeme dönemini yazın.');
      return;
    }

    setSending(true);
    try {
      await onVerifyReceipt({
        amount: numericAmount,
        period: cleanPeriod,
        paymentDate: paidDate,
        file: uploadedFile,
      });
      setUploadedFile(null);
      setPreviewImageUrl(undefined);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Dekont gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  // Right card shows only past/submitted months (excludes "Dekont Bekleniyor")
  const historyReceipts = receipts.filter((r) => r.status !== 'Dekont Bekleniyor');
  const approvedCount = historyReceipts.filter((r) => r.status === 'Onaylandı').length;
  const waitingCount = historyReceipts.filter(
    (r) => r.status === 'Ev Sahibi Onayı Bekliyor'
  ).length;

  const totalPeriodCount = Math.max(1, receipts.length);
  const progressPercent = Math.min(100, Math.round((approvedCount / totalPeriodCount) * 100));

  const filteredReceipts =
    statusFilter === 'Tümü'
      ? historyReceipts
      : historyReceipts.filter((r) => r.status === statusFilter);

  const renderStatusMeta = (receipt: RentReceipt) => {
    const bankDate = receipt.ocrDate ?? receipt.paidDate ?? '';
    const bankDelay = getBankDelayDays(receipt);

    switch (receipt.status) {
      case 'Onaylandı':
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Onaylı Ödeme</span>
            </span>
            {bankDate ? (
              <span className={bankDelay > 0 ? 'text-amber-700' : 'text-slate-500'}>
                {bankDelay > 0 ? `${bankDelay} gün gecikme (${bankDate})` : bankDate}
              </span>
            ) : null}
          </span>
        );
      case 'Ev Sahibi Onayı Bekliyor':
        return (
          <span className="inline-flex items-center gap-1 font-medium text-[#0B192C]">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>
              {bankDelay > 0
                ? `Ev Sahibi Onayı Bekliyor • ${bankDelay} gün gecikme (${bankDate})`
                : `Ev Sahibi Onayı Bekliyor • ${bankDate}`}
            </span>
          </span>
        );
      case 'İtirazlı':
        return (
          <span className="inline-flex items-center gap-1 font-medium text-rose-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              İtirazlı{receipt.objectionNote ? ` • ${receipt.objectionNote}` : ''}
            </span>
          </span>
        );
      default:
        return null;
    }
  };

  if (!handoverApproved) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-10 text-center shadow-sm">
          <p className="text-base sm:text-lg font-display font-bold text-[#0B192C] leading-relaxed">
            Kira ödemelerine geçmek için önce ev sahibinizin Teslim Tutanağını onaylaması
            bekleniyor
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.('handover')}
            className="mt-6 min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl"
          >
            Teslim Tutanağına Git
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header with Clear Value Proposition */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight">
            Kira Ödemelerin ve Ödeme Sicilin
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 max-w-2xl">
            Onaylanan her dekont Güven Karnene işlenir; yeni evini tutarken düzenli ödeme
            disiplinini kanıtlamanı sağlar.
          </p>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono-tabular shrink-0">
          <div>
            <span className="text-slate-500 text-xs block">Onaylandı</span>
            <span className="font-semibold text-emerald-700">
              {approvedCount} / {historyReceipts.length} Ay
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-slate-500 text-xs block">Onay Bekleyen</span>
            <span className="font-semibold text-[#0B192C]">{waitingCount} Adet</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Starts directly with Receipt Upload + Compact Rent Increase History (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 2-Step Rent Receipt Upload Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-emerald-700">
                {hasFile ? 'Adım 2 / 2 · Bilgileri Onayla' : 'Adım 1 / 2 · Dekont Seç'}
              </span>
              {!hasFile && (
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="min-h-[36px] px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Örnek Dekont Doldur</span>
                </button>
              )}
            </div>

            <h2 className="mt-1 text-lg font-display font-bold text-[#0B192C]">
              Aralık 2026 Kira Dekontunu Yükle (PDF / Görsel)
            </h2>

            {/* Step 1: Dropzone */}
            {!hasFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilePicked(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`mt-4 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isDragging
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-[#0B192C]/40 bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => handleFilePicked(e.target.files?.[0])}
                  className="hidden"
                />
                <FileUp className="w-8 h-8 mx-auto mb-2.5 text-[#0B192C]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#0B192C]">
                  Dekont Dosyasını Seçin veya Sürükleyin
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF, JPG veya PNG formatında kira dekontu
                </p>
              </div>
            ) : (
              /* Step 2: Auto-read OCR confirmation & Send to Landlord */
              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[#0B192C] truncate">
                      {uploadedFile?.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    aria-label="Seçilen dekontu kaldır"
                    className="min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-500 hover:text-rose-700 rounded-lg"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="receipt-amount"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Tutar (₺)
                    </label>
                    <input
                      id="receipt-amount"
                      type="number"
                      min={100}
                      step="50"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      Parçalı ödemeler için düzenlenebilir
                    </span>
                  </div>

                  <div>
                    <label
                      htmlFor="receipt-date"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Tarih
                    </label>
                    <input
                      id="receipt-date"
                      type="date"
                      value={paidDate}
                      onChange={(e) => {
                        setPaidDate(e.target.value);
                        if (e.target.value) setPeriod(periodFromIsoDate(e.target.value));
                      }}
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="receipt-period"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Dönem
                    </label>
                    <input
                      id="receipt-period"
                      type="text"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      placeholder="Örn. Aralık 2026"
                      className="w-full min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl px-3.5 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Alıcı IBAN Sözleşmeyle Eşleşti</span>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="w-full min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{sending ? 'Gönderiliyor…' : 'Ev Sahibi Onayına Gönder'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Compact Kira Artış Geçmişi Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-display font-bold text-[#0B192C]">
              Kira Artış Geçmişi
            </h2>

            <div className="mt-3 divide-y divide-slate-100">
              {rentIncreases.map((inc) => (
                <p
                  key={inc.id}
                  className="py-2.5 first:pt-0 last:pb-0 text-xs sm:text-sm font-mono-tabular text-[#0B192C]"
                >
                  <span className="font-semibold">{formatShortPeriod(inc.periodLabel)}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">
                    •
                  </span>
                  <span>
                    {inc.previousRent.toLocaleString('tr-TR')} ₺ →{' '}
                    {inc.newRent.toLocaleString('tr-TR')} ₺
                  </span>{' '}
                  <span className="font-semibold text-emerald-700">
                    ({formatShortRate(inc.rateLabel)})
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Right Card: Clean Past Payments Archive (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-display font-bold text-[#0B192C]">
                Geçmiş Kira Ödemeleri
              </h2>

              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-xs font-mono-tabular font-semibold text-emerald-700 whitespace-nowrap">
                {approvedCount} / {receipts.length} Onaylı
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(
                ['Tümü', 'Ev Sahibi Onayı Bekliyor', 'Onaylandı', 'İtirazlı'] as const
              ).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab
                      ? 'bg-white text-[#0B192C] shadow-sm'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 mt-2">
            {filteredReceipts.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Bu filtrede gösterilecek ödeme kaydı bulunmuyor.
              </p>
            ) : (
              filteredReceipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        receipt.status === 'Onaylandı'
                          ? 'bg-emerald-50 text-emerald-700'
                          : receipt.status === 'İtirazlı'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#0B192C]">{receipt.monthLabel}</p>
                      <div className="mt-1 text-xs font-mono-tabular">
                        {renderStatusMeta(receipt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-13 sm:pl-0">
                    <span className="text-sm font-bold font-mono-tabular text-[#0B192C] whitespace-nowrap">
                      {formatCurrency(receipt.amount)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setInspectedReceipt(receipt)}
                      className="min-h-[40px] px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>İncele</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Compact Trust Card Progress Row */}
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0B192C] font-mono-tabular">
                Güven Karnesi Katkısı: {approvedCount} / {receipts.length} Ay Doğrulanmış Ödeme
              </span>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('trust-card')}
                  className="font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 self-start sm:self-auto"
                >
                  <span>Karnemi Gör</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div
              className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={approvedCount}
              aria-valuemin={0}
              aria-valuemax={receipts.length}
              aria-label="Güven Karnesi Doğrulanmış Ödeme İlerlemesi"
            >
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {inspectedReceipt && (
        <ReceiptInspectModal
          receipt={inspectedReceipt}
          onClose={() => setInspectedReceipt(null)}
        />
      )}
    </section>
  );
}
