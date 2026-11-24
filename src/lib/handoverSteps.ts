import {
  HandoverChecklistState,
  HandoverPhoto,
  ROOM_DEFINITIONS,
} from '../types/kiracimkim';

export const LIVING_ROOMS = ROOM_DEFINITIONS.filter((room) => room.id !== 'sayaclar');

export function roomsWithoutPhotos(photos: HandoverPhoto[]): string[] {
  return LIVING_ROOMS.filter(
    (room) => !photos.some((photo) => photo.roomId === room.id)
  ).map((room) => room.label);
}

export function handoverSubmitError(
  _photos: HandoverPhoto[],
  _checklist: Pick<
    HandoverChecklistState,
    | 'electricMeterNo'
    | 'electricMeterPhoto'
    | 'waterMeterNo'
    | 'waterMeterPhoto'
    | 'gasMeterNo'
    | 'gasMeterPhoto'
    | 'keysCount'
  >
): string | null {
  return null;
}
