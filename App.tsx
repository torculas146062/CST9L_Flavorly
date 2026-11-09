import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NearbyPlacesProvider } from './src/context/NearbyPlacesContext';
import { RatingsProvider } from './src/context/RatingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * User-scoped providers mount only after authentication; remount them when the account changes.
 */
function DataProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <>{children}</>;
  }

  return (
    <NearbyPlacesProvider key={user.id}>
      <RatingsProvider key={user.id}>{children}</RatingsProvider>
    </NearbyPlacesProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DataProviders>
          <RootNavigator />
        </DataProviders>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
