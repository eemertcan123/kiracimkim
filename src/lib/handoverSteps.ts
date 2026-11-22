import {
  HandoverChecklistState,
  HandoverPhoto,
  ROOM_DEFINITIONS,
} from '../types/kiracimkim';

export const LIVING_ROOMS = ROOM_DEFINITIONS.filter((room) => room.id !== 'sayaclar');

export function missingRoomLabels(photos: HandoverPhoto[]): string[] {
  return LIVING_ROOMS.filter(
    (room) => photos.filter((photo) => photo.roomId === room.id).length < room.requiredCount
  ).map((room) => room.label);
}

export function missingMeterLabels(checklist: Pick<
  HandoverChecklistState,
  | 'electricMeterNo'
  | 'electricMeterPhoto'
  | 'waterMeterNo'
  | 'waterMeterPhoto'
  | 'gasMeterNo'
  | 'gasMeterPhoto'
  | 'keysCount'
>): string[] {
  const missing: string[] = [];
  if (!checklist.electricMeterNo.trim()) missing.push('Elektrik sayacı endeksi');
  if (!checklist.electricMeterPhoto) missing.push('Elektrik sayacı fotoğrafı');
  if (!checklist.waterMeterNo.trim()) missing.push('Su sayacı endeksi');
  if (!checklist.waterMeterPhoto) missing.push('Su sayacı fotoğrafı');
  if (!checklist.gasMeterNo.trim()) missing.push('Doğalgaz sayacı endeksi');
  if (!checklist.gasMeterPhoto) missing.push('Doğalgaz sayacı fotoğrafı');
  if (checklist.keysCount < 1) missing.push('Teslim alınan anahtar adedi');
  return missing;
}

export function handoverSubmitError(
  photos: HandoverPhoto[],
  checklist: Parameters<typeof missingMeterLabels>[0]
): string | null {
  const rooms = missingRoomLabels(photos);
  if (rooms.length > 0) {
    return `Önce oda fotoğraflarını tamamlamanız gerekiyor: ${rooms.join(', ')}.`;
  }
  const meters = missingMeterLabels(checklist);
  if (meters.length > 0) {
    return `Sayaç ve anahtar bilgilerini tamamlayın: ${meters.join(', ')}.`;
  }
  return null;
}
