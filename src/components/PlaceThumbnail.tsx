import { usePlacePhoto } from '../hooks/usePlacePhoto';
import type { Place } from '../types/place';
import { PlacePhoto } from './PlacePhoto';

/** List-row thumbnail read from the stored image file. */
export function PlaceThumbnail({ place }: { place: Place }) {
  const { uri, reportError } = usePlacePhoto(place);
  return <PlacePhoto place={place} uri={uri} onError={reportError} />;
}
