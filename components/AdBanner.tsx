import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSubscription } from '../utils/SubscriptionContext';
import { ADMOB_BANNER_ID } from '../constants/subscription';

export default function AdBanner() {
  const { isPremium } = useSubscription();

  if (isPremium) return null;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={ADMOB_BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
