import { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  MapPin,
  Clock,
  Plus,
  Minus,
  X,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ImagePlus,
  Gauge,
  KeyRound,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { LIVING_ROOMS, roomsWithoutPhotos } from '../lib/handoverSteps';
import { HandoverChecklistState, HandoverPhoto, RoomId, ScreenId } from '../types/kiracimkim';

interface HandoverScreenProps {
  photos: HandoverPhoto[];
  checklist: HandoverChecklistState;
  propertyTitle: string;
  propertyAddress: string;
  onAddPhoto: (photo: HandoverPhoto) => void;
  onDeletePhoto: (id: string) => void;
  onToggleCondition: (id: string) => void;
  onUpdateChecklist: (next: Partial<HandoverChecklistState>) => void;
  onSealProtocol: () => void;
  onNavigate: (screen: ScreenId) => void;
  onNotify: (message: string) => void;
}

type WizardStep = 1 | 2 | 3;

const STEP_PARAM = 'adim';

function readRequestedStep(): WizardStep {
  const raw = new URLSearchParams(window.location.search).get(STEP_PARAM);
  if (raw === '2') return 2;
  if (raw === '3') return 3;
  return 1;
}

function writeStepToUrl(nextStep: WizardStep) {
  const url = new URL(window.location.href);
  url.searchParams.set(STEP_PARAM, String(nextStep));
  window.history.replaceState({}, '', url);
}

function photoCountLabel(count: number) {
  if (count <= 0) return 'Henüz fotoğraf yok';
  return `${count} fotoğraf eklendi`;
}

interface ExtraArea {
  id: string;
  label: string;
  guidance: string;
}

function areaIdFromLabel(label: string) {
  const slug = label
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug ? `alan-${slug}` : `alan-${Date.now()}`;
}

export function HandoverScreen({
  photos,
  checklist,
  propertyTitle,
  propertyAddress,
  onAddPhoto,
  onDeletePhoto,
  onToggleCondition,
  onUpdateChecklist,
  onSealProtocol,
  onNavigate,
  onNotify,
}: HandoverScreenProps) {
  const [step, setStep] = useState<WizardStep>(readRequestedStep);
  const [selectedRoom, setSelectedRoom] = useState<RoomId>('salon');
  const [customAreas, setCustomAreas] = useState<ExtraArea[]>([]);
  const [areaDraftOpen, setAreaDraftOpen] = useState(false);
  const [areaDraft, setAreaDraft] = useState('');
  const [openRoomId, setOpenRoomId] = useState<RoomId | null>(null);
  const [condition, setCondition] = useState<'hasarsiz' | 'kusurlu'>('hasarsiz');
  const [noteInput, setNoteInput] = useState('');
  const [defectCloseUpUrl, setDefectCloseUpUrl] = useState<string>('');
  const [defectError, setDefectError] = useState<string>('');

  // Live Camera Modal State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoIdRef = useRef<string | null>(null);
  const defectFileInputRef = useRef<HTMLInputElement | null>(null);

  const electricPhotoRef = useRef<HTMLInputElement | null>(null);
  const waterPhotoRef = useRef<HTMLInputElement | null>(null);
  const gasPhotoRef = useRef<HTMLInputElement | null>(null);

  const openRoom = (roomId: RoomId) => {
    setSelectedRoom(roomId);
    setOpenRoomId(roomId);
    setCondition('hasarsiz');
    setNoteInput('');
    setDefectCloseUpUrl('');
    setDefectError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeRoom = () => {
    setOpenRoomId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (nextStep: WizardStep) => {
    setStep(nextStep);
    writeStepToUrl(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    writeStepToUrl(readRequestedStep());
  }, []);

  useEffect(() => {
    const onPop = () => setStep(readRequestedStep());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const validateDefectRequirement = (): boolean => {
    if (condition === 'kusurlu') {
      if (!defectCloseUpUrl || !noteInput.trim()) {
        setDefectError(
          'Mevcut kusur işaretlemesi için yakın plan hasar fotoğrafı ve kısa hasar notu zorunludur.'
        );
        return false;
      }
    }
    setDefectError('');
    return true;
  };

  const openCamera = async () => {
    if (!validateDefectRequirement()) return;
    setCameraError(null);
    setCameraOpen(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } else {
        setCameraError(
          'Tarayıcı kamerasına erişilemiyor. Aşağıdaki deklanşör ile örnek görüntü yakalayabilirsiniz.'
        );
      }
    } catch {
      setCameraError(
        'Kamera izni verilmedi veya cihazda kamera bulunamadı. Aşağıdaki deklanşör ile örnek oda görüntüsü yakalayabilirsiniz.'
      );
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setCameraOpen(false);
  };

  const createTimestampLabel = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} · ${hh}:${min}`;
  };

  const createRandomHash = () => {
    const hex = Math.random().toString(16).substring(2, 10).toUpperCase();
    return `SHA256-${hex}`;
  };

  const getSampleImageForRoom = (roomId: RoomId) => {
    if (roomId === 'mutfak') {
      return '/src/assets/images/room_kitchen_check_1794831352502.jpg';
    }
    if (roomId === 'salon') {
      return '/src/assets/images/room_living_check_1794831352125.jpg';
    }
    return '/src/assets/images/hero_trust_residence_1794831351232.jpg';
  };

  const resetCaptureInputs = () => {
    setNoteInput('');
    setDefectCloseUpUrl('');
    setDefectError('');
  };

  const handleCaptureFromCamera = () => {
    let imageUrl = getSampleImageForRoom(selectedRoom);
    if (videoRef.current && videoRef.current.readyState >= 2 && !cameraError) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 960;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        imageUrl = canvas.toDataURL('image/jpeg', 0.88);
      }
    }

    const newPhoto: HandoverPhoto = {
      id: `ph-${Date.now()}`,
      roomId: selectedRoom,
      roomLabel: activeRoomDef.label,
      imageUrl,
      closeUpImageUrl: condition === 'kusurlu' ? defectCloseUpUrl : undefined,
      capturedAt: createTimestampLabel(),
      location: propertyTitle,
      condition,
      note:
        noteInput.trim() ||
        `${activeRoomDef.label} alanı teslim anında hasarsız ve temiz görüntülendi.`,
      hash: createRandomHash(),
    };

    onAddPhoto(newPhoto);
    resetCaptureInputs();
    closeCamera();
    onNotify(`${activeRoomDef.label} fotoğrafı zaman damgasıyla eklendi.`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const replacingId = replacePhotoIdRef.current;
    replacePhotoIdRef.current = null;
    if (!file) return;
    if (!validateDefectRequirement()) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      const newPhoto: HandoverPhoto = {
        id: `ph-${Date.now()}`,
        roomId: selectedRoom,
        roomLabel: activeRoomDef.label,
        imageUrl: result,
        closeUpImageUrl: condition === 'kusurlu' ? defectCloseUpUrl : undefined,
        capturedAt: createTimestampLabel(),
        location: propertyTitle,
        condition,
        note:
          noteInput.trim() ||
          `${activeRoomDef.label} için cihazdan yüklenen tespit fotoğrafı (${file.name}).`,
        hash: createRandomHash(),
      };
      onAddPhoto(newPhoto);
      if (replacingId) onDeletePhoto(replacingId);
      resetCaptureInputs();
      onNotify(`${activeRoomDef.label} fotoğrafı başarıyla yüklendi.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDefectCloseUpFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        setDefectCloseUpUrl(result);
        setDefectError('');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleQuickSampleCapture = () => {
    if (!validateDefectRequirement()) return;
    const newPhoto: HandoverPhoto = {
      id: `ph-${Date.now()}`,
      roomId: selectedRoom,
      roomLabel: activeRoomDef.label,
      imageUrl: getSampleImageForRoom(selectedRoom),
      closeUpImageUrl: condition === 'kusurlu' ? defectCloseUpUrl : undefined,
      capturedAt: createTimestampLabel(),
      location: propertyTitle,
      condition,
      note:
        noteInput.trim() ||
        `${activeRoomDef.label} teslim kontrolü: yüzeyler ve doğramalar sağlam.`,
      hash: createRandomHash(),
    };
    onAddPhoto(newPhoto);
    resetCaptureInputs();
    onNotify(`${activeRoomDef.label} için zaman damgalı örnek tespit eklendi.`);
  };

  const handleMeterPhotoPick = (
    meterKey: 'electricMeterPhoto' | 'waterMeterPhoto' | 'gasMeterPhoto',
    meterLabel: string,
    file?: File
  ) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (result) {
          onUpdateChecklist({ [meterKey]: result });
          onNotify(`${meterLabel} fotoğrafı eklendi.`);
        }
      };
      reader.readAsDataURL(file);
    } else {
      onUpdateChecklist({
        [meterKey]: '/src/assets/images/room_kitchen_check_1794831352502.jpg',
      });
      onNotify(`${meterLabel} için örnek sayaç fotoğrafı eklendi.`);
    }
  };

  const roomPhotoCount = (roomId: RoomId) => photos.filter((p) => p.roomId === roomId).length;
  const extraAreas = new Map<string, ExtraArea>();
  for (const area of customAreas) extraAreas.set(area.id, area);
  for (const photo of photos) {
    if (photo.roomId === 'sayaclar' || LIVING_ROOMS.some((room) => room.id === photo.roomId)) continue;
    if (!extraAreas.has(photo.roomId)) {
      extraAreas.set(photo.roomId, {
        id: photo.roomId,
        label: photo.roomLabel,
        guidance: 'Bu alana ait fotoğrafları ekleyin.',
      });
    }
  }
  const areas: ExtraArea[] = [
    ...LIVING_ROOMS.map((room) => ({
      id: room.id,
      label: room.label,
      guidance: room.guidance,
    })),
    ...extraAreas.values(),
  ];
  const activeRoomDef = areas.find((room) => room.id === selectedRoom) ?? areas[0];
  const displayedPhotos = photos.filter((p) => p.roomId === selectedRoom);
  const unphotographedRooms = roomsWithoutPhotos(photos);
  const defectCount = photos.filter((p) => p.condition === 'kusurlu').length;

  const addArea = (event: React.FormEvent) => {
    event.preventDefault();
    const label = areaDraft.trim();
    if (!label) return;
    const id = areaIdFromLabel(label);
    const duplicate = areas.some(
      (area) =>
        area.id === id ||
        area.label.toLocaleLowerCase('tr-TR') === label.toLocaleLowerCase('tr-TR')
    );
    if (duplicate) {
      onNotify('Bu alan zaten listede.');
      return;
    }
    setCustomAreas((current) => [
      ...current,
      { id, label, guidance: 'Bu alana ait fotoğrafları ekleyin.' },
    ]);
    setAreaDraft('');
    setAreaDraftOpen(false);
  };

  const wizardSteps: { id: WizardStep; title: string }[] = [
    { id: 1, title: '1. Oda Fotoğrafları' },
    { id: 2, title: '2. Sayaçlar ve Anahtar' },
    { id: 3, title: '3. Özet ve Karşılıklı Onay' },
  ];

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Header */}
      <div className="pb-5 border-b border-slate-200/80">
        <p className="text-xs font-medium text-emerald-700">
          Teslim Tutanağı · {propertyTitle}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight">
          Teslim Tutanağı Sihirbazı
        </h1>
        <p className="mt-1 text-sm text-slate-500">{propertyAddress}</p>
      </div>

      {/* 3-Step Wizard Progress Stepper */}
      <nav aria-label="Teslim Tutanağı Adımları" className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2.5">
          {wizardSteps.map((ws, index) => {
            const isCurrent = step === ws.id;
            const isDone = !isCurrent && (ws.id < step || (ws.id === 3 && checklist.sealed));

            return (
              <div key={ws.id} className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => goToStep(ws.id)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-center ${
                    isCurrent
                      ? 'bg-[#0B192C] border-[#0B192C] text-white'
                      : isDone
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 hover:bg-emerald-100/70'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {isDone && !isCurrent && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className="truncate">{ws.title}</span>
                </button>
                {index < wizardSteps.length - 1 && (
                  <ArrowRight
                    className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* ADIM 1: ODA FOTOĞRAFLARI */}
      {step === 1 && !openRoomId && (
        <div className="mt-6 space-y-5">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
              Odaları fotoğraflayın
            </h2>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Fotoğraf eklemek istediğiniz alanı seçin. Tüm odaları doldurmanız gerekmez; boş kalan alanları ev sahibi onayda inceler.
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {photoCountLabel(photos.length)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {areas.map((room) => {
              const count = roomPhotoCount(room.id);
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => openRoom(room.id)}
                  className="text-left bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 hover:border-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <h3 className="text-base font-display font-bold text-[#0B192C]">{room.label}</h3>
                  <p
                    className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${
                      count > 0 ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {count > 0 && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                    {photoCountLabel(count)}
                  </p>
                </button>
              );
            })}
          </div>

          {areaDraftOpen ? (
            <form onSubmit={addArea} className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="extra-area-name" className="sr-only">
                Alan adı
              </label>
              <input
                id="extra-area-name"
                type="text"
                value={areaDraft}
                onChange={(event) => setAreaDraft(event.target.value)}
                placeholder="Örn. Balkon, Antre, Kombi/Demirbaş"
                className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-[#0B192C] focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  setAreaDraft('');
                  setAreaDraftOpen(false);
                }}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Vazgeç
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAreaDraftOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-[#0B192C] hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Alan Ekle
            </button>
          )}

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              <span>Sayaçlar ve Anahtar Adımına Geç</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {step === 1 && openRoomId && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={closeRoom}
              className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#0B192C]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              Oda listesi
            </button>
            <span className="text-xs font-medium text-slate-500">
              {photoCountLabel(roomPhotoCount(activeRoomDef.id))}
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-display font-bold text-[#0B192C]">
                {activeRoomDef.label} Fotoğrafları
              </h2>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                {activeRoomDef.id === 'salon'
                  ? 'Zemin, duvarlar, pencereler ve odanın genel görünümünü fotoğraflayın. Böylece evin mevcut durumunu kayıt altına alabilirsiniz.'
                  : activeRoomDef.guidance}
              </p>
            </div>

            {/* Condition Toggle */}
            <div className="mt-5">
              <span className="block text-xs font-medium text-slate-500 mb-2">
                Bölüm durumu
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCondition('hasarsiz');
                    setDefectError('');
                  }}
                  className={`min-h-[46px] px-3 py-2 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${
                    condition === 'hasarsiz'
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Hasarsız</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCondition('kusurlu')}
                  className={`min-h-[46px] px-3 py-2 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${
                    condition === 'kusurlu'
                      ? 'bg-amber-50 border-amber-500 text-amber-900 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Mevcut kusur işaretle</span>
                </button>
              </div>
            </div>

            {/* Mandatory Close-up Photo + Note Sub-Panel when Defect is selected */}
            {condition === 'kusurlu' ? (
              <div className="mt-4 bg-amber-50/70 border border-amber-300/80 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-start gap-2 text-xs text-amber-950">
                  <AlertTriangle
                    className="w-4 h-4 text-amber-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-bold">Zorunlu Kusur Kanıtı</p>
                    <p className="text-amber-900 mt-0.5">
                      Çıkışta depozito kesintisi yaşamamak için hasarın yakın plan fotoğrafını ve
                      kısa açıklamasını mutlaka ekleyin.
                    </p>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#0B192C] mb-1.5">
                    1. Yakın Plan Hasar Fotoğrafı *
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => defectFileInputRef.current?.click()}
                      className="min-h-[42px] px-3.5 py-2 bg-white border border-amber-400 hover:bg-amber-100/50 text-[#0B192C] text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                    >
                      <ImagePlus className="w-4 h-4 text-amber-700" aria-hidden="true" />
                      <span>
                        {defectCloseUpUrl ? 'Yakın Planı Değiştir' : 'Yakın Plan Fotoğraf Seç'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDefectCloseUpUrl(getSampleImageForRoom(selectedRoom));
                        setDefectError('');
                      }}
                      className="min-h-[42px] px-3 py-2 bg-amber-900/10 hover:bg-amber-900/15 text-amber-950 text-xs font-semibold rounded-xl"
                    >
                      Örnek Yakın Plan Ekle
                    </button>

                    <input
                      ref={defectFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleDefectCloseUpFile}
                      className="hidden"
                    />
                  </div>

                  {defectCloseUpUrl && (
                    <div className="mt-2.5 flex items-center gap-3 bg-white border border-amber-200 rounded-xl p-2">
                      <img
                        src={defectCloseUpUrl}
                        alt="Yakın plan hasar fotoğrafı önizleme"
                        className="w-14 h-12 object-cover rounded-lg shrink-0"
                      />
                      <span className="text-xs font-medium text-emerald-700 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        Yakın plan hasar görseli eklendi
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="handover-note"
                    className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                  >
                    2. Kısa Kusur Notu *
                  </label>
                  <input
                    id="handover-note"
                    type="text"
                    required
                    value={noteInput}
                    onChange={(e) => {
                      setNoteInput(e.target.value);
                      if (e.target.value.trim()) setDefectError('');
                    }}
                    placeholder="Örn. Salon pencere kolu hafif gevşek ve boyada 3 cm çizik var."
                    className="w-full min-h-[44px] px-3.5 py-2 bg-white border border-amber-300 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <label
                  htmlFor="handover-note"
                  className="block text-xs font-medium text-slate-500 mb-1.5"
                >
                  Tespit Notu (İsteğe Bağlı)
                </label>
                <input
                  id="handover-note"
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Örn. Duvar boyası temiz, prizler sağlam."
                  className="w-full min-h-[44px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            )}

            {defectError && (
              <p
                role="alert"
                className="mt-3 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
              >
                {defectError}
              </p>
            )}

            {/* Primary Capture Actions */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={openCamera}
                className="min-h-[48px] px-4 py-3 bg-[#0B192C] hover:bg-[#132946] text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Camera className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span>Kamerayı Aç ve Fotoğraf Çek</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!validateDefectRequirement()) return;
                  replacePhotoIdRef.current = null;
                  fileInputRef.current?.click();
                }}
                className="min-h-[48px] px-4 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Upload className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Galeriden / Dosyadan Yükle</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                Kamera erişiminiz yoksa hızlı test için örnek çekim ekleyebilirsiniz:
              </span>
              <button
                type="button"
                onClick={handleQuickSampleCapture}
                className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Örnek Çekim Ekle</span>
              </button>
            </div>
          </div>

          {/* Captured Photos List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-display font-bold text-[#0B192C]">
                Eklenen fotoğraflar ({displayedPhotos.length})
              </h3>
            </div>

            {displayedPhotos.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#0B192C]">
                  {activeRoomDef.label} için henüz fotoğraf eklenmedi
                </p>
                <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                  Yukarıdaki kamera veya dosya yükleme butonunu kullanarak ilk zaman damgalı kanıtı
                  oluşturun.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedPhotos.map((photo) => (
                  <article
                    key={photo.id}
                    className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <ResilientImage
                        src={photo.imageUrl}
                        alt={`${photo.roomLabel} teslim tespit fotoğrafı`}
                        fallbackLabel={photo.roomLabel}
                        className="w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/85 via-transparent to-transparent"
                        aria-hidden="true"
                      />
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] text-white font-mono-tabular">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Clock className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                          {photo.capturedAt}
                        </span>
                        <span className="text-emerald-300 shrink-0">{photo.hash}</span>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#0B192C]">
                            {photo.roomLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleCondition(photo.id)}
                            className={`text-xs font-semibold inline-flex items-center gap-1 hover:underline ${
                              photo.condition === 'hasarsiz'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {photo.condition === 'hasarsiz' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Hasarsız</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Mevcut Kusur</span>
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                          {photo.note}
                        </p>

                        {photo.closeUpImageUrl && (
                          <div className="mt-2.5 flex items-center gap-2.5 bg-amber-50/70 border border-amber-200 rounded-xl p-2">
                            <img
                              src={photo.closeUpImageUrl}
                              alt="Kusur yakın plan fotoğrafı"
                              className="w-11 h-10 object-cover rounded-lg shrink-0"
                            />
                            <span className="text-[11px] font-medium text-amber-950">
                              Yakın Plan Hasar Kanıtı Eklendi
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin
                            className="w-3.5 h-3.5 text-slate-400 shrink-0"
                            aria-hidden="true"
                          />
                          {photo.location}
                        </span>
                        <span className="inline-flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              replacePhotoIdRef.current = photo.id;
                              fileInputRef.current?.click();
                            }}
                            className="min-h-[36px] px-2 inline-flex items-center gap-1 text-slate-600 hover:text-[#0B192C] transition-colors"
                          >
                            <span>Değiştir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePhoto(photo.id)}
                            aria-label={`${photo.roomLabel} fotoğrafını sil`}
                            className="min-h-[36px] px-2 inline-flex items-center gap-1 text-slate-500 hover:text-rose-700 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Sil</span>
                          </button>
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={closeRoom}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-[#0B192C] hover:bg-[#132946] text-white font-semibold text-sm rounded-xl transition-colors"
            >
              Odayı tamamla
            </button>
          </div>
        </div>
      )}

      {/* ADIM 2: SAYAÇLAR VE ANAHTAR */}
      {step === 2 && (
        <div className="mt-6 space-y-6">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <Gauge className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
                  Sayaç Endeksleri ve Anahtar Adedi
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-500">
                  Yalnızca evde bulunan sayaçları ve anahtarları girin. Olmayan alanları boş bırakıp özete geçebilirsiniz.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              {/* Elektrik Sayacı */}
              <div>
                <label
                  htmlFor="meter-electric"
                  className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                >
                  Elektrik Sayacı Endeksi (kWh, opsiyonel)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    id="meter-electric"
                    type="text"
                    value={checklist.electricMeterNo}
                    onChange={(e) => onUpdateChecklist({ electricMeterNo: e.target.value })}
                    className="flex-1 min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => electricPhotoRef.current?.click()}
                    className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      checklist.electricMeterPhoto
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-300 hover:bg-slate-50 text-[#0B192C]'
                    }`}
                  >
                    <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {checklist.electricMeterPhoto ? 'Fotoğraf Eklendi' : 'Sayaç Fotoğrafı Ekle'}
                    </span>
                  </button>
                  <input
                    ref={electricPhotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) =>
                      handleMeterPhotoPick(
                        'electricMeterPhoto',
                        'Elektrik Sayacı',
                        e.target.files?.[0]
                      )
                    }
                    className="hidden"
                  />
                </div>
              </div>

              {/* Su Sayacı */}
              <div>
                <label
                  htmlFor="meter-water"
                  className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                >
                  Su Sayacı Endeksi (m³, opsiyonel)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    id="meter-water"
                    type="text"
                    value={checklist.waterMeterNo}
                    onChange={(e) => onUpdateChecklist({ waterMeterNo: e.target.value })}
                    className="flex-1 min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => waterPhotoRef.current?.click()}
                    className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      checklist.waterMeterPhoto
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-300 hover:bg-slate-50 text-[#0B192C]'
                    }`}
                  >
                    <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {checklist.waterMeterPhoto ? 'Fotoğraf Eklendi' : 'Sayaç Fotoğrafı Ekle'}
                    </span>
                  </button>
                  <input
                    ref={waterPhotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) =>
                      handleMeterPhotoPick('waterMeterPhoto', 'Su Sayacı', e.target.files?.[0])
                    }
                    className="hidden"
                  />
                </div>
              </div>

              {/* Doğalgaz Sayacı */}
              <div>
                <label
                  htmlFor="meter-gas"
                  className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                >
                  Doğalgaz Sayacı Endeksi (m³, opsiyonel)
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <input
                    id="meter-gas"
                    type="text"
                    value={checklist.gasMeterNo}
                    onChange={(e) => onUpdateChecklist({ gasMeterNo: e.target.value })}
                    className="flex-1 min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => gasPhotoRef.current?.click()}
                    className={`min-h-[46px] px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${
                      checklist.gasMeterPhoto
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-slate-300 hover:bg-slate-50 text-[#0B192C]'
                    }`}
                  >
                    <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {checklist.gasMeterPhoto ? 'Fotoğraf Eklendi' : 'Sayaç Fotoğrafı Ekle'}
                    </span>
                  </button>
                  <input
                    ref={gasPhotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) =>
                      handleMeterPhotoPick(
                        'gasMeterPhoto',
                        'Doğalgaz Sayacı',
                        e.target.files?.[0]
                      )
                    }
                    className="hidden"
                  />
                </div>
              </div>

              {/* Teslim Alınan Anahtar Adedi */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-semibold text-[#0B192C]">
                    Teslim Alınan Anahtar Adedi (opsiyonel)
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label="Anahtar sayısını azalt"
                    onClick={() =>
                      onUpdateChecklist({ keysCount: Math.max(0, checklist.keysCount - 1) })
                    }
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center text-[#0B192C] hover:bg-slate-50"
                  >
                    <Minus className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <span className="w-10 text-center text-base font-mono-tabular font-bold text-[#0B192C]">
                    {checklist.keysCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Anahtar sayısını artır"
                    onClick={() => onUpdateChecklist({ keysCount: checklist.keysCount + 1 })}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 flex items-center justify-center text-[#0B192C] hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 Footer Navigation */}
          <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Geri</span>
            </button>

            <div className="flex flex-col items-stretch sm:items-end gap-2">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
              >
                <span>Sonraki Adım: Özet ve Karşılıklı Onay</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADIM 3: ÖZET VE KARŞILIKLI ONAY */}
      {step === 3 && (
        <div className="mt-6 space-y-6">
          {/* Unified Summary Document */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
            {/* Document Header */}
            <div className="bg-[#0B192C] text-white px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-emerald-400">
                  Tek Özet Belgesi · {propertyTitle}
                </p>
                <h2 className="mt-0.5 text-lg sm:text-xl font-display font-bold">
                  Teslim Tutanağı Özet Belgesi
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  Depozitonuzu güvenceye almak için aşağıdaki tüm oda fotoğraflarını, kusur
                  notlarını ve sayaç verilerini inceleyip onaylayın.
                </p>
              </div>
              <div className="text-xs font-mono-tabular text-emerald-300 shrink-0">
                {photos.length} Fotoğraf · {defectCount} Kusur · {checklist.keysCount} Anahtar
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Section 1: All Room Photos & Defect Notes */}
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <h3 className="text-sm font-display font-bold text-[#0B192C]">
                    Oda Fotoğrafları ve Kusur Notları ({photos.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(1)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Düzenle
                  </button>
                </div>

                {photos.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Henüz oda fotoğrafı eklenmemiş. 1. Adıma dönerek oda fotoğraflarını
                    ekleyebilirsiniz.
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="border border-slate-200/90 rounded-xl p-3 flex items-start gap-3 bg-slate-50/50"
                      >
                        <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                          <ResilientImage
                            src={photo.imageUrl}
                            alt={`${photo.roomLabel} özeti`}
                            fallbackLabel={photo.roomLabel}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#0B192C]">
                              {photo.roomLabel}
                            </span>
                            <span
                              className={`text-[11px] font-semibold inline-flex items-center gap-1 ${
                                photo.condition === 'hasarsiz'
                                  ? 'text-emerald-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {photo.condition === 'hasarsiz' ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                                  <span>Hasarsız</span>
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                                  <span>Mevcut Kusur</span>
                                </>
                              )}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 leading-snug">{photo.note}</p>
                          <p className="mt-1 text-[10px] font-mono-tabular text-slate-400">
                            {photo.capturedAt} · {photo.hash}
                          </p>
                          {photo.closeUpImageUrl && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-800 font-medium">
                              <img
                                src={photo.closeUpImageUrl}
                                alt="Yakın plan kusur kanıtı"
                                className="w-6 h-5 rounded object-cover shrink-0"
                              />
                              <span>Yakın plan kusur görseli ekli</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {unphotographedRooms.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    Fotoğraf eklenmeyen alanlar ({unphotographedRooms.join(', ')}) ev sahibi onayında incelenir.
                  </p>
                )}
              </div>

              {/* Section 2: Meter Readings & Keys */}
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <h3 className="text-sm font-display font-bold text-[#0B192C]">
                    Sayaç Endeksleri ve Anahtar Sayısı
                  </h3>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Düzenle
                  </button>
                </div>

                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <dt className="text-slate-500">Elektrik Sayacı</dt>
                    <dd className="mt-1 font-mono-tabular font-bold text-[#0B192C] text-sm">
                      {checklist.electricMeterNo.trim() || 'Girilmedi'}
                    </dd>
                    <span className={`mt-0.5 block text-[11px] ${checklist.electricMeterPhoto ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {checklist.electricMeterPhoto ? 'Fotoğraf eklendi' : 'Fotoğraf eklenmedi'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <dt className="text-slate-500">Su Sayacı</dt>
                    <dd className="mt-1 font-mono-tabular font-bold text-[#0B192C] text-sm">
                      {checklist.waterMeterNo.trim() || 'Girilmedi'}
                    </dd>
                    <span className={`mt-0.5 block text-[11px] ${checklist.waterMeterPhoto ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {checklist.waterMeterPhoto ? 'Fotoğraf eklendi' : 'Fotoğraf eklenmedi'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <dt className="text-slate-500">Doğalgaz Sayacı</dt>
                    <dd className="mt-1 font-mono-tabular font-bold text-[#0B192C] text-sm">
                      {checklist.gasMeterNo.trim() || 'Girilmedi'}
                    </dd>
                    <span className={`mt-0.5 block text-[11px] ${checklist.gasMeterPhoto ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {checklist.gasMeterPhoto ? 'Fotoğraf eklendi' : 'Fotoğraf eklenmedi'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
                    <dt className="text-slate-500">Teslim Anahtar</dt>
                    <dd className="mt-1 font-mono-tabular font-bold text-emerald-700 text-sm">
                      {checklist.keysCount} Adet
                    </dd>
                    <span className="mt-0.5 block text-[11px] text-slate-500">
                      Opsiyonel
                    </span>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Karşılıklı Onay Durumu (Two-Box Status Card) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-display font-bold text-[#0B192C]">
              Karşılıklı Onay Durumu
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Left Box: Tenant Approval */}
              <div
                className={`rounded-xl border p-4 ${
                  checklist.sealed
                    ? 'bg-emerald-50/70 border-emerald-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 shrink-0 ${
                      checklist.sealed ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Kiracı Onayı
                  </span>
                </div>
                <p
                  className={`mt-1.5 text-sm font-bold ${
                    checklist.sealed ? 'text-emerald-800' : 'text-[#0B192C]'
                  }`}
                >
                  {checklist.sealed
                    ? 'Onaylandı • SMS (OTP) ile Mühürlendi'
                    : 'Kiracı Onayı Bekleniyor (Gönderime Hazır)'}
                </p>
                {checklist.sealed && checklist.sealHash && (
                  <p className="mt-1 text-[11px] font-mono-tabular text-emerald-700">
                    Mühür: {checklist.sealHash} · {checklist.sealedAt}
                  </p>
                )}
              </div>

              {/* Right Box: Landlord Approval */}
              <div
                className={`rounded-xl border p-4 ${
                  checklist.landlordStatus === 'approved'
                    ? 'bg-emerald-50/70 border-emerald-600'
                    : checklist.landlordStatus === 'objected'
                    ? 'bg-amber-50/70 border-amber-400'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {checklist.landlordStatus === 'approved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  ) : checklist.landlordStatus === 'objected' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ev Sahibi Onayı
                  </span>
                </div>
                <p
                  className={`mt-1.5 text-sm font-bold ${
                    checklist.landlordStatus === 'approved'
                      ? 'text-emerald-800'
                      : checklist.landlordStatus === 'objected'
                      ? 'text-amber-900'
                      : 'text-[#0B192C]'
                  }`}
                >
                  {checklist.landlordStatus === 'approved'
                    ? `Onaylandı • Ev Sahibi SMS (OTP) ile Mühürlendi`
                    : checklist.landlordStatus === 'objected'
                    ? `İtiraz Notu Eklendi (${checklist.landlordReviewedAt})`
                    : 'Ev Sahibi İncelemesi Bekleniyor (Bir tarafın onayı diğerinin yerine geçmez)'}
                </p>
                {checklist.landlordStatus === 'objected' && checklist.landlordNote && (
                  <p className="mt-1 text-xs text-amber-900">
                    &ldquo;{checklist.landlordNote}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Clear Rule Notice */}
            <div className="bg-[#0B192C]/[0.03] border border-slate-200/80 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Teslim tutanağı yalnızca hem kiracının hem de ev sahibinin ayrı ayrı SMS (OTP)
                onayı vermesiyle kesinleşir ve Güven Karnesine işlenir.
              </span>
            </div>
          </div>

          {/* Step 3 Footer Actions */}
          {!checklist.sealed ? (
            <div className="pt-1 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Geri</span>
              </button>

              <button
                type="button"
                onClick={onSealProtocol}
                className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Onayla ve Ev Sahibinin İncelemesine Gönder</span>
              </button>
            </div>
          ) : (
            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="min-h-[46px] px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-medium text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Fotoğrafları Gör</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('trust-card')}
                  className="min-h-[46px] px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-semibold text-sm rounded-xl transition-colors"
                >
                  Karneyi İncele
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('receipts')}
                  disabled={checklist.landlordStatus !== 'approved'}
                  className="min-h-[46px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                >
                  {checklist.landlordStatus === 'approved' ? (
                    <>
                      <span>Kira Ödemelerine Geç</span>
                      <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                    </>
                  ) : (
                    <span>⏳ Ev Sahibi Onayı Bekleniyor</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Camera Viewfinder Modal */}
      {cameraOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Oda fotoğrafı çekim ekranı"
        >
          <div className="w-full max-w-lg bg-[#0B192C] border border-white/15 rounded-3xl overflow-hidden text-white">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <p className="text-xs text-emerald-400 font-medium">Zaman Damgalı Vizör</p>
                <h3 className="text-base font-display font-bold">{activeRoomDef.label}</h3>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                aria-label="Kamerayı kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
              {!cameraError ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <ResilientImage
                    src={getSampleImageForRoom(selectedRoom)}
                    alt="Önizleme oda görüntüsü"
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-x-4 bottom-4 bg-[#0B192C]/90 border border-white/15 rounded-xl p-3 text-xs text-slate-200">
                    {cameraError}
                  </div>
                </div>
              )}

              <div
                className="pointer-events-none absolute inset-6 border border-emerald-400/50 rounded-xl"
                aria-hidden="true"
              />
            </div>

            <div className="p-5 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-300 font-mono-tabular">
                <p>Konum: {propertyTitle}</p>
                <p className="text-emerald-400">
                  Durum: {condition === 'hasarsiz' ? 'Hasarsız' : 'Mevcut Kusur'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCaptureFromCamera}
                className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center gap-2 shrink-0"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                <span>Fotoğrafı Kaydet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
