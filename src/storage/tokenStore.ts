import { Platform } from 'react-native';

const TOKEN_KEY = 'flavorly_access_token';

let webToken: string | null = null;

async function secureStore() {
  if (Platform.OS === 'web') {
    throw new Error('Secure native token storage is unavailable on web.');
  }
  return import('expo-secure-store');
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webToken;
  }
  const store = await secureStore();
  return store.getItemAsync(TOKEN_KEY);
}

export async function saveAccessToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = token;
    return;
  }
  const store = await secureStore();
  await store.setItemAsync(TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = null;
    return;
  }
  const store = await secureStore();
  await store.deleteItemAsync(TOKEN_KEY);
}
