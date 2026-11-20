import { useState } from 'react';
import { X } from 'lucide-react';

interface NewApartmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (title: string, district: string) => Promise<void>;
}

export function NewApartmentModal({ open, onClose, onSave }: NewApartmentModalProps) {
  const [title, setTitle] = useState('');
  const [district, setDistrict] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (saving) return;
    setErrorMsg('');
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Lütfen daire başlığını girin.');
      return;
    }
    if (!district.trim()) {
      setErrorMsg('Lütfen ilçe ve mahalle bilgisini girin.');
      return;
    }
    setErrorMsg('');
    setSaving(true);
    try {
      await onSave(title.trim(), district.trim());
      setTitle('');
      setDistrict('');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Daire kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-apartment-title"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl my-auto flex flex-col">
        <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs text-emerald-400 font-medium">Ev Sahibi Paneli</p>
            <h3 id="new-apartment-title" className="text-base sm:text-lg font-display font-bold mt-0.5">
              Yeni Daire Ekle
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Kapat"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="apartment-title" className="block text-xs font-semibold text-[#0B192C] mb-1.5">
              Daire Başlığı
            </label>
            <input
              id="apartment-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kadıköy 2+1 Daire"
              className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label htmlFor="apartment-district" className="block text-xs font-semibold text-[#0B192C] mb-1.5">
              İlçe / Mahalle
            </label>
            <input
              id="apartment-district"
              type="text"
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              placeholder="Moda, Kadıköy"
              className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
            >
              {errorMsg}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[46px] px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-colors"
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="min-h-[46px] px-4 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
