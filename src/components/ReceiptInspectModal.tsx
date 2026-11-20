import { useState } from 'react';
import { X, FileText, ShieldCheck, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { RentReceipt } from '../types/kiracimkim';

interface ReceiptInspectModalProps {
  receipt: RentReceipt;
  startWithObjection?: boolean;
  onClose: () => void;
  onLandlordApprove?: (receiptId: string) => void;
  onLandlordObject?: (receiptId: string, reason: string) => void;
}

export function ReceiptInspectModal({
  receipt,
  startWithObjection = false,
  onClose,
  onLandlordApprove,
  onLandlordObject,
}: ReceiptInspectModalProps) {
  const [objectionOpen, setObjectionOpen] = useState(startWithObjection);
  const [objectReason, setObjectReason] = useState(receipt.objectionNote ?? '');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val) + ' ₺';

  const handleObjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onLandlordObject || !objectReason.trim()) return;
    onLandlordObject(receipt.id, objectReason.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="OCR ile Okunmuş Dekont ve Hash Özeti"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-emerald-400 font-medium">
              OCR ile Okunmuş Dekont + Hash Özeti
            </p>
            <h3 className="text-base sm:text-lg font-display font-bold mt-0.5">
              {receipt.monthLabel} · {receipt.type}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Left: Visual Receipt Document Preview */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between">
              {receipt.previewImageUrl ? (
                <img
                  src={receipt.previewImageUrl}
                  alt={`${receipt.monthLabel} dekont önizlemesi`}
                  className="w-full h-56 object-cover rounded-xl border border-slate-200"
                />
              ) : receipt.fileUrl ? (
                <a
                  href={receipt.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-emerald-700 inline-flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  <span>Dekontu aç</span>
                </a>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-[11px] font-mono-tabular text-slate-700">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-[#0B192C]">DEKONT ÖNİZLEME</span>
                    <FileText className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  </div>
                  <div>
                    <span className="text-slate-400 block">GÖNDEREN</span>
                    <span className="font-semibold text-[#0B192C]">{receipt.senderName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">ALICI IBAN</span>
                    <span className="break-all text-[#0B192C]">{receipt.iban}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 block">TARİH</span>
                      <span className="font-semibold text-[#0B192C]">
                        {receipt.paidDate ?? '—'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block">TUTAR</span>
                      <span className="font-bold text-emerald-700">
                        {formatCurrency(receipt.amount)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block">AÇIKLAMA</span>
                    <span>
                      {receipt.monthLabel} {receipt.type}
                    </span>
                  </div>
                </div>
              )}

              <p className="mt-3 text-[11px] font-mono-tabular text-slate-500 truncate">
                Dosya: {receipt.fileName ?? 'dekont.pdf'}
              </p>
            </div>

            {/* Right: OCR Fields + IBAN Match + SHA-256 + Approval Time */}
            <div className="md:col-span-7 space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Mevcut Durum</span>
                <span
                  className={`font-semibold inline-flex items-center gap-1.5 ${
                    receipt.status === 'Onaylandı'
                      ? 'text-emerald-700'
                      : receipt.status === 'İtirazlı'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}
                >
                  {receipt.status === 'Onaylandı' ? (
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  ) : receipt.status === 'İtirazlı' ? (
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Clock className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{receipt.status}</span>
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">OCR ile Okunan Tutar</span>
                <span className="font-bold font-mono-tabular text-[#0B192C]">
                  {receipt.ocrAmount ?? formatCurrency(receipt.amount)}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">OCR ile Okunan Tarih</span>
                <span className="font-mono-tabular text-[#0B192C]">
                  {receipt.ocrDate ?? receipt.paidDate ?? '—'}
                </span>
              </div>

              {receipt.delayDays && receipt.delayDays > 0 ? (
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Vade Farkı / Gecikme</span>
                  <span className="font-semibold font-mono-tabular text-amber-700">
                    {receipt.delayDays} gün gecikme (Vade: {receipt.dueDate})
                  </span>
                </div>
              ) : null}

              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">IBAN Eşleşme Sonucu</span>
                <span
                  className={`text-xs font-semibold text-right ${
                    receipt.ibanMatched ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {receipt.ibanMatched
                    ? 'Alıcı IBAN ile Eşleşti'
                    : 'IBAN Eşleşmedi / Kontrol Gerekli'}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500 shrink-0">Dosya SHA-256 Hash</span>
                <span className="font-mono-tabular text-xs text-[#0B192C] break-all text-right">
                  {receipt.sha256Hash ?? 'sha256:9f82c1a4...e71b09'}
                </span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-slate-500">Ev Sahibi Onay Zamanı</span>
                <span className="font-mono-tabular text-xs font-semibold text-[#0B192C]">
                  {receipt.landlordApprovedAt ?? 'Henüz Onaylanmadı'}
                </span>
              </div>

              {receipt.objectionNote && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                  <span className="font-semibold block">Ev Sahibi İtiraz Notu:</span>
                  <span className="mt-0.5 block">{receipt.objectionNote}</span>
                </div>
              )}
            </div>
          </div>

          {onLandlordObject && objectionOpen && (
            <form
              onSubmit={handleObjectSubmit}
              className="pt-4 border-t border-slate-200 space-y-3"
            >
              <label
                htmlFor="modal-object-reason"
                className="block text-xs font-semibold text-[#0B192C]"
              >
                İtiraz Gerekçeniz
              </label>
              <textarea
                id="modal-object-reason"
                rows={2}
                value={objectReason}
                onChange={(e) => setObjectReason(e.target.value)}
                placeholder="Örn. Tutar eksik veya alıcı IBAN hesabıma ulaşmadı."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setObjectionOpen(false)}
                  className="min-h-[40px] px-3.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
                >
                  İtirazı Kaydet
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div>
            {onLandlordObject && receipt.status !== 'İtirazlı' && !objectionOpen && (
              <button
                type="button"
                onClick={() => setObjectionOpen(true)}
                className="min-h-[42px] px-3.5 py-2 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
              >
                İtiraz Et
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {onLandlordApprove && receipt.status !== 'Onaylandı' && (
              <button
                type="button"
                onClick={() => {
                  onLandlordApprove(receipt.id);
                  onClose();
                }}
                className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Dekontu Onayla</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 bg-[#0B192C] hover:bg-[#132946] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
