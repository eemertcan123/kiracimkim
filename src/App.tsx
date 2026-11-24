import { useState, useCallback, useRef, useEffect } from 'react';
import { Building2, CheckCircle2, Plus } from 'lucide-react';
import { TopNav } from './components/TopNav';
import { MobileTabBar } from './components/MobileTabBar';
import { AddPropertyPayload, LandlordPropertyBar } from './components/LandlordPropertyBar';
import { NewApartmentModal } from './components/NewApartmentModal';
import { TenantGettingStarted } from './components/TenantGettingStarted';
import { TenantInviteDock } from './components/TenantInviteDock';
import { TenantStatusBar } from './components/TenantStatusBar';
import { LoginScreen } from './screens/LoginScreen';
import { HandoverScreen } from './screens/HandoverScreen';
import { ReceiptScreen } from './screens/ReceiptScreen';
import { TrustCardScreen } from './screens/TrustCardScreen';
import { LandlordHandoverScreen } from './screens/landlord/LandlordHandoverScreen';
import { LandlordPaymentsScreen } from './screens/landlord/LandlordPaymentsScreen';
import { LandlordCandidateScreen } from './screens/landlord/LandlordCandidateScreen';
import {
  acceptRentalByInviteCode,
  createRentalMatch,
  findOrInsertPropertyForInvite,
  clearAppStorage,
  deleteProperty,
  insertProperty,
  handoverReportFromProperty,
  loadWorkspace,
  saveRentalHandoverReport,
  normalizeRole,
  publishHandoverApproval,
  submitTenantHandover,
  readActiveRole,
  roleFromLoginChoice,
  writeActiveRole,
  registerAccount,
  signInAccount,
  signOutAccount,
  TENANT_GUIDE_STORAGE_PREFIX,
  updatePledge,
  type PendingMatch,
  type TenantHistory,
} from './lib/account';
import { handoverSubmitError } from './lib/handoverSteps';
import { setRentalPaymentStatus, submitRentPayment } from './lib/payments';
import { supabase } from './lib/supabase';
import {
  ActivityEvent,
  formatMaskedPhone,
  HandoverChecklistState,
  HandoverPhoto,
  LandlordProperty,
  LandlordReference,
  RentReceipt,
  ScreenId,
  UserRole,
  UserSession,
  CandidateProfile,
} from './types/kiracimkim';

const EMPTY_TENANT_PROPERTY: LandlordProperty = {
  id: 'unset',
  nickname: 'Daire',
  officialLocation: 'Eşleşme bekleniyor',
  fullAddress: 'Henüz bağlı bir daire yok',
  tenantName: null,
  tenantMaskedName: null,
  pendingInvite: null,
  iban: '',
  contractStartDate: '',
  monthlyRent: 0,
  verificationStatus: 'draft_pending_otp',
  photos: [],
  checklist: {
    electricMeterNo: '',
    waterMeterNo: '',
    gasMeterNo: '',
    keysCount: 0,
    sealed: false,
    landlordStatus: 'pending',
  },
  receipts: [],
  rentIncreases: [],
  reference: null,
};

function authErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
  if (/invalid login credentials/i.test(raw)) return 'E-posta veya şifre hatalı.';
  if (/already registered|already been registered/i.test(raw)) {
    return 'Bu e-posta ile kayıtlı bir hesap var. Giriş yapın.';
  }
  if (/email not confirmed/i.test(raw)) {
    return 'E-posta adresinizi doğruladıktan sonra giriş yapın.';
  }
  if (/password/i.test(raw) && /least|short|weak/i.test(raw)) {
    return 'Şifre en az 6 karakter olmalıdır.';
  }
  return raw;
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('login');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const announcedHandoverRef = useRef(new Set<string>());

  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<UserSession>({
    authenticated: false,
    userId: '',
    fullName: '',
    maskedName: '',
    phone: '',
    role: 'tenant',
    verifiedViaEDevlet: false,
    activeTenantPropertyId: '',
    carnetCode: '',
  });
  const roleRef = useRef(session.role);
  roleRef.current = session.role;
  const activeUserRef = useRef('');

  const [ownedProperties, setOwnedProperties] = useState<LandlordProperty[]>([]);
  const [tenantProperties, setTenantProperties] = useState<LandlordProperty[]>([]);
  const properties = session.role === 'landlord' ? ownedProperties : tenantProperties;
  const setProperties = session.role === 'landlord' ? setOwnedProperties : setTenantProperties;
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('empty-demo');
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [pendingMatch, setPendingMatch] = useState<PendingMatch | null>(null);
  const [addPropertyModalOpen, setAddPropertyModalOpen] = useState(false);
  const [newApartmentOpen, setNewApartmentOpen] = useState(false);

  const [focusedReceiptId, setFocusedReceiptId] = useState<string | null>(null);
  const [focusedCandidateCode, setFocusedCandidateCode] = useState<string | null>(null);
  const [activeTenantRentalId, setActiveTenantRentalId] = useState<string | null>(null);
  const tenantInviteStatus = activeTenantRentalId ? 'active' : 'pending';
  const [tenantMatchDismissed, setTenantMatchDismissed] = useState(false);
  const [transparentEntryPledged, setTransparentEntryPledged] = useState(false);
  const [pledgePromptCode, setPledgePromptCode] = useState<string | null>(null);
  const [pledgeSaving, setPledgeSaving] = useState(false);
  const [tenantHistory, setTenantHistory] = useState<TenantHistory | null>(null);
  const [tenantHistoryRefreshFailed, setTenantHistoryRefreshFailed] = useState(false);
  const [tenantGuideComplete, setTenantGuideComplete] = useState(false);
  const [tenantGuideReopened, setTenantGuideReopened] = useState(false);
  const [tenantFirstName, setTenantFirstName] = useState<string>();
  const mainRef = useRef<HTMLElement>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3400);
  }, []);

  const resetPanelState = useCallback(() => {
    setOwnedProperties([]);
    setTenantProperties([]);
    setCandidates([]);
    setPendingMatch(null);
    setActivities([]);
    setSelectedPropertyId('empty-demo');
    setFocusedReceiptId(null);
    setFocusedCandidateCode(null);
    setActiveTenantRentalId(null);
    setTenantMatchDismissed(false);
    setTransparentEntryPledged(false);
    setTenantHistory(null);
    setTenantHistoryRefreshFailed(false);
    setTenantGuideComplete(false);
    setTenantGuideReopened(false);
    setTenantFirstName(undefined);
    setAddPropertyModalOpen(false);
    setNewApartmentOpen(false);
    announcedHandoverRef.current.clear();
  }, []);

  const applyWorkspace = useCallback(
    async (userId: string, navigate: boolean, explicitRole?: UserRole) => {
      activeUserRef.current = userId;
      const workspace = await loadWorkspace(userId);
      if (activeUserRef.current !== userId) return null;
      const viewRole = explicitRole ?? readActiveRole() ?? workspace.session.role;
      const profileName = workspace.profile.full_name?.trim();
      writeActiveRole(viewRole);
      setSession({ ...workspace.session, role: viewRole });
      setTenantFirstName(
        profileName && profileName !== 'Kullanıcı' && !profileName.includes('@')
          ? profileName.split(/\s+/)[0]
          : undefined
      );
      setOwnedProperties(workspace.ownedProperties);
      setTenantProperties(workspace.tenantProperties);
      setTransparentEntryPledged(workspace.transparentEntryPledged);
      setTenantHistory(workspace.tenantHistory);
      setTenantHistoryRefreshFailed(false);
      setActiveTenantRentalId(workspace.activeRentalId);
      setTenantMatchDismissed(workspace.tenantMatchDismissed);
      setPendingMatch(workspace.pendingMatch);
      setCandidates(workspace.candidates);
      setSelectedPropertyId(workspace.ownedProperties.length === 0 ? 'empty-demo' : 'all');
      if (navigate) {
        try {
          setTenantGuideComplete(localStorage.getItem(TENANT_GUIDE_STORAGE_PREFIX + userId) === 'done');
        } catch {
          setTenantGuideComplete(false);
        }
        setTenantGuideReopened(false);
        setActiveScreen(viewRole === 'landlord' ? 'landlord-candidates' : 'trust-card');
      }
      setAuthReady(true);
      return workspace;
    },
    []
  );

  const announceHandoverApproval = useCallback((propertyId: string) => {
    if (roleRef.current !== 'tenant') return;
    if (announcedHandoverRef.current.has(propertyId)) return;
    announcedHandoverRef.current.add(propertyId);
    showToast(
      '✅ Ev sahibiniz teslim tutanağını onayladı! Artık kira ödemelerinize geçebilirsiniz.'
    );
  }, [showToast]);

  const syncRentals = useCallback(async (userId: string) => {
    const workspace = await loadWorkspace(userId).catch(() => {
      if (activeUserRef.current === userId) setTenantHistoryRefreshFailed(true);
      return null;
    });
    if (!workspace || activeUserRef.current !== userId) return;
    setOwnedProperties(workspace.ownedProperties);
    setCandidates(workspace.candidates);
    setPendingMatch(workspace.pendingMatch);
    setActiveTenantRentalId(workspace.activeRentalId);
    setTenantMatchDismissed(workspace.tenantMatchDismissed);
    setTenantHistory(workspace.tenantHistory);
    setTenantHistoryRefreshFailed(false);
    setTenantProperties((prev) =>
      workspace.tenantProperties.map((next) => {
        const current = prev.find((item) => item.rentalId === next.rentalId);
        const landlordApproved =
          current?.checklist.landlordStatus === 'approved' ||
          next.checklist.landlordStatus === 'approved';
        if (
          current &&
          current.checklist.landlordStatus !== 'approved' &&
          next.checklist.landlordStatus === 'approved'
        ) {
          announceHandoverApproval(next.id);
        }
        if (!current) return next;
        const receivedSubmission = !current.tenantSubmitted && next.tenantSubmitted;
        const handover = receivedSubmission && !current.checklist.sealed ? next : current;
        return {
          ...handover,
          nickname: next.nickname,
          officialLocation: next.officialLocation,
          reference: next.reference ?? current.reference,
          receipts: next.receipts,
          tenantSubmitted: receivedSubmission ? true : current.tenantSubmitted,
          landlordUserId: next.landlordUserId,
          checklist: landlordApproved
            ? { ...handover.checklist, landlordStatus: 'approved' }
            : handover.checklist,
        };
      })
    );
  }, [announceHandoverApproval]);

  const refreshTenantInvites = useCallback(() => {
    if (!session.userId) return Promise.resolve();
    return syncRentals(session.userId);
  }, [session.userId, syncRentals]);

  useEffect(() => {
    if (!session.authenticated || !session.userId) return;
    const userId = session.userId;
    const channel = supabase
      .channel(`rentals-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rentals' },
        () => {
          void syncRentals(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rent_payments' },
        () => {
          void syncRentals(userId);
        }
      )
      .subscribe();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void syncRentals(userId);
    }, 4000);
    return () => {
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [session.authenticated, session.userId, syncRentals]);

  const tenantPropertyKey = tenantProperties.map((property) => property.id).join('|');
  useEffect(() => {
    if (!session.authenticated) return;
    const ids = tenantPropertyKey.split('|').filter((id) => id && id !== 'unset');
    if (ids.length === 0) return;
    const channels = ids.map((propertyId) =>
      supabase
        .channel(`handover-approval-${propertyId}`)
        .on('broadcast', { event: 'approved' }, () => {
          setTenantProperties((prev) =>
            prev.map((property) =>
              property.id === propertyId
                ? {
                    ...property,
                    checklist: { ...property.checklist, landlordStatus: 'approved' },
                  }
                : property
            )
          );
          announceHandoverApproval(propertyId);
        })
        .subscribe()
    );
    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [session.authenticated, tenantPropertyKey, announceHandoverApproval]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        setAuthReady(true);
        return;
      }
      window.setTimeout(() => {
        if (!active) return;
        void applyWorkspace(data.session.user.id, true).catch(() => {
          if (!active) return;
          showToast('Panel bilgileri yüklenemedi. Tekrar giriş yapmayı deneyin.');
          setAuthReady(true);
        });
      }, 0);
    });
    return () => {
      active = false;
    };
  }, [applyWorkspace, showToast]);

  const formatTimestamp = (useBullet = false) => {
    const now = new Date();
    const sep = useBullet ? ' • ' : ' · ';
    return `${String(now.getDate()).padStart(2, '0')}.${String(
      now.getMonth() + 1
    ).padStart(2, '0')}.${now.getFullYear()}${sep}${String(now.getHours()).padStart(
      2,
      '0'
    )}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const selectedTenantRentalId = activeTenantRentalId ?? pendingMatch?.rentalId;
  const tenantProperty =
    (selectedTenantRentalId && tenantProperties.find((property) => property.rentalId === selectedTenantRentalId)) ||
    EMPTY_TENANT_PROPERTY;

  const handleNavigate = (screen: ScreenId) => {
    if (!session.authenticated && screen !== 'login') {
      showToast('Devam etmek için giriş yapın veya kayıt olun.');
      setActiveScreen('login');
      return;
    }
    if (
      session.role === 'tenant' &&
      tenantInviteStatus === 'pending' &&
      (screen === 'handover' || screen === 'receipts')
    ) {
      showToast(
        'Teslim Tutanağı ve Kira Ödemeleri sekmelerini açmak için önce Güven Karnem ekranındaki kiralama kaydını onaylamalısınız.'
      );
      if (activeScreen === 'login') {
        setActiveScreen('trust-card');
      }
      return;
    }
    if (screen !== 'trust-card') setTenantGuideReopened(false);
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddProperty = (payload: AddPropertyPayload) => {
    if (!session.userId) {
      showToast('Daire eklemek için giriş yapın.');
      return;
    }
    const isVerified = payload.verificationMethod === 'document' && Boolean(payload.verificationDocName);

    void insertProperty({
      landlordId: session.userId,
      title: payload.nickname,
      district: payload.officialLocation,
    })
      .then((created) => {
        const newProperty: LandlordProperty = {
          ...created,
          fullAddress: `${payload.officialLocation} · ${
            isVerified ? 'Belge Doğrulamalı Mülk' : 'Taslak Mülk (OTP Bekliyor)'
          }`,
          pendingInvite: null,
          verificationStatus: isVerified ? 'verified' : 'draft_pending_otp',
          verificationDocName: payload.verificationDocName,
        };
        setOwnedProperties((prev) => [...prev, newProperty]);
        if (selectedPropertyId === 'empty-demo') {
          setSelectedPropertyId('all');
        }
        setActivities((prev) => [
          {
            id: `act-${Date.now()}`,
            timestamp: formatTimestamp(true),
            actorName: session.fullName || 'Ev Sahibi',
            propertyId: created.id,
            propertyNickname: payload.nickname,
            description: isVerified
              ? `mülkiyet belgesi (${payload.verificationDocName}) ile yeni mülk ekledi`
              : 'yeni mülk kaydı oluşturdu',
            actionLabel: 'Mülke Git',
            targetScreen: 'landlord-handover',
          },
          ...prev,
        ]);
        showToast(`"${payload.nickname}" (${payload.officialLocation}) listenize eklendi.`);
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleCreateApartment = async (title: string, district: string) => {
    if (!session.userId) {
      throw new Error('Daire eklemek için giriş yapın.');
    }
    try {
      const created = await insertProperty({
        landlordId: session.userId,
        title,
        district,
      });
      setOwnedProperties((prev) => [...prev, created]);
      setSelectedPropertyId(created.id);
      setActiveScreen('landlord-candidates');
      setNewApartmentOpen(false);
      showToast(`"${created.nickname}" listenize eklendi.`);
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const handleInviteTenant = (
    propertyId: string,
    payload: { fullName: string; phone: string }
  ) => {
    const targetProp = properties.find((p) => p.id === propertyId);
    const maskedPhone = formatMaskedPhone(payload.phone);
    const invitedAt = formatTimestamp(false);
    const cleanName = payload.fullName.trim();

    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === propertyId
          ? {
              ...prop,
              pendingInvite: {
                fullName: cleanName || undefined,
                phone: payload.phone.trim(),
                maskedPhone,
                invitedAt,
              },
            }
          : prop
      )
    );

    const carnetMatch = payload.fullName.match(/KMK-\d{4}-\d{4}/i);
    if (carnetMatch && session.userId) {
      void createRentalMatch({
        propertyId,
        landlordId: session.userId,
        carnetCode: carnetMatch[0].toUpperCase(),
      }).catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
    }

    if (targetProp) {
      setActivities((prev) => [
        {
          id: `act-${Date.now()}`,
          timestamp: formatTimestamp(true),
          actorName: 'Ev Sahibi',
          propertyId,
          propertyNickname: targetProp.nickname,
          description: cleanName
            ? `${cleanName} (${maskedPhone}) için SMS kiracı daveti gönderdi`
            : `${maskedPhone} numarasına SMS kiracı daveti gönderdi`,
          actionLabel: 'Mülke Git',
          targetScreen: 'landlord-handover',
        },
        ...prev,
      ]);
      showToast(
        `${targetProp.nickname} için kiracı daveti (${maskedPhone}) gönderildi ve bağlantı kopyalandı.`
      );
    }
  };

  const handleCreatePropertyForInvite = async (title: string, district: string) => {
    if (!session.userId) throw new Error('Daire eklemek için giriş yapın.');
    try {
      const property = await findOrInsertPropertyForInvite({
        landlordId: session.userId,
        title,
        district,
      });
      setOwnedProperties((prev) =>
        prev.some((entry) => entry.id === property.id) ? prev : [...prev, property]
      );
      if (selectedPropertyId === 'empty-demo') setSelectedPropertyId('all');
      return property.id;
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const handleSendKmkInvite = async (propertyId: string, carnetCode: string) => {
    if (!session.userId) {
      throw new Error('Davet kodu oluşturmak için giriş yapın.');
    }
    let inviteCode = '';
    try {
      const created = await createRentalMatch({
        propertyId,
        landlordId: session.userId,
        carnetCode,
      });
      inviteCode = created.invite_code ?? '';
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
    const invitedAt = formatTimestamp(false);
    setOwnedProperties((prev) =>
      prev.map((prop) =>
        prop.id === propertyId
          ? {
              ...prop,
              pendingInvite: {
                phone: '',
                maskedPhone: inviteCode || carnetCode,
                invitedAt,
              },
            }
          : prop
      )
    );
    showToast('Davet kodu oluşturuldu.');
    return inviteCode;
  };

  const completeInviteCode = (rawCode: string) => {
    if (!session.userId) return;
    void acceptRentalByInviteCode(session.userId, rawCode)
      .then(() => applyWorkspace(session.userId, false))
      .then(() => {
        setActiveScreen('handover');
        showToast('Davet Onaylandı! Şimdi daire teslim tutanağını oluşturabilirsiniz.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleSubmitInviteCode = (rawCode: string) => {
    if (!session.userId) return;
    const noHistory =
      tenantHistory?.approvedPaymentCount === 0 && tenantHistory.references.length === 0;
    if (noHistory) {
      setPledgePromptCode(rawCode.trim());
      return;
    }
    completeInviteCode(rawCode);
  };

  const continueInviteAfterPledge = async (acceptPledge: boolean) => {
    if (!pledgePromptCode || pledgeSaving) return;
    setPledgeSaving(true);
    try {
      if (acceptPledge) await handleSetTransparentPledge(true);
      const code = pledgePromptCode;
      setPledgePromptCode(null);
      completeInviteCode(code);
    } catch {
      return;
    } finally {
      setPledgeSaving(false);
    }
  };

  const handleRemindTenantInvite = (propertyId: string) => {
    const targetProp = properties.find((p) => p.id === propertyId);
    if (!targetProp?.pendingInvite) return;
    const { maskedPhone } = targetProp.pendingInvite;
    const remindedAt = formatTimestamp(false);

    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === propertyId && prop.pendingInvite
          ? {
              ...prop,
              pendingInvite: {
                ...prop.pendingInvite,
                invitedAt: remindedAt,
              },
            }
          : prop
      )
    );

    showToast(
      `${targetProp.nickname} için ${maskedPhone} numarasına hatırlatma SMS'i yeniden gönderildi.`
    );
  };

  const handleCancelPendingInvite = (propertyId: string) => {
    const targetProp = properties.find((p) => p.id === propertyId);
    if (!targetProp?.pendingInvite) return;

    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === propertyId ? { ...prop, pendingInvite: null } : prop
      )
    );
    showToast(`${targetProp.nickname} için bekleyen kiracı daveti iptal edildi.`);
  };

  const handleDeleteProperty = (propertyId: string) => {
    const targetProp = properties.find((p) => p.id === propertyId);
    if (!targetProp) return;

    if (!session.userId) return;
    void deleteProperty(propertyId, session.userId)
      .then(() => {
        setProperties((prev) => prev.filter((prop) => prop.id !== propertyId));
        setActivities((prev) => prev.filter((act) => act.propertyId !== propertyId));
        if (selectedPropertyId === propertyId) {
          setSelectedPropertyId('all');
        }
        showToast(`${targetProp.nickname} kaydı listeden silindi.`);
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleActivityAction = (event: ActivityEvent) => {
    setSelectedPropertyId(event.propertyId);
    if (event.receiptId) {
      setFocusedReceiptId(event.receiptId);
    }
    if (event.candidateCode) {
      setFocusedCandidateCode(event.candidateCode);
    }
    setActiveScreen(event.targetScreen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Tenant Handover handlers (scoped to tenantProperty)
  const updateTenantProperty = (updater: (prop: LandlordProperty) => LandlordProperty) => {
    setProperties((prev) =>
      prev.map((prop) => (prop.id === tenantProperty.id ? updater(prop) : prop))
    );
  };

  const persistTenantHandover = (property: LandlordProperty) => {
    if (!property.rentalId) return;
    void saveRentalHandoverReport(property.rentalId, handoverReportFromProperty(property)).catch(
      (error: unknown) => {
        console.error(error);
      }
    );
  };

  const handleAddPhoto = (photo: HandoverPhoto) => {
    updateTenantProperty((prop) => {
      const next = { ...prop, photos: [photo, ...prop.photos] };
      persistTenantHandover(next);
      return next;
    });
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        timestamp: formatTimestamp(true),
        actorName: session.fullName,
        propertyId: tenantProperty.id,
        propertyNickname: tenantProperty.nickname,
        description: `teslim tutanağına ${photo.roomLabel} fotoğrafı ekledi`,
        actionLabel: 'Tutanağa Git',
        targetScreen: 'landlord-handover',
      },
      ...prev,
    ]);
  };

  const handleDeletePhoto = (id: string) => {
    updateTenantProperty((prop) => {
      const next = { ...prop, photos: prop.photos.filter((item) => item.id !== id) };
      persistTenantHandover(next);
      return next;
    });
    showToast('Fotoğraf tutanak kaydından kaldırıldı.');
  };

  const handleTogglePhotoCondition = (id: string) => {
    updateTenantProperty((prop) => {
      const next = {
        ...prop,
        photos: prop.photos.map((item) =>
          item.id === id
            ? {
                ...item,
                condition: item.condition === 'hasarsiz' ? ('kusurlu' as const) : ('hasarsiz' as const),
              }
            : item
        ),
      };
      persistTenantHandover(next);
      return next;
    });
  };

  const handleUpdateChecklist = (next: Partial<HandoverChecklistState>) => {
    updateTenantProperty((prop) => {
      const updated = { ...prop, checklist: { ...prop.checklist, ...next } };
      persistTenantHandover(updated);
      return updated;
    });
  };

  const handleSealProtocol = () => {
    const incomplete = handoverSubmitError(tenantProperty.photos, tenantProperty.checklist);
    if (incomplete) {
      showToast(incomplete);
      return;
    }
    if (!tenantProperty.rentalId || tenantProperty.id === 'unset') {
      const message = 'Teslim tutanağı gönderilemedi. Aktif kiralama kaydı bulunamadı.';
      console.error(message);
      showToast(message);
      return;
    }
    const ts = formatTimestamp(false);
    const rentalId = tenantProperty.rentalId;
    const seal = (prop: LandlordProperty): LandlordProperty => {
      if (prop.rentalId !== rentalId) return prop;
      const next = {
        ...prop,
        checklist: {
          ...prop.checklist,
          sealed: true,
          sealedAt: ts,
          sealHash: 'KMK-TT-2026-9A4F',
        },
      };
      persistTenantHandover(next);
      return next;
    };
    setTenantProperties((prev) => prev.map(seal));
    setOwnedProperties((prev) => prev.map(seal));
    void submitTenantHandover(rentalId, handoverReportFromProperty(tenantProperty))
      .then(() => {
        const markSubmitted = (prop: LandlordProperty): LandlordProperty =>
          prop.rentalId === rentalId ? { ...prop, tenantSubmitted: true } : prop;
        setTenantProperties((prev) => prev.map(markSubmitted));
        setOwnedProperties((prev) => prev.map(markSubmitted));
        showToast('Teslim tutanağı zaman damgasıyla mühürlendi ve Ev Sahibi onayına sunuldu.');
      })
      .catch((error: unknown) => {
        console.error('Teslim tutanağı gönderilemedi:', error);
        showToast(error instanceof Error ? error.message : 'Teslim tutanağı gönderilemedi.');
      });
  };

  // Landlord Handover handlers (scoped by propertyId)
  const handleLandlordApproveProtocol = (propertyId: string) => {
    const reviewedAt = formatTimestamp(false);
    const approve = (prop: LandlordProperty) =>
      prop.id === propertyId
        ? {
            ...prop,
            checklist: {
              ...prop.checklist,
              sealed: true,
              sealedAt: prop.checklist.sealedAt ?? reviewedAt,
              sealHash: prop.checklist.sealHash ?? 'KMK-TT-2026-9A4F',
              landlordStatus: 'approved' as const,
              landlordReviewedAt: reviewedAt,
              landlordNote: undefined,
            },
          }
        : prop;
    const rentalId = ownedProperties.find((prop) => prop.id === propertyId)?.rentalId;
    setOwnedProperties((prev) => prev.map(approve));
    setTenantProperties((prev) => prev.map(approve));
    void publishHandoverApproval(propertyId, rentalId).catch((error: unknown) => {
      showToast(authErrorMessage(error));
    });
    showToast('Teslim tutanağı SMS (OTP) ile onaylandı ve çift taraflı mühürlendi.');
  };

  const handleLandlordObjectProtocol = (propertyId: string, note: string) => {
    const reviewedAt = formatTimestamp(false);
    setProperties((prev) =>
      prev.map((prop) =>
        prop.id === propertyId
          ? {
              ...prop,
              checklist: {
                ...prop.checklist,
                landlordStatus: 'objected',
                landlordNote: note,
                landlordReviewedAt: reviewedAt,
              },
            }
          : prop
      )
    );
    showToast('İtiraz notunuz tutanağa kaydedildi ve kiracıya iletildi.');
  };

  const patchReceiptStatus = (
    propertyId: string,
    receiptId: string,
    status: RentReceipt['status'],
    objectionNote?: string
  ) => {
    const patch = (list: LandlordProperty[]) =>
      list.map((prop) =>
        prop.id === propertyId
          ? {
              ...prop,
              receipts: prop.receipts.map((receipt) =>
                receipt.id === receiptId
                  ? {
                      ...receipt,
                      status,
                      ibanMatched: status === 'Onaylandı',
                      landlordApprovedAt:
                        status === 'Onaylandı' ? formatTimestamp(false) : receipt.landlordApprovedAt,
                      objectionNote: status === 'İtirazlı' ? objectionNote : undefined,
                    }
                  : receipt
              ),
            }
          : prop
      );
    setOwnedProperties(patch);
    setTenantProperties(patch);
  };

  // Tenant Receipt upload
  const handleVerifyReceipt = async (payload: {
    amount: number;
    period: string;
    paymentDate: string;
    file: File;
  }) => {
    if (!session.userId) {
      throw new Error('Dekont göndermek için giriş yapın.');
    }
    if (!tenantProperty.rentalId || !tenantProperty.landlordUserId || tenantProperty.id === 'unset') {
      throw new Error('Aktif kiralama kaydı bulunamadı. Önce daveti onaylayın.');
    }
    await submitRentPayment({
      file: payload.file,
      amount: payload.amount,
      period: payload.period,
      paymentDate: payload.paymentDate,
      rentalId: tenantProperty.rentalId,
      propertyId: tenantProperty.id,
      tenantId: session.userId,
      landlordId: tenantProperty.landlordUserId,
    });
    try {
      await syncRentals(session.userId);
    } catch {
      // Kayıt yazıldı. Açık oturumdaki yenileme kaydı tekrar çeker.
    }
    showToast('Kira dekontunuz ev sahibi onayına gönderildi.');
  };

  // Landlord Receipt approval/objection
  const rentalIdForProperty = (propertyId: string) =>
    ownedProperties.find((property) => property.id === propertyId)?.rentalId ??
    tenantProperties.find((property) => property.id === propertyId)?.rentalId;

  const handleApproveReceipt = (propertyId: string, receiptId: string) => {
    const rentalId = rentalIdForProperty(propertyId);
    if (!rentalId) {
      showToast('Ödeme kaydının bağlı olduğu kiralama bulunamadı.');
      return;
    }
    void setRentalPaymentStatus(rentalId, receiptId, 'approved')
      .then(async () => {
        patchReceiptStatus(propertyId, receiptId, 'Onaylandı');
        showToast('Dekont onaylandı. Kiracının Güven Karnesi katkısı güncellendi.');
        if (!session.userId) return;
        try {
          await syncRentals(session.userId);
        } catch {
          // Onay yazıldı. Periyodik yenileme sayaçları tekrar eşitler.
        }
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleObjectReceipt = (propertyId: string, receiptId: string, reason: string) => {
    const rentalId = rentalIdForProperty(propertyId);
    if (!rentalId) {
      showToast('Ödeme kaydının bağlı olduğu kiralama bulunamadı.');
      return;
    }
    void setRentalPaymentStatus(rentalId, receiptId, 'objected')
      .then(async () => {
        patchReceiptStatus(propertyId, receiptId, 'İtirazlı', reason);
        showToast('Dekont için itiraz kaydedildi ve kiracıya yansıdı.');
        if (!session.userId) return;
        try {
          await syncRentals(session.userId);
        } catch {
          // İtiraz yazıldı. Periyodik yenileme listeyi tekrar eşitler.
        }
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleSignReference = (propertyId: string, nextRef: LandlordReference) => {
    setProperties((prev) =>
      prev.map((prop) => (prop.id === propertyId ? { ...prop, reference: nextRef } : prop))
    );
  };

  const isLandlordScreen = activeScreen.startsWith('landlord-');
  const tenantLandlordName =
    tenantProperty.reference?.landlordName ?? pendingMatch?.landlordName ?? 'Ev Sahibi';
  const lockedTenantScreens: ScreenId[] =
    session.role === 'tenant' && tenantInviteStatus === 'pending'
      ? ['handover', 'receipts']
      : [];
  const isTenantTrustCard = session.authenticated && session.role === 'tenant' && activeScreen === 'trust-card';
  const showTenantGuide = isTenantTrustCard && (
    tenantGuideReopened || (!tenantGuideComplete && !activeTenantRentalId && !pendingMatch)
  );

  const openTenantGuide = () => {
    setTenantGuideReopened(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const completeTenantGuide = () => {
    setTenantGuideComplete(true);
    setTenantGuideReopened(false);
    try {
      localStorage.setItem(TENANT_GUIDE_STORAGE_PREFIX + session.userId, 'done');
    } catch {
      // Completion still applies during this session.
    }
    requestAnimationFrame(() => mainRef.current?.focus());
  };

  const handleResetTenantDemo = () => {
    if (!session.userId) return;
    void applyWorkspace(session.userId, false)
      .then(() => {
        setActiveScreen('trust-card');
        showToast('Profil, daireler ve kiralama kayıtları yeniden yüklendi.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      });
  };

  const handleSetTransparentPledge = (pledged: boolean) => {
    if (!session.userId) return Promise.resolve();
    const previous = transparentEntryPledged;
    setTransparentEntryPledged(pledged);
    return updatePledge(session.userId, pledged)
      .then(() => {
        if (pledged) {
          showToast('Şeffaflık taahhüdü onaylandı.');
        }
      })
      .catch((error: unknown) => {
        setTransparentEntryPledged(previous);
        showToast(authErrorMessage(error));
        throw error;
      });
  };

  const isolateAccount = (nextUserId: string) => {
    if (activeUserRef.current && activeUserRef.current !== nextUserId) {
      clearAppStorage();
      resetPanelState();
    }
    activeUserRef.current = nextUserId;
  };

  const handleLogout = () => {
    activeUserRef.current = '';
    void signOutAccount()
      .catch((error: unknown) => {
        showToast(authErrorMessage(error));
      })
      .finally(() => {
        resetPanelState();
        setSession({
          authenticated: false,
          userId: '',
          fullName: '',
          maskedName: '',
          phone: '',
          role: 'tenant',
          verifiedViaEDevlet: false,
          activeTenantPropertyId: '',
          carnetCode: '',
        });
        setActiveScreen('login');
        setAuthReady(true);
      });
  };

  const handleLogin = async (email: string, password: string, selectedRole: UserRole) => {
    try {
      const result = await signInAccount(email, password);
      isolateAccount(result.userId);
      const viewRole = roleFromLoginChoice(normalizeRole(result.profile.role), selectedRole);
      await applyWorkspace(result.userId, true, viewRole);
      showToast('Giriş yapıldı. Paneliniz açıldı.');
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const handleRegister = async (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    try {
      const result = await registerAccount(input);
      if (result.needsEmailConfirmation) {
        showToast('Kayıt alındı. E-postanızdaki doğrulama bağlantısından sonra giriş yapın.');
        return;
      }
      isolateAccount(result.profile.id);
      await applyWorkspace(result.profile.id, true, input.role);
      showToast(
        input.role === 'tenant'
          ? 'Kiracı hesabınız oluşturuldu.'
          : 'Ev sahibi hesabınız oluşturuldu.'
      );
    } catch (error) {
      throw new Error(authErrorMessage(error));
    }
  };

  const openHomePanel = () => {
    if (!session.authenticated) return;
    setActiveScreen(session.role === 'landlord' ? 'landlord-candidates' : 'trust-card');
  };

  if (!authReady) {
    return <div className="min-h-screen bg-[#F6F8FB]" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FB] text-[#0B192C]">
      <TopNav
        activeScreen={activeScreen}
        role={session.role}
        lockedScreens={lockedTenantScreens}
        onNavigate={handleNavigate}
        onLogout={session.authenticated ? handleLogout : undefined}
      />

      {session.role === 'tenant' && activeScreen !== 'login' && session.authenticated && (
        <TenantInviteDock
          onSubmitCode={handleSubmitInviteCode}
          hideCodeForm={tenantInviteStatus === 'active' || activeScreen === 'trust-card'}
        />
      )}

      {session.role === 'tenant' && activeScreen !== 'login' && activeScreen !== 'trust-card' && (
        <TenantStatusBar
          status={tenantInviteStatus}
          matchDismissed={tenantMatchDismissed}
          hasVerifiedHistory={
            Boolean(tenantHistory && (tenantHistory.approvedPaymentCount > 0 || tenantHistory.references.length > 0))
          }
          officialLocation={tenantProperty.officialLocation}
          landlordName={tenantLandlordName}
          activeScreen={activeScreen}
          onGoToTrustCard={() => handleNavigate('trust-card')}
        />
      )}

      {session.role === 'landlord' &&
        selectedPropertyId !== 'empty-demo' &&
        (activeScreen === 'landlord-handover' || activeScreen === 'landlord-payments') && (
          <LandlordPropertyBar
          properties={properties}
          selectedPropertyId={selectedPropertyId}
          activities={activities}
          addModalOpen={addPropertyModalOpen}
          onAddModalOpenChange={setAddPropertyModalOpen}
          onSelectProperty={setSelectedPropertyId}
          onAddProperty={handleAddProperty}
          onActivityAction={handleActivityAction}
          onNotify={showToast}
        />
      )}

      <main ref={mainRef} tabIndex={-1} className={showTenantGuide ? 'flex-1' : 'flex-1 pb-28 lg:pb-12'}>

        {(!session.authenticated || activeScreen === 'login') && (
          <LoginScreen
            session={session}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onContinue={openHomePanel}
          />
        )}

        {activeScreen === 'handover' && (
          <HandoverScreen
            photos={tenantProperty.photos}
            checklist={tenantProperty.checklist}
            propertyTitle={tenantProperty.officialLocation}
            propertyAddress={tenantProperty.fullAddress}
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
            onToggleCondition={handleTogglePhotoCondition}
            onUpdateChecklist={handleUpdateChecklist}
            onSealProtocol={handleSealProtocol}
            onNavigate={handleNavigate}
            onNotify={showToast}
          />
        )}

        {activeScreen === 'receipts' && (
          <ReceiptScreen
            receipts={tenantProperty.receipts}
            rentIncreases={tenantProperty.rentIncreases}
            senderName={session.fullName}
            monthlyRent={tenantProperty.monthlyRent}
            onVerifyReceipt={handleVerifyReceipt}
            onNavigate={handleNavigate}
            onNotify={showToast}
            handoverApproved={tenantProperty.checklist.landlordStatus === 'approved'}
          />
        )}

        {showTenantGuide && (
          <TenantGettingStarted
            key={session.userId}
            firstName={tenantFirstName}
            onComplete={completeTenantGuide}
          />
        )}

        {isTenantTrustCard && (!showTenantGuide || tenantGuideReopened) && (
          <div hidden={showTenantGuide}>
            <TrustCardScreen
              key={session.userId}
              session={session}
              activeRental={activeTenantRentalId && tenantProperty.rentalId ? tenantProperty : null}
              hasActiveRental={Boolean(activeTenantRentalId)}
              history={tenantHistory}
              historyRefreshFailed={tenantHistoryRefreshFailed}
              pendingMatch={pendingMatch}
              onSubmitInviteCode={handleSubmitInviteCode}
              onNavigate={handleNavigate}
              onNotify={showToast}
              onOpenGuide={openTenantGuide}
              onRefreshInvites={refreshTenantInvites}
              transparencyPledged={transparentEntryPledged}
            />
          </div>
        )}

        {isLandlordScreen &&
        selectedPropertyId === 'empty-demo' &&
        activeScreen !== 'landlord-candidates' ? (
          <section className="max-w-xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <div className="bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-10 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#0B192C] flex items-center justify-center mx-auto">
                <Building2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
              </div>
              <p className="mt-5 text-base sm:text-lg font-display font-bold text-[#0B192C] leading-relaxed">
                Henüz kayıtlı daireniz bulunmuyor. İlk dairenizi ekleyip kiracınızı davet edin.
              </p>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setNewApartmentOpen(true)}
                  className="min-h-[48px] px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>İlk Dairemi Ekle</span>
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            {activeScreen === 'landlord-handover' && (
              <LandlordHandoverScreen
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                currentLandlordName={session.fullName || 'Ev Sahibi'}
                onSelectProperty={setSelectedPropertyId}
                onRemindInvite={handleRemindTenantInvite}
                onCancelInvite={handleCancelPendingInvite}
                onDeleteProperty={handleDeleteProperty}
                onApproveProtocol={handleLandlordApproveProtocol}
                onObjectProtocol={handleLandlordObjectProtocol}
                onSignReference={handleSignReference}
                onOpenPayments={(propertyId) => {
                  setSelectedPropertyId(propertyId);
                  setActiveScreen('landlord-payments');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onNotify={showToast}
              />
            )}

            {activeScreen === 'landlord-payments' && (
              <LandlordPaymentsScreen
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                focusedReceiptId={focusedReceiptId}
                onClearFocusedReceipt={() => setFocusedReceiptId(null)}
                onApproveReceipt={handleApproveReceipt}
                onObjectReceipt={handleObjectReceipt}
                onNotify={showToast}
              />
            )}

            {activeScreen === 'landlord-candidates' && session.authenticated && session.role === 'landlord' && (
              <LandlordCandidateScreen
                key={session.userId}
                landlordId={session.userId}
                properties={properties}
                selectedPropertyId={selectedPropertyId}
                focusedCandidateCode={focusedCandidateCode}
                onClearFocusedCandidate={() => setFocusedCandidateCode(null)}
                lookupCandidates={candidates}
                onSendRentalInvite={handleSendKmkInvite}
                onCreateProperty={handleCreatePropertyForInvite}
                onOpenHandover={(propertyId) => {
                  setSelectedPropertyId(propertyId);
                  setActiveScreen('landlord-handover');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onNotify={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer hidden={showTenantGuide} className="border-t border-slate-200/80 bg-white py-4 pb-20 lg:pb-5 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Kiracımkim · Güvenli Kira İlişkisi ve Dijital İtibar Platformu</span>
          <div className="flex items-center gap-4">
            <span className="hidden lg:inline">
              6698 Sayılı KVKK ve 5070 Sayılı Elektronik İmza Mevzuatına Uyumlu
            </span>
            {session.role === 'tenant' && activeScreen !== 'login' && (
              <button
                type="button"
                onClick={handleResetTenantDemo}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
              >
                Demoyu Sıfırla
              </button>
            )}
          </div>
        </div>
      </footer>

      <NewApartmentModal
        open={newApartmentOpen}
        onClose={() => setNewApartmentOpen(false)}
        onSave={handleCreateApartment}
      />

      {!showTenantGuide && (
        <MobileTabBar
          activeScreen={activeScreen}
          role={session.role}
          lockedScreens={lockedTenantScreens}
          onNavigate={handleNavigate}
        />
      )}

      {/* Live Feedback Toast */}
      {pledgePromptCode && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pledge-choice-title"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-6 sm:p-8 space-y-5">
            <h2 id="pledge-choice-title" className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
              Şeffaflık Taahhüdü
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Geçmiş kiralama kaydınız bulunmuyor. Teslim tutanağına geçmeden önce, girişte fotoğraflı
              teslim tutanağı oluşturmayı ve kira dekontlarını sistemde doğrulatmayı taahhüt
              edebilirsiniz. Bu adım zorunlu değildir.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={pledgeSaving}
                onClick={() => void continueInviteAfterPledge(true)}
                className="min-h-[46px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
              >
                Şeffaflık Taahhüdünü Onayla ve Devam Et
              </button>
              <button
                type="button"
                disabled={pledgeSaving}
                onClick={() => void continueInviteAfterPledge(false)}
                className="min-h-[46px] px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl"
              >
                Taahhüt Vermeden Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-[#0B192C] text-white px-4 py-3 rounded-2xl shadow-lg border border-white/10 flex items-center gap-3 text-xs sm:text-sm no-print ${showTenantGuide ? 'top-14 lg:top-[4.5rem]' : 'bottom-20 lg:bottom-6'}`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
