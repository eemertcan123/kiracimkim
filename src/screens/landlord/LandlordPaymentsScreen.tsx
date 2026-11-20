import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Eye,
  Bell,
  FileText,
  AlertTriangle,
  TrendingUp,
  MessageSquareWarning,
} from 'lucide-react';
import { ReceiptInspectModal } from '../../components/ReceiptInspectModal';
import { LandlordProperty, PaymentStatus, RentReceipt } from '../../types/kiracimkim';

interface LandlordPaymentsScreenProps {
  properties: LandlordProperty[];
  selectedPropertyId: string;
  focusedReceiptId: string | null;
  onClearFocusedReceipt: () => void;
  onApproveReceipt: (propertyId: string, receiptId: string) => void;
  onObjectReceipt: (propertyId: string, receiptId: string, reason: string) => void;
  onNotify: (message: string) => void;
}

interface ScopedReceipt extends RentReceipt {
  ownerPropertyId: string;
  ownerPropertyNickname: string;
}

export function LandlordPaymentsScreen({
  properties,
  selectedPropertyId,
  focusedReceiptId,
  onClearFocusedReceipt,
  onApproveReceipt,
  onObjectReceipt,
  onNotify,
}: LandlordPaymentsScreenProps) {
  const [statusFilter, setStatusFilter] = useState<'Tümü' | PaymentStatus>('Tümü');
  const [inspectedReceipt, setInspectedReceipt] = useState<ScopedReceipt | null>(null);
  const [inspectObjection, setInspectObjection] = useState(false);

  const scopedProperties =
    selectedPropertyId === 'all'
      ? properties
      : properties.filter((p) => p.id === selectedPropertyId);

  const allReceipts: ScopedReceipt[] = scopedProperties.flatMap((prop) =>
    prop.receipts.map((r) => ({
      ...r,
      ownerPropertyId: prop.id,
      ownerPropertyNickname: prop.nickname,
    }))
  );

  useEffect(() => {
    if (focusedReceiptId) {
      const target = allReceipts.find((r) => r.id === focusedReceiptId);
      if (target) {
        setInspectedReceipt(target);
      }
      onClearFocusedReceipt();
    }
  }, [focusedReceiptId]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val) + ' ₺';

  const formatCompactTag = (nickname: string, senderName: string) => {
    const shortProp = nickname
      .replace(' Sahil Dairesi', '')
      .replace(' Rezidans', '');
    const parts = senderName.trim().split(/\s+/);
    const shortName =
      parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : senderName;
    return `${shortProp} • ${shortName}`;
  };

  const approvedReceipts = allReceipts.filter((r) => r.status === 'Onaylandı');
  const awaitingApprovalCount = allReceipts.filter(
    (r) => r.status === 'Ev Sahibi Onayı Bekliyor'
  ).length;

  const filteredReceipts =
    statusFilter === 'Tümü'
      ? allReceipts
      : allReceipts.filter((r) => r.status === statusFilter);

  const scopedIncreases = scopedProperties.flatMap((prop) =>
    prop.rentIncreases.map((inc) => ({
      ...inc,
      propertyNickname: prop.nickname,
    }))
  );

  const activePropHeader =
    selectedPropertyId === 'all'
      ? `Tüm Mülkler (${properties.length} Daire)`
      : `${scopedProperties[0]?.nickname ?? ''} (${scopedProperties[0]?.officialLocation ?? ''})`;

  const formatIncreaseLine = (periodLabel: string, prevRent: number, newRent: number, rate: string) => {
    const monthYear = periodLabel.split(' ').slice(0, 2).join(' ');
    const compactRate = rate.replace(/,(\d)\d%/, ',$1%');
    return `${monthYear} • ${prevRent.toLocaleString('tr-TR')} ₺ → ${newRent.toLocaleString(
      'tr-TR'
    )} ₺ (${compactRate})`;
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
      {/* Clean Minimal Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <p className="text-xs font-medium text-emerald-700">Ödemeler · {activePropHeader}</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight">
            Ödeme Onayları ve Kira Artışları
          </h1>
        </div>

        <div className="flex items-center gap-5 text-sm font-mono-tabular shrink-0">
          <div>
            <span className="text-slate-500 text-xs block">Onaylı</span>
            <span className="font-semibold text-emerald-700">
              {approvedReceipts.length} / {allReceipts.length}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-slate-500 text-xs block">Onay Bekleyen</span>
            <span className="font-semibold text-[#0B192C]">{awaitingApprovalCount}</span>
          </div>
        </div>
      </div>

      {/* 2-Column Layout with Generous Spacing */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-start">
        {/* Left: Minimalist Payment List (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col gap-4 pb-5 border-b border-slate-100">
            <h2 className="text-lg font-display font-bold text-[#0B192C]">
              Aylık Dekontlar
            </h2>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(
                [
                  'Tümü',
                  'Ev Sahibi Onayı Bekliyor',
                  'Onaylandı',
                  'Dekont Bekleniyor',
                  'İtirazlı',
                ] as const
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

          {filteredReceipts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Seçili filtre veya mülk için ödeme kaydı bulunmuyor.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {filteredReceipts.map((receipt) => (
                <div
                  key={`${receipt.ownerPropertyId}-${receipt.id}`}
                  className="py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        receipt.status === 'Onaylandı'
                          ? 'bg-emerald-50 text-emerald-700'
                          : receipt.status === 'İtirazlı'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {receipt.status === 'Dekont Bekleniyor' ? (
                        <Clock className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <FileText className="w-5 h-5" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-sm font-bold text-[#0B192C]">
                          {receipt.monthLabel}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {formatCompactTag(receipt.ownerPropertyNickname, receipt.senderName)}
                        </span>
                        <span className="text-sm font-bold font-mono-tabular text-[#0B192C]">
                          {formatCurrency(receipt.amount)}
                        </span>
                      </div>

                      <div className="mt-1.5 text-xs font-mono-tabular">
                        {receipt.status === 'Onaylandı' && (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Onaylı Ödeme</span>
                            </span>
                            <span className="font-medium text-slate-500">
                              {receipt.paidDate}
                              {receipt.delayDays ? ` (${receipt.delayDays} gün gecikme)` : ''}
                            </span>
                          </span>
                        )}

                        {receipt.status === 'Ev Sahibi Onayı Bekliyor' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-[#0B192C]">
                            <Clock
                              className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Ev Sahibi Onayı Bekliyor · {receipt.paidDate}</span>
                          </span>
                        )}

                        {receipt.status === 'İtirazlı' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-rose-700">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              İtirazlı{receipt.objectionNote ? ` · ${receipt.objectionNote}` : ''}
                            </span>
                          </span>
                        )}

                        {receipt.status === 'Dekont Bekleniyor' && (
                          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Dekont Bekleniyor · Son Gün: {receipt.dueDate}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Clean Action Controls */}
                  <div className="flex flex-wrap items-center gap-2.5 pl-13 sm:pl-0 shrink-0">
                    {receipt.status === 'Dekont Bekleniyor' ? (
                      <button
                        type="button"
                        onClick={() =>
                          onNotify(
                            `${receipt.senderName} için ${receipt.monthLabel} dekont hatırlatması gönderildi.`
                          )
                        }
                        className="min-h-[40px] px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Bell className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                        <span>Hatırlat</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const fileUrl = receipt.fileUrl || receipt.previewImageUrl;
                            if (fileUrl) {
                              window.open(fileUrl, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            setInspectObjection(false);
                            setInspectedReceipt(receipt);
                          }}
                          className="min-h-[40px] px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Dekontu Gör</span>
                        </button>

                        {receipt.status === 'Ev Sahibi Onayı Bekliyor' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                onApproveReceipt(receipt.ownerPropertyId, receipt.id)
                              }
                              className="min-h-[40px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Dekontu İnceledim, Ödemeyi Onayla</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setInspectObjection(true);
                                setInspectedReceipt(receipt);
                              }}
                              className="min-h-[40px] px-3.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <MessageSquareWarning className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>İtiraz Et</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Single Clean Rent Increase History Card (4 cols) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Kira Artış Geçmişi</span>
          </div>
          <h2 className="mt-1.5 text-lg font-display font-bold text-[#0B192C]">
            Dönemsel Artışlar
          </h2>

          {scopedIncreases.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Seçili mülk için kayıtlı kira artış dönemi bulunmuyor.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {scopedIncreases.map((inc) => (
                <div key={inc.id} className="py-3.5 first:pt-0 last:pb-0">
                  <p className="text-xs sm:text-sm font-medium font-mono-tabular text-[#0B192C]">
                    {formatIncreaseLine(
                      inc.periodLabel,
                      inc.previousRent,
                      inc.newRent,
                      inc.rateLabel
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {inspectedReceipt && (
        <ReceiptInspectModal
          receipt={inspectedReceipt}
          startWithObjection={inspectObjection}
          onClose={() => {
            setInspectedReceipt(null);
            setInspectObjection(false);
          }}
          onLandlordApprove={(receiptId) =>
            onApproveReceipt(inspectedReceipt.ownerPropertyId, receiptId)
          }
          onLandlordObject={(receiptId, reason) =>
            onObjectReceipt(inspectedReceipt.ownerPropertyId, receiptId, reason)
          }
        />
      )}
    </section>
  );
}
