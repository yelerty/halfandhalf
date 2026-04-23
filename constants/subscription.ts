import { Platform } from 'react-native';

export const FREE_MAX_POSTS_PER_DAY = 3;
export const FREE_MAX_CHAT_STARTS_PER_DAY = 5;
export const PREMIUM_PRODUCT_ID = 'halfandhalf_premium_monthly';
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const REVENUECAT_API_KEY = Platform.select({
  ios: 'YOUR_REVENUECAT_IOS_API_KEY',
  android: 'YOUR_REVENUECAT_ANDROID_API_KEY',
}) || '';

export const ADMOB_BANNER_ID = Platform.select({
  ios: __DEV__ ? 'ca-app-pub-3940256099942544/2934735716' : 'YOUR_IOS_BANNER_ID',
  android: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'YOUR_ANDROID_BANNER_ID',
}) || '';
