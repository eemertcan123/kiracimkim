import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, MessageCircle, ReceiptText, Share2,
} from 'lucide-react';

const steps = [
  {
    title: 'Kiracılık geçmişin artık tek yerde',
    description: 'Evin teslim durumunu, kira ödemelerini ve ev sahibi değerlendirmelerini tek yerden takip edebilirsin.',
  },
  {
    title: 'Geçmişini ev sahibinle paylaş',
    description: 'Paylaşım kodunu ev sahibine göndererek Güven Karneni incelemesini sağlayabilirsin.',
  },
  {
    title: 'Ev sahibinden gelen daveti kabul et',
    description: 'Ev sahibin sana 6 haneli bir davet kodu verir. Bu kodu girerek kiracılık sürecini başlatabilirsin.',
  },
];

const exampleRecords = [
  { name: 'Teslim Tutanağı', icon: FileCheck2 },
  { name: 'Kira Dekontu', icon: ReceiptText },
];

const guideButton =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

function StepPreview({ step }: { step: number }) {
  return (
    <figure aria-label="Temsili önizleme" className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3 sm:p-4 [@media(min-height:760px)]:p-4">
      <figcaption className="mb-2 text-xs font-semibold text-emerald-800 [@media(min-height:760px)]:mb-3">Temsili örnek</figcaption>
      {step === 0 && (
        <ul className="divide-y divide-emerald-100 rounded-xl bg-white px-3">
          {exampleRecords.map(({ name, icon: Icon }) => (
            <li key={name} className="flex items-center gap-2.5 py-2.5 text-sm font-semibold [@media(min-height:760px)]:py-4">
              <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span className="flex-1">{name}</span>
              <CheckCircle2 className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
            </li>
          ))}
        </ul>
      )}
      {step === 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 [@media(min-height:760px)]:py-3">
            <span className="text-xs font-medium text-slate-600">Paylaşım kodu</span>
            <span className="font-mono-tabular text-sm font-bold text-emerald-800">KMK-XXXX</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 [@media(min-height:760px)]:py-3">
            <MessageCircle className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-xs leading-snug text-slate-600">
              <span className="block font-semibold text-[#0B192C]">WhatsApp</span>
              Güven Karnemi bu kodla inceleyebilirsin.
            </span>
            <Share2 className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-2.5 rounded-xl bg-white p-3 [@media(min-height:760px)]:space-y-3 [@media(min-height:760px)]:py-4">
          <div className="mx-auto grid max-w-[15rem] grid-cols-6 gap-1.5" role="img" aria-label="Örnek davet kodu 4 8 2 9 1 0">
            {Array.from('482910', (digit, index) => (
              <span key={index} aria-hidden="true" className="grid h-8 min-w-0 place-items-center rounded-md border border-slate-200 bg-slate-50 font-mono-tabular text-sm font-bold [@media(min-height:760px)]:h-10">
                {digit}
              </span>
            ))}
          </div>
          <span className="mx-auto block w-fit rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900">
            Daveti kabul et
          </span>
        </div>
      )}
    </figure>
  );
}

interface TenantGettingStartedProps {
  firstName?: string;
  onComplete: () => void;
}

export function TenantGettingStarted({ firstName, onComplete }: TenantGettingStartedProps) {
  const [step, setStep] = useState(0);
  const titleId = useId();
  const welcomeRef = useRef<HTMLHeadingElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const currentStep = steps[step];
  const isFinalStep = step === steps.length - 1;

  useEffect(() => {
    welcomeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [step]);

  const moveStep = (nextStep: number) => {
    setStep(nextStep);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  return (
    <section aria-labelledby={titleId} className="mx-auto grid h-[calc(100dvh-53px)] w-full max-w-xl grid-rows-[minmax(0,1fr)_auto] lg:h-[calc(100dvh-65px)]">
      <div ref={contentRef} className="overflow-y-auto overscroll-contain px-4 sm:px-6">
        <div className="flex min-h-full flex-col gap-4 py-5 sm:gap-6 sm:py-6 [@media(min-height:760px)]:pt-9">
          <div>
            <h1 id={titleId} ref={welcomeRef} tabIndex={-1} className="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl max-sm:[@media(min-height:760px)]:text-3xl">
              {firstName ? `Hoş geldin, ${firstName}` : "KiracımKim'e hoş geldin"}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base [@media(min-height:760px)]:text-base">
              3 kısa adımda Güven Karneni nasıl kullanacağını keşfet.
            </p>
          </div>

          <div aria-label={`Adım ${step + 1} / ${steps.length}`} role="group" className="flex gap-1.5">
            {steps.map(({ title }, index) => (
              <span
                key={title}
                aria-hidden="true"
                className={`h-1.5 flex-1 rounded-full ${index === step ? 'bg-emerald-700' : index < step ? 'bg-emerald-300' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          <article className="my-auto rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5 [@media(min-height:760px)]:p-5">
            <StepPreview step={step} />
            <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-lg font-bold leading-snug sm:text-xl [@media(min-height:760px)]:mt-4 [@media(min-height:760px)]:text-xl">
              <span className="sr-only">Adım {step + 1} / {steps.length}. </span>
              {currentStep.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 sm:text-base [@media(min-height:760px)]:text-base">{currentStep.description}</p>
          </article>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-[#F6F8FB] px-4 pt-2.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] sm:px-6 [@media(min-height:760px)]:pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button type="button" className={`${guideButton} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100`} onClick={() => moveStep(step - 1)}>
              <ArrowLeft className="size-4 shrink-0" aria-hidden="true" /> Geri
            </button>
          )}
          <button
            type="button"
            className={`${guideButton} flex-1 bg-emerald-700 text-white hover:bg-emerald-800`}
            onClick={isFinalStep ? onComplete : () => moveStep(step + 1)}
          >
            {isFinalStep ? 'Güven Karneme Git' : 'İleri'}
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
        <button type="button" onClick={onComplete} className="mx-auto mt-1 block min-h-[44px] rounded-lg px-1.5 text-center text-sm font-semibold text-emerald-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-700">
          Rehberi atla ve Güven Karneme geç →
        </button>
      </div>
    </section>
  );
}
