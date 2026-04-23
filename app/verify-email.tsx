import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { sendEmailVerification, reload, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import i18n from '../i18n';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 주기적으로 인증 상태 확인
  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await reload(auth.currentUser);
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          router.replace('/(tabs)');
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // 재전송 쿨다운 타이머
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = async () => {
    if (!auth.currentUser) return;

    try {
      await sendEmailVerification(auth.currentUser);
      setResendDisabled(true);
      setCountdown(60);
      setTimeout(() => setResendDisabled(false), 60000);
      Alert.alert(i18n.t('common.success'), i18n.t('auth.verificationSent'));
    } catch (error: any) {
      const code = error?.code;
      if (code === 'auth/too-many-requests') {
        Alert.alert(i18n.t('common.error'), i18n.t('auth.tooManyRequests'));
      } else if (code === 'auth/network-request-failed') {
        Alert.alert(i18n.t('common.error'), i18n.t('errors.network'));
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('auth.verificationSendError'));
      }
    }
  };

  const handleBack = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✉️</Text>
      <Text style={styles.title}>{i18n.t('auth.verifyEmailTitle')}</Text>
      <Text style={styles.description}>
        {i18n.t('auth.verifyEmailDesc')}
      </Text>
      <Text style={styles.email}>{auth.currentUser?.email}</Text>

      <TouchableOpacity
        style={[styles.resendButton, resendDisabled && styles.disabledButton]}
        onPress={handleResend}
        disabled={resendDisabled}
      >
        <Text style={[styles.resendText, resendDisabled && styles.disabledText]}>
          {resendDisabled
            ? `${i18n.t('auth.resendVerification')} (${countdown}s)`
            : i18n.t('auth.resendVerification')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backText}>{i18n.t('auth.backToLogin')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 32,
  },
  resendButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  resendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledText: {
    color: '#999',
  },
  backButton: {
    paddingVertical: 12,
  },
  backText: {
    color: '#4CAF50',
    fontSize: 15,
  },
});
