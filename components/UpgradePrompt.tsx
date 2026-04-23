import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { auth } from '../config/firebase';
import { purchaseSubscription } from '../utils/subscription';
import { useSubscription } from '../utils/SubscriptionContext';
import i18n from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  message: string;
}

export default function UpgradePrompt({ visible, onClose, message }: Props) {
  const [loading, setLoading] = useState(false);
  const { refresh } = useSubscription();

  const handlePurchase = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const success = await purchaseSubscription(auth.currentUser.uid);
      if (success) {
        await refresh();
        onClose();
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

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{i18n.t('subscription.premiumPlan')}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.features}>
            <Text style={styles.featureItem}>{i18n.t('subscription.features.noAds')}</Text>
            <Text style={styles.featureItem}>{i18n.t('subscription.features.unlimitedPosts')}</Text>
            <Text style={styles.featureItem}>{i18n.t('subscription.features.unlimitedChats')}</Text>
          </View>

          <TouchableOpacity
            style={[styles.upgradeButton, loading && styles.disabledButton]}
            onPress={handlePurchase}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.upgradeText}>
                {i18n.t('subscription.upgradeButton')} ({i18n.t('subscription.price')})
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterButton} onPress={onClose}>
            <Text style={styles.laterText}>{i18n.t('subscription.maybeLater')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  features: {
    alignSelf: 'stretch',
    marginBottom: 24,
    gap: 8,
  },
  featureItem: {
    fontSize: 15,
    color: '#333',
    paddingLeft: 8,
  },
  upgradeButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  upgradeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  laterButton: {
    paddingVertical: 8,
  },
  laterText: {
    color: '#999',
    fontSize: 14,
  },
});
