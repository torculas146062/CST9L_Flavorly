import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { ExploreScreen } from '../screens/ExploreScreen';
import { MapScreen } from '../screens/MapScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RecommendScreen } from '../screens/RecommendScreen';
import { colors } from '../theme';
import type { MainTabParamList } from './types';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const Tab = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Map: { active: 'map', inactive: 'map-outline' },
  Explore: { active: 'compass', inactive: 'compass-outline' },
  Recommend: { active: 'sparkles', inactive: 'sparkles-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
};

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primaryStrong,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = tabIcons[route.name];
          return <Ionicons name={focused ? icons.active : icons.inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Recommend" component={RecommendScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
