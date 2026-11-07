import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { DeveloperSettingsScreen } from '../screens/DeveloperSettingsScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MyRatingsScreen } from '../screens/MyRatingsScreen';
import { PlaceDetailsScreen } from '../screens/PlaceDetailsScreen';
import { SignUpScreen } from '../screens/SignUpScreen';
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
  const { ready, user } = useAuth();

  // Validate the saved backend session before rendering either navigation stack.
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="PlaceDetails"
              component={PlaceDetailsScreen}
              options={({ route }) => ({ title: route.params.place.name, headerBackTitle: 'Back' })}
            />
            <Stack.Screen
              name="MyRatings"
              component={MyRatingsScreen}
              options={{ title: 'My Ratings', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ title: 'Edit profile', headerBackTitle: 'Back' }}
            />
            {__DEV__ ? (
              <Stack.Screen
                name="DeveloperSettings"
                component={DeveloperSettingsScreen}
                options={{ title: 'Developer', headerBackTitle: 'Back' }}
              />
            ) : null}
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="SignUp"
              component={SignUpScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
