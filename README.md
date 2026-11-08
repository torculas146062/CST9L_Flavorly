# Flavorly

Flavorly is a React Native application built with Expo for discovering restaurants, recording ratings, and receiving personalized recommendations.

## Architecture

- **Frontend:** React Native 0.88, React 19, Expo SDK 58, and TypeScript.
- **Backend:** Python FastAPI, maintained in a separate project directory and not included in this frontend repository.
- **Persistence:** SQLite stores registered accounts and restaurant ratings on the backend.
- **Authentication:** The backend authenticates accounts with JWTs; the frontend stores and uses the signed-in session for authenticated requests.
- **Restaurant data:** The backend provides the restaurant catalog and rating data used by the integrated flows.

The backend-backed app supports account registration and sign-in, profile updates, restaurant ratings, and recommendations. Recommendation requests use the personalized Top-5 endpoint. The service uses unsupervised KNN feature-space similarity together with a user's applicable ratings; when there are no applicable ratings, it returns a quality-based fallback. When a usable location is available, recommendations are filtered to a 5 km radius. If location is unavailable, the request is unfiltered.

## Local development

Prerequisites: Node.js/npm, the backend project, and Expo Go or an appropriate simulator.

1. Install frontend dependencies:

   ```sh
   npm ci
   ```

2. Create a local environment file and fill in your own values:

   ```sh
   cp .env.example .env
   ```

   On Windows PowerShell, use `Copy-Item .env.example .env`.

3. Configure `EXPO_PUBLIC_API_BASE_URL` with the backend URL reachable from the device or simulator. For Expo Go on a local Wi-Fi network, use the development machine's LAN address rather than `localhost`. The app permits HTTP only in development; use HTTPS outside development.

4. Configure `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` if using Google Places features. This public Expo variable is embedded in the application bundle. Do not put credentials in this README or commit a populated `.env` file. Review key restrictions and usage in Google Cloud Console; they have not been verified as part of this repository.

5. Start the backend using the instructions in its separate project, then start Expo:

   ```sh
   npm start
   ```

   Scan the QR code with Expo Go, or use `npm run android`, `npm run ios` (macOS), or `npm run web`.

The `.env.example` contains empty placeholders only. Expo inlines `EXPO_PUBLIC_*` variables at build time, so these values must not be treated as server-side secrets.

## Account and input requirements

- Usernames must be 3–30 characters and contain only ASCII letters, numbers, and underscores.
- Passwords must be 8–128 characters. The frontend does not impose additional composition rules.
- Email addresses must have a basic valid email shape; the backend remains authoritative for account validation and uniqueness.

## Ratings, recommendations, and location

- Ratings are submitted to and read from the backend for the authenticated account.
- The frontend requests up to five recommendations from the backend; it does not choose recommendations randomly.
- Personalized recommendations use KNN feature-space similarity and the user's applicable restaurant ratings. If no applicable ratings are available, the backend uses its quality-based fallback.
- A valid current location is sent with a 5 km radius for location-aware filtering. If location is unavailable, the recommendation request omits location parameters and returns an unfiltered result.
- Location access is used only when available and permitted. The app can still request recommendations without location.

## Dependency audit note

The current npm audit reports five moderate findings in the Expo dependency tree. The affected transitive packages are `glob@13.0.6` (through `expo > @expo/cli` and `expo > @expo/fingerprint`) and `minimatch@10.2.6` (through `@expo/fingerprint` and `glob`). The advisories are [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) for `glob` and [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) for `minimatch`.

npm classifies these as part of the production dependency tree because Expo is a direct dependency, although the vulnerable code is in Expo CLI/fingerprint tooling rather than the app's API request path. npm's JSON audit metadata suggests `expo@57.0.32`, while the human-readable forced-fix summary suggests `expo@53.0.11`; both are breaking downgrades from the installed SDK. No dependency change was made. Reassess when an Expo-SDK-compatible nonbreaking fix is available.

## Checks

```sh
npm run typecheck
npm audit --audit-level=moderate
```
