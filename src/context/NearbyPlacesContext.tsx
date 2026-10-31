import * as Location from 'expo-location';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { fetchNearbyPlaces } from '../api/places';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_SEARCH_RADIUS_METERS,
  FAILURE_COOLDOWN_MS,
  MIN_SEARCH_INTERVAL_MS,
  VIEWPORT_SEARCH_DEBOUNCE_MS,
} from '../constants/map';
import { flushStoredPlaces, loadStoredPlaces, mergeStoredPlaces, toSeed } from '../storage/placeStore';
import { flushMapView, loadMapView, saveMapView } from '../storage/mapViewStore';
import { hasGoogleReviews, type Coordinates, type Place, type SearchArea, type StoredPlace } from '../types/place';
import { areaFromRegion, distanceInMeters, isSimilarArea, type MapRegion } from '../utils/geo';

/** A stored place counts as "in view" even if it sits a hair outside the search circle. */
const AREA_TOLERANCE = 1.05;

export type NearbyPlacesStatus = 'loading' | 'ready';

type NearbyPlacesValue = {
  status: NearbyPlacesStatus;
  /** Places remembered for the current view — fresh results merged with earlier searches. */
  places: Place[];
  /** Everything remembered on the device, regardless of the current view. */
  allPlaces: Place[];
  /** Places remembered on this device that have Google reviews. */
  storedCount: number;
  /** Where the search is centred — the current map view. */
  focus: SearchArea;
  /** The map position restored from the previous session, if there was one. */
  restoredView: MapRegion | null;
  /** True once the saved map position has been read, so the map can position itself. */
  initialViewLoaded: boolean;
  /** The user's position, when location access is granted. */
  location: Coordinates | null;
  locationPermissionDenied: boolean;
  /** Called by the map whenever the visible region settles. */
  setViewRegion: (region: MapRegion) => void;
  /** Manual retry: ignores the failure cooldown and the rate limit. */
  refresh: () => void;
};

const NearbyPlacesContext = createContext<NearbyPlacesValue | null>(null);

/**
 * Owns the searched area and the on-device place collection. Searches are rate limited
 * (debounce after the map settles, minimum gap between requests, cooldown after a
 * failure) and never surface errors: a failed request just leaves what is already on
 * screen and pauses searching.
 */
export function NearbyPlacesProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<SearchArea>({
    center: DEFAULT_MAP_CENTER,
    radiusMeters: DEFAULT_SEARCH_RADIUS_METERS,
  });
  const [stored, setStored] = useState<StoredPlace[]>([]);
  const [restoredView, setRestoredView] = useState<MapRegion | null>(null);
  const [initialViewLoaded, setInitialViewLoaded] = useState(false);
  const [status, setStatus] = useState<NearbyPlacesStatus>('loading');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const isMounted = useRef(true);
  const requestId = useRef(0);
  /** A search is in progress; new requests wait for it instead of running in parallel. */
  const searching = useRef(false);
  /** Latest area requested while a search was running — replayed when that one finishes. */
  const queued = useRef<{ area: SearchArea; origin: Coordinates; manual: boolean } | null>(null);
  const lastSearchAt = useRef(0);
  const cooldownUntil = useRef(0);
  const wantsManualSearch = useRef(false);
  /** Once a saved position is applied it wins over the device fix. */
  const restoredFocus = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Show everything remembered from previous sessions right away, before any request.
  useEffect(() => {
    let cancelled = false;

    void loadStoredPlaces().then((places) => {
      if (!cancelled && isMounted.current) {
        setStored(places);
        setStatus('ready');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Restore the last map position, and search that area instead of the default one.
  useEffect(() => {
    let cancelled = false;

    void loadMapView().then((view) => {
      if (cancelled || !isMounted.current) {
        return;
      }
      setRestoredView(view);
      setInitialViewLoaded(true);
      if (view) {
        restoredFocus.current = true;
        setFocus(areaFromRegion(view));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Location only decides where distances are measured from; the search follows the map.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) {
          return;
        }
        if (!permission.granted) {
          setLocationPermissionDenied(true);
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) {
          return;
        }

        const origin: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setLocation(origin);

        // Without a saved position the user starts where they are.
        if (!restoredFocus.current) {
          setFocus((current) => ({ ...current, center: origin }));
        }
      } catch {
        if (!cancelled) {
          setLocationPermissionDenied(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Writes are debounced, so flush anything still pending when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void flushStoredPlaces();
        void flushMapView();
      }
    });

    return () => subscription.remove();
  }, []);

  const runSearch = useCallback(async (area: SearchArea, origin: Coordinates) => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const isStale = () => !isMounted.current || requestId.current !== currentRequest;

    searching.current = true;
    lastSearchAt.current = Date.now();
    setStatus('loading');

    try {
      const nearby = await fetchNearbyPlaces({ area, origin });
      if (isStale()) {
        return;
      }

      // Updated in memory right away; the provider state follows the merged snapshot.
      const merged = await mergeStoredPlaces(nearby.map(toSeed));
      if (isStale()) {
        return;
      }

      setStored(merged);
      setStatus('ready');

    } catch {
      if (isStale()) {
        return;
      }
      // Failures are silent: keep whatever is on screen and stop searching for a while.
      cooldownUntil.current = Date.now() + FAILURE_COOLDOWN_MS;
      setStatus('ready');
    } finally {
      searching.current = false;

      // Only the most recent request made while this one ran is worth replaying.
      const next = queued.current;
      queued.current = null;

      const cooledDown = Date.now() >= cooldownUntil.current;
      if (next && (next.manual || cooledDown) && isMounted.current && requestId.current === currentRequest) {
        void runSearch(next.area, next.origin);
      }
    }
  }, []);

  useEffect(() => {
    const manual = wantsManualSearch.current;
    wantsManualSearch.current = false;

    const now = Date.now();
    if (!manual && now < cooldownUntil.current) {
      return;
    }

    const wait = manual
      ? 0
      : Math.max(VIEWPORT_SEARCH_DEBOUNCE_MS, MIN_SEARCH_INTERVAL_MS - (now - lastSearchAt.current));

    const timer = setTimeout(() => {
      const origin = location ?? focus.center;

      // Never overlap searches: queue the newest view and run it when the current one ends.
      if (searching.current) {
        queued.current = { area: focus, origin, manual };
        return;
      }

      void runSearch(focus, origin);
    }, wait);

    return () => clearTimeout(timer);
  }, [focus, location, reloadKey, runSearch]);

  const allPlaces = useMemo<Place[]>(() => {
    const origin = location ?? focus.center;

    return stored
      // Places saved before the reviews-only rule existed are hidden, not deleted.
      .filter(hasGoogleReviews)
      .map(({ seenAt: _seenAt, ...place }) => ({
        ...place,
        distanceMeters: distanceInMeters(origin, place),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [stored, location, focus.center]);

  const places = useMemo<Place[]>(
    () => allPlaces.filter((place) => distanceInMeters(focus.center, place) <= focus.radiusMeters * AREA_TOLERANCE),
    [allPlaces, focus],
  );

  const setViewRegion = useCallback((region: MapRegion) => {
    saveMapView(region);

    const area = areaFromRegion(region);
    setFocus((current) => (isSimilarArea(current, area) ? current : area));
  }, []);

  const refresh = useCallback(() => {
    wantsManualSearch.current = true;
    cooldownUntil.current = 0;
    setReloadKey((key) => key + 1);
  }, []);

  const value = useMemo<NearbyPlacesValue>(
    () => ({
      status,
      places,
      allPlaces,
      storedCount: allPlaces.length,
      focus,
      restoredView,
      initialViewLoaded,
      location,
      locationPermissionDenied,
      setViewRegion,
      refresh,
    }),
    [
      status,
      places,
      allPlaces,
      allPlaces.length,
      focus,
      restoredView,
      initialViewLoaded,
      location,
      locationPermissionDenied,
      setViewRegion,
      refresh,
    ],
  );

  return <NearbyPlacesContext.Provider value={value}>{children}</NearbyPlacesContext.Provider>;
}

export function useNearbyPlaces(): NearbyPlacesValue {
  const value = useContext(NearbyPlacesContext);
  if (!value) {
    throw new Error('useNearbyPlaces must be used inside a NearbyPlacesProvider');
  }
  return value;
}
