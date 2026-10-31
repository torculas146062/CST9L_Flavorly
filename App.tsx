import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NearbyPlacesProvider } from './src/context/NearbyPlacesContext';
import { RatingsProvider } from './src/context/RatingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';

/**
 * Places and ratings belong to the signed-in session, so their providers only mount
 * then — the login screen must not fire searches. Everything stays on disk, so nothing
 * is lost when the providers unmount on sign-out.
 */
function DataProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <>{children}</>;
  }

  return (
    <NearbyPlacesProvider>
      <RatingsProvider>{children}</RatingsProvider>
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
