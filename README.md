# Flavorly

A React Native app for finding, saving, and recommending places to eat.

## Stack

- [Expo](https://docs.expo.dev/) SDK 58 (managed workflow, runs in Expo Go)
- React Native 0.88 + React 19
- [React Navigation](https://reactnavigation.org/) 7 — native stack + bottom tabs
- TypeScript (strict)
- 5-star ratings stored on the device, used for content-based recommendations
- `@react-native-async-storage/async-storage` — on-device place cache (works in Expo Go and on web)
- [react-native-maps](https://github.com/react-native-maps/react-native-maps) — Google Maps on Android, Apple Maps on iOS
- [expo-location](https://docs.expo.dev/versions/v58.0.0/sdk/location/) — user position + permission flow
- Places, ratings and price level from the [Google Places API (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [OpenStreetMap](https://www.openstreetmap.org/) via the [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) as a key-free fallback
- Web support via `react-dom` + `react-native-web` (handy for quick browser previews)

## Getting started

```bash
npm install
cp .env.example .env   # then paste your Places API key
npm start              # then scan the QR code with Expo Go
```

`.env` holds `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`. Expo inlines `EXPO_PUBLIC_*` variables
into the bundle at build time, and `.env` is git-ignored — never commit the key.
Without a key the app still runs, but searches return nothing: only Google places that
already have Maps reviews are shown, and OpenStreetMap carries none.

Other scripts:

```bash
npm run android   # open on a connected Android device/emulator
npm run ios       # open on iOS (macOS only; on Linux/Windows use Expo Go)
npm run web       # run in the browser
npm run typecheck # tsc --noEmit
```

## Project structure

```
App.tsx                        # SafeAreaProvider + navigation root
index.ts                       # Expo entry point (registerRootComponent)
src/
  navigation/
    RootNavigator.tsx          # NavigationContainer + root native stack
    MainTabs.tsx               # Bottom tabs: Map, Explore, Recommend, Profile
    types.ts                   # Typed route param lists
  screens/
    MyRatingsScreen.tsx         # Everything the user has rated
    LoginScreen.tsx             # Email + password sign-in (first screen when signed out)
    SignUpScreen.tsx            # Create a local account
    EditProfileScreen.tsx       # Change name and email
    MapScreen.tsx              # Map with user location + dining markers (native)
    MapScreen.web.tsx          # Web fallback — react-native-maps has no web build
    ExploreScreen.tsx          # Nearby dining list, sorted by distance
    RecommendScreen.tsx
    ProfileScreen.tsx
    PlaceDetailsScreen.tsx     # Stack screen pushed from Map/Explore
  components/
    Screen.tsx                 # Safe-area + title wrapper used by tab screens
    Placeholder.tsx            # Dashed placeholder box for unfinished screens
    PlacePhoto.tsx             # Remote photo with a branded fallback tile
    PlacePreviewMap.tsx        # Static mini map on the details screen; tapping it opens the place in Google Maps (+ .web.tsx)
    AuthShell.tsx              # Shared frame for the sign-in / sign-up forms
    FormField.tsx              # Labelled text input with an error line
    PrimaryButton.tsx          # Primary / secondary / danger button with a busy state
  context/
    NearbyPlacesContext.tsx    # Shared viewport + merged places for both tabs
    AuthContext.tsx            # Local session: sign in, sign up, sign out, edit profile
  storage/
    placeStore.ts              # In-memory collection, merged then persisted
    mapViewStore.ts            # Last map position, saved and restored
    ratingStore.ts             # User ratings per place
    authStore.ts               # Local accounts + session (salted password hashes)
    photoFiles.ts              # Images as files named <origin>__<place>.<ext> (+ .web stub)
    backup.ts                  # Export / import / clear every storage key
  hooks/
    usePlacePhoto.ts           # Google photo → Facebook avatar → map preview
  context/
    RatingsContext.tsx         # User ratings, shared across screens
  api/
    places.ts                  # Google first, OpenStreetMap fallback
    googlePlaces.ts            # Nearby Search (New): ratings, price level, photos
    overpass.ts                # Overpass query, parsing, distance sort, mirror fallback
    placeImage.ts              # Google -> Facebook -> website preview image
    embedImage.ts              # Page fetch + link-preview tag extraction
    facebookPicture.ts         # Detects Facebook's placeholder avatars
    imageBytes.ts              # Image download for inspection/storage
  types/
    place.ts                   # Place model
  constants/
    map.ts                     # Default centre, radius bounds, debounce window
  utils/
    storageTransfer.ts         # Save-as-file + file pickers (native) with .web twin
    photoArchive.ts            # Zip / unzip the photo directory
    fingerprint.ts             # FNV-1a content fingerprint
    imageSize.ts               # Header-only JPEG/PNG/GIF/WebP dimensions
    format.ts                  # Distance, rating count, price level formatting
    maps.ts                    # Opens a place in Google Maps (place id, else coordinates)
    geo.ts                     # Haversine distance, viewport -> search circle
  theme/
    index.ts                   # Colors, spacing, radius, typography tokens
```

## Adding screens

1. Create the screen in `src/screens/`.
2. Add its route to `RootStackParamList` (or `MainTabParamList`) in `src/navigation/types.ts`.
3. Register it in `src/navigation/RootNavigator.tsx` (or `MainTabs.tsx`).

## Accounts

- **The app requires an account.** Until one is signed in, `RootNavigator` renders only `Login` / `SignUp`; the tab navigation and the places/ratings providers mount after sign-in, so the login screen never fires searches.
- **There is no backend yet.** Accounts live in `flavorly:auth:v1` (`src/storage/authStore.ts`) and are read through `src/context/AuthContext.tsx` (`useAuth()`): `signIn`, `signUp`, `signOut`, `updateProfile`. The signed-in user id is stored alongside them, which is what survives an app restart.
- Passwords are kept as a salted FNV-1a hash (`<salt>$<digest>`), never in plain text. That only avoids writing the raw password — it is **not** real authentication, and anyone with device access can read or replace the store.
- **Logging out clears the session and nothing else.** Places, photos and ratings live in their own stores and stay on the device; `DataProviders` in `App.tsx` just unmounts, so the next sign-in reads them back from disk.
- Profile shows the account's name, email and initials, with **My Ratings**, **Edit profile** (name + email + password) and **Log out**. `email` is the account key, so it must stay unique.
- **Changing the password** (`changePassword(current, next)`) re-checks the current password before writing a fresh salt + hash; it rejects a wrong current password, anything shorter than `MIN_PASSWORD_LENGTH` (6), and reusing the same password. The fields clear and a confirmation line appears on success.
- Signed-in state is persisted, so a normal app restart goes straight to the tabs.

## Ratings & recommendations

- Every place has a **5-star rating widget** on its details screen (`src/components/StarRating.tsx`): tap a star, or drag across the row like a slider — the preview follows your finger and the value commits on release, while a plain tap still lands on its exact star. Ratings are persisted per place in `flavorly:ratings:v1` (`src/storage/ratingStore.ts`, exposed through `src/context/RatingsContext.tsx`), alongside the other stores — flushed when the app backgrounds.
- **Profile → My Ratings** lists everything you have rated, newest first, with the star row (still editable), the date and a Clear action, plus your average. Ratings for places no longer in the saved collection are counted but not listed.
- The **Recommend** tab is built from those ratings, not from Google's. It needs `MIN_RATINGS_FOR_RECOMMENDATIONS` (5, in `src/constants/recommend.ts`) ratings before it will say anything: until then it shows how many are missing and a shortcut to Explore.
- **Ranking is a placeholder.** `buildRecommendations` is meant to call a ranking service that is not built yet, so today it returns a random selection of unrated places and the list says so in its footer (`isPlaceholder`). The ratings gate still applies, because that is the product behaviour.
- To wire the real thing up, replace the section marked `PLACEHOLDER` in `src/utils/recommend.ts`: post the ratings plus `allPlaces`, build `Recommendation[]` from the response, fill `reason` per row and set `isPlaceholder: false`. `RecommendationRow` already renders `reason` only when present.

## Developer settings

`Profile → Developer settings` (development builds only, `__DEV__`) shows how many bytes each storage key holds, how many photo files exist, and lets you:

- **Save data (JSON)** — the stores and their metadata. `Directory.pickDirectoryAsync()` asks where to put the file; if you cancel, it is written to the app's documents directory and the path is reported. On web it is a normal browser download.
- **Clear photos** — deletes the stored images; places and ratings are untouched.
- **Save / Import photos (ZIP)** — image bytes are kept out of the JSON export entirely. `fflate` zips `<documents>/flavorly-photos/` into `flavorly-photos-<timestamp>.zip`; importing a zip writes the files back (deterministic names, so the JSON keeps matching) and reports how many were restored.
- **Import data** by picking a JSON file or pasting it. Exports from **any version** are accepted — the `app` field is not checked, so an older `palate-path` backup imports fine. Only known keys are written, each value must be a string, and the app reloads afterwards.
- **Clear** storage + photos behind a confirmation.

Both are device features: browsers have no writable app directory, so the ZIP buttons are disabled on web. `src/storage/backup.ts` is the single place that knows the storage keys — add new stores there so they are included in exports.

## Data sources

| Concern | Source |
| --- | --- |
| Map rendering | `react-native-maps` — Google Maps on Android, Apple Maps on iOS (no key needed in Expo Go) |
| Dining places, ratings, price level, photos | Google Places API (New) — Nearby Search, `src/api/googlePlaces.ts` |
| Fallback dining places | OpenStreetMap via the Overpass API — `src/api/overpass.ts` |
| User location | `expo-location` foreground permission |

- `fetchNearbyPlaces` (`src/api/places.ts`) asks Google first and falls back to Overpass when the key is missing, the quota is exhausted, or the request fails.
- Only dining/drinking results are kept: the request sends dining `includedTypes`, then `primaryType` is checked again so hotels, malls and landmarks that merely contain a restaurant are dropped. Adjust the list in `src/api/googlePlaces.ts`.
- **Only places with Google Maps reviews are shown.** `hasGoogleReviews` (`src/types/place.ts`) requires `source === 'google'` and `ratingCount > 0`; it filters every fetch and, in `NearbyPlacesProvider`, the on-device collection, so unrated venues and every OpenStreetMap result are hidden (they stay stored, just not displayed). `openNow` is neither requested nor stored — only the rating and review count are mapped.
- **Every search is saved on the device.** The collection lives in memory (`src/storage/placeStore.ts`) and is written to AsyncStorage (`flavorly:places:v1`) after the burst of merges settles (500 ms debounce, queued writes, flushed immediately when the app leaves the foreground). Merging mutates the in-memory map synchronously, so concurrent searches cannot lose each other's rows — the previous read-modify-write-per-search could.
- Each place is upserted by id, so repeat searches refresh ratings/details instead of duplicating, and places found earlier are kept. The Map and Explore tabs both read from that merged collection, so panning over ground you have already covered reveals more than the 20 places a single request returns. The store has **no cap**: every place the user has seen is kept (≈293 B each). To stay clear of Android's ~2 MB per-value limit ("Row too big to fit into CursorWindow"), it is **sharded** across `flavorly:places:v2:index` + `places:v2:<n>` chunks of 250 places (~80 KB each), so the collection can grow indefinitely. Only chunks whose content changed are rewritten, a `places:v1` value left by earlier versions is migrated on first read, and the developer export still presents it as one JSON field.
- **Light mode only.** The app is designed light; `app.json` pins `userInterfaceStyle: "light"` and both maps pass `userInterfaceStyle="light"` (`react-native-maps` is otherwise iOS-only for that prop, so Android inherits the light app theme).
- **The last map position is restored.** `src/storage/mapViewStore.ts` saves the settled region (centre + deltas, `flavorly:map-view:v1`, debounced). On the next launch the map opens there — the saved view wins over the device fix — and the first search runs for that area instead of a default city centre.
- Distances are not persisted — they are recalculated from the current origin on read, so a place saved from another area still shows a sensible distance.
- **Failures are silent.** A failed search shows no error, banner or retry prompt: whatever is already on screen stays, the status returns to `ready`, and automatic searching pauses for 60 s (`FAILURE_COOLDOWN_MS`). Pull-to-refresh (Explore) or the refresh button (Map) is the explicit, rate-limit-free way to try again.
- **Explore lists every remembered place**, nearest first, with **distances measured from the user's location** — panning the map does not change the list or the numbers. `allPlaces` is the whole on-device collection; the Map tab is the only view-scoped list. When location permission is denied there is no user position, so distances fall back to the centre of the map view and the footer says so.
- **Searched areas are shaded.** Every successful search adds its circle (centre + radius) to `searchedAreas`, and `MapScreen` draws them as translucent red `Circle` overlays, so it is obvious which ground has already been covered. A repeat search of a covered area adds nothing (the 25 % similarity guard), and at most `MAX_SEARCHED_AREAS` (40) circles are kept. The list is in memory only — it is not persisted.
- **Markers follow the viewport.** Every remembered place inside the visible rectangle gets a pin (`regionContains` in `src/utils/geo.ts`) — there is no fixed marker cap, so the pins change as you pan and zoom. The header reads "N in view · M in this area".
- **Searches never overlap.** If a search is still running when the map asks for a new area, that request is queued rather than fired in parallel; when the running search finishes, the newest queued view runs (older intermediate views are dropped). A queued request is still subject to the failure cooldown unless it came from an explicit refresh.
- **Search follows the map view**, but never while you are still panning: the map waits 400 ms after the gesture ends before reporting a viewport (`onPanDrag`/`isGesture` cancels a pending report), and the provider adds a 600 ms debounce on top. Two automatic searches are never closer than 1.5 s, and rapid pans collapse into a single request. The radius is clamped to 150 m – 50 km (Google's limit).
- Location is only used to open the map on the user and to measure distances; the search itself works without GPS. When location is denied, distances are measured from the centre of the view.
- **Photo resolution order** (`src/api/placeImage.ts`): Google `photos` → Facebook (Graph picture endpoint, else the page's own `og:image`) → any other website's published preview image → map preview.
- **Reading a page.** `src/api/embedImage.ts` fetches the page (9 s timeout, first 500 KB) and takes the best link-preview image it advertises: `og:image[, :url, :secure_url]` → `twitter:image[, :src]` → `<link rel="image_src">` → `msapplication-TileImage` → JSON-LD `image` → `apple-touch-icon` → `<link rel="preload" as="image">`. Relative, protocol-relative and entity-escaped URLs are resolved; `data:`/`javascript:` and known generic assets (Facebook's `rsrc.php` placeholder, `/images/logo` paths) are rejected.
- **Every candidate is verified** before it is stored: a `HEAD` check (`isImageUrl`) because pages often advertise an `og:image` that 404s, then a content check on the downloaded bytes. A failed candidate falls through to the next source.
- **Facebook placeholders are filtered out.** The Graph picture endpoint answers `200 image/jpeg` with a generic grey silhouette for pages whose avatar it will not expose, and `200 image/gif` with a blank 2×2 pixel for others — so "the download worked" does not mean there is a photo. `src/api/facebookPicture.ts` recognises the silhouette by content (Facebook serves byte-identical images: 11 783 B, FNV-1a `3581c6c4`), `src/utils/imageSize.ts` rejects anything whose JPEG/PNG/GIF/WebP header says it is under 64 px, and the resolver then falls through to the page's own `og:image`, which carries the real avatar.
- **Facebook quirks.** The Graph picture endpoint is tokenless and works for handles, numeric ids, `/people/<name>/<id>`, `/p/<name>-<id>` and `profile.php?id=…`. `/share/…` links carry no handle, so they are resolved by reading the page. facebook.com only serves page HTML (and its `og:image`) to a **mobile Safari user agent**, which `fetchEmbedImage` sends for Facebook URLs; login-walled pages return Meta's placeholder, which the generic-asset filter rejects.
- **Images are stored as files, never as URLs.** Whichever source wins, the picture is downloaded into `<documents>/flavorly-photos/` (`src/storage/photoFiles.ts`) — Google photo, Facebook avatar and website embed all land there the same way. Photos therefore work offline, survive reinstall/restore (the file name is derived from the place id, so no absolute path is stored) and are shipped as a zip rather than inside the JSON.
- **The file is the record.** There is no photo index and no AsyncStorage entry for images: `findStoredPhoto` looks for `google__<place>.jpg`, `facebook__<place>.jpg`, `website__<place>.jpg` in the photos directory, and the prefix doubles as the source used for attribution. Images from every source end up the same way, so lists, details and the zip archive all read from files.
- Browsers have no writable app directory, so on web nothing is stored and the resolved image is shown for that session only.
- The Facebook avatar comes from the public Graph picture endpoint (`graph.facebook.com/<handle>/picture?width=800`), which redirects to the image and needs no access token. An unknown or private handle answers `400`, which surfaces as an image error and falls back to the map preview. This is an unauthenticated, rate-limited endpoint Meta can change at any time — best effort, not a guarantee.
- Reading a page only touches the tags a site publishes for social previews — nothing is rendered and no private data is read. It runs **only when a place is opened** (never while scrolling lists) and at most once per place per session. Browsers block cross-origin HTML reads, so on web this path fails and the map preview is used; on device it works.
- **There is no image search.** Web search APIs were evaluated and dropped: facebook.com and DuckDuckGo answer non-browser clients with anti-bot challenges (DDG returns `202 {"challenge":…}` even with a valid `vqd`, cookies and full browser headers), Google Custom Search needs an unrestricted key plus a Programmable Search Engine id, and Wikimedia/Openverse never return photos of a specific venue. Enabling billing on the Places project remains the reliable way to get real venue photography.
- **Photos need billing enabled** on the Google Cloud project. Until then the Places API returns no `photos` array (the photo media endpoint answers `403 ... requires billing`), and the details screen shows the map preview in the hero slot instead of an empty tile (list rows fall back to a branded initial tile). Once billing is on, photos appear with no code change.
- **Attribution**: keep the Google attribution and the "© OpenStreetMap contributors" lines wherever place data is shown.
- The public Overpass instances are community-run and occasionally return 502s, so `src/api/overpass.ts` falls through three mirrors.

### Keeping the key safe

The key is embedded in the app bundle, so anyone holding the app can extract it. In Google
Cloud Console, restrict it to the *Places API (New)* and to your Android package/SHA-1
(and iOS bundle id) instead of leaving it unrestricted, and rotate it if it has been shared.

## Notes

- Everything here runs in **Expo Go**, which only ships Expo's bundled native modules. If you add a library with native code that Expo Go does not bundle, you will need a development build (`npx expo run:android` / `npx expo run:ios` or `eas build`).
- `ios/` and `android/` are generated on demand and are git-ignored; configure native behavior in `app.json` instead.
- A **store build for Android** will need a Google Maps API key (`android.config.googleMaps.apiKey`) because Expo Go supplies its own. iOS uses Apple Maps and needs nothing.
- The **web** preview cannot render the map (react-native-maps has no web implementation) — use Expo Go on a device for the real experience. The nearby-places data does load in the browser.
- **Android POI pins**: react-native-maps implements `showsPointsOfInterests` as a no-op on Android, so Google's own pins (malls, towers, schools) are hidden with `customMapStyle` in `MapScreen.tsx`. Only the dining markers the app renders stay on the map.
