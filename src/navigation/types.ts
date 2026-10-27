import type { NavigatorScreenParams } from '@react-navigation/native';

import type { Place } from '../types/place';

export type MainTabParamList = {
  Map: undefined;
  Explore: undefined;
  Recommend: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  PlaceDetails: { place: Place };
  MyRatings: undefined;
  DeveloperSettings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
