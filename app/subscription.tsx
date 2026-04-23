import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { auth } from '../config/firebase';
import { purchaseSubscription, restorePurchases } from '../utils/subscription';
import { useSubscription } from '../utils/SubscriptionContext';
import { FREE_MAX_POSTS_PER_DAY, FREE_MAX_CHAT_STARTS_PER_DAY } from '../constants/subscription';
import i18n from '../i18n';

export default function SubscriptionScreen() {
  const { isPremium, dailyUsage, refresh } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handlePurchase = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const success = await purchaseSubscription(auth.currentUser.uid);
      if (success) {
        await refresh();
        Alert.alert(i18n.t('common.success'), i18n.t('subscription.purchaseSuccess'));
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert(i18n.t('common.error'), i18n.t('subscription.purchaseError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!auth.currentUser) return;
    setRestoring(true);
    try {
      const restored = await restorePurchases(auth.currentUser.uid);
      await refresh();
      Alert.alert(
        i18n.t('common.success'),
        restored ? i18n.t('subscription.restoreSuccess') : i18n.t('subscription.restoreNone')
      );
    } catch {
      Alert.alert(i18n.t('common.error'), i18n.t('subscription.restoreError'));
    } finally {
      setRestoring(false);
    }
  };

  const handleManage = () => {
    const url = Platform.select({
      ios: 'https://apps.apple.com/account/subscriptions',
      android: 'https://play.google.com/store/account/subscriptions',
    });
    if (url) Linking.openURL(url);
  };

  return (
    <>
      <Stack.Screen options={{ title: i18n.t('subscription.title') }} />
      <View style={styles.container}>
        <View style={styles.currentPlan}>
          <Text style={styles.planLabel}>{i18n.t('subscription.currentPlan')}</Text>
          <View style={[styles.badge, isPremium ? styles.premiumBadge : styles.freeBadge]}>
            <Text style={[styles.badgeText, isPremium ? styles.premiumBadgeText : styles.freeBadgeText]}>
              {isPremium ? i18n.t('subscription.premiumPlan') : i18n.t('subscription.freePlan')}
            </Text>
          </View>
        </View>

        {!isPremium && (
          <View style={styles.usageSection}>
            <Text style={styles.sectionTitle}>{i18n.t('subscription.todayUsage')}</Text>
            <Text style={styles.usageItem}>
              {i18n.t('subscription.postsUsed', { count: dailyUsage.postCount, max: FREE_MAX_POSTS_PER_DAY })}
            </Text>
            <Text style={styles.usageItem}>
              {i18n.t('subscription.chatsUsed', { count: dailyUsage.chatStartCount, max: FREE_MAX_CHAT_STARTS_PER_DAY })}
            </Text>
          </View>
        )}

        <View style={styles.comparisonSection}>
          <Text style={styles.sectionTitle}>{i18n.t('subscription.premiumPlan')}</Text>
          <View style={styles.featureList}>
            <FeatureRow label={i18n.t('subscription.features.noAds')} />
            <FeatureRow label={i18n.t('subscription.features.unlimitedPosts')} />
            <FeatureRow label={i18n.t('subscription.features.unlimitedChats')} />
          </View>
        </View>

        {isPremium ? (
          <TouchableOpacity style={styles.manageButton} onPress={handleManage}>
            <Text style={styles.manageText}>{i18n.t('subscription.manageSubscription')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.purchaseButton, loading && styles.disabledButton]}
            onPress={handlePurchase}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseText}>
                {i18n.t('subscription.upgradeButton')} ({i18n.t('subscription.price')})
              </Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.restoreButton, restoring && styles.disabledButton]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#4CAF50" />
          ) : (
            <Text style={styles.restoreText}>{i18n.t('subscription.restorePurchases')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}

function FeatureRow({ label }: { label: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureCheck}>✓</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  currentPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  planLabel: {
    fontSize: 16,
    color: '#666',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeBadge: {
    backgroundColor: '#f0f0f0',
  },
  premiumBadge: {
    backgroundColor: '#E8F5E9',
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  freeBadgeText: {
    color: '#666',
  },
  premiumBadgeText: {
    color: '#4CAF50',
  },
  usageSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  usageItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  comparisonSection: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#f0faf0',
    borderRadius: 12,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureCheck: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  featureLabel: {
    fontSize: 15,
    color: '#333',
  },
  purchaseButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  purchaseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  manageButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  manageText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  restoreButton: {
    padding: 12,
    alignItems: 'center',
  },
  restoreText: {
    color: '#4CAF50',
    fontSize: 14,
  },
});
