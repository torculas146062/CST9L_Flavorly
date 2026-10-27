import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { DeveloperSettingsScreen } from '../screens/DeveloperSettingsScreen';
import { MyRatingsScreen } from '../screens/MyRatingsScreen';
import { PlaceDetailsScreen } from '../screens/PlaceDetailsScreen';
import { colors } from '../theme';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primaryStrong,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="PlaceDetails"
          component={PlaceDetailsScreen}
          options={{ title: 'Place', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="MyRatings"
          component={MyRatingsScreen}
          options={{ title: 'My Ratings', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="DeveloperSettings"
          component={DeveloperSettingsScreen}
          options={{ title: 'Developer', headerBackTitle: 'Back' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
