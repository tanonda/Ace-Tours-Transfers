import { useCmsText } from "@/hooks/use-cms-text";
import { PHOTO_SLOTS, resolvePhoto, type PhotoSlotId } from "@/lib/site-photos";

/** The photo for a slot: the admin's upload (Admin → CMS) or the built-in Efate photo. */
export function useSitePhoto(id: PhotoSlotId): string {
  const slot = PHOTO_SLOTS[id];
  const cms = useCmsText(slot.block);
  return resolvePhoto(slot, cms.text(slot.key), "").src;
}
