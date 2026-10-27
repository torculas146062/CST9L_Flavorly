import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NearbyPlacesProvider } from './src/context/NearbyPlacesContext';
import { RatingsProvider } from './src/context/RatingsContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NearbyPlacesProvider>
        <RatingsProvider>
          <RootNavigator />
        </RatingsProvider>
      </NearbyPlacesProvider>
    </SafeAreaProvider>
  );
}
