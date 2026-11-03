import "server-only";
import { cardsFor } from "../ch/entities";
import type { ImageLink } from "../ch/image-links";
import { parsePicks } from "./picks";

/**
 * The image of a "Content Hub image" field (banner ImagePick, page HeroImagePick): the first
 * picked asset, read from Experience Edge through the same cached list as the picker and the
 * Content Hub items component, with its public links so ChImage picks the best fit per box.
 * `missing` names an asset that was picked but isn't on Edge (not approved or published, outside
 * the brand scope); the page then falls back to the media-dialog image.
 */
export interface PickedImage { id: string; title: string; src: string; links?: ImageLink[] }

export async function pickedImage(raw: unknown): Promise<{ image: PickedImage | null; missing: string }> {
  const picks = parsePicks(raw);
  const first = picks && picks.definition === "M_Asset" ? picks.items[0] : undefined;
  if (!first) return { image: null, missing: "" };
  try {
    const { cards } = await cardsFor("M_Asset", [first.id]);
    const card = cards[0];
    if (!card?.image) return { image: null, missing: first.name || first.id };
    return { image: { id: card.id, title: card.title, src: card.image, links: card.imageLinks }, missing: "" };
  } catch (e: any) {
    console.warn("portal: picked image failed:", e?.message ?? e);
    return { image: null, missing: first.name || first.id };
  }
}
