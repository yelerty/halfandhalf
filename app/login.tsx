import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getErrorMessage } from '../utils/types';
import { signInWithKakao, signInWithNaver, signInWithInstagram } from '../utils/socialAuth';
import i18n from '../i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const validateInput = (): boolean => {
    if (!email.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.email') + '를 입력해주세요.');
      return false;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert(i18n.t('common.error'), '올바른 이메일 형식을 입력해주세요.');
      return false;
    }

    if (!password) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.password') + '를 입력해주세요.');
      return false;
    }

    if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(i18n.t('common.error'), `비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return false;
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateInput()) return;
    setLoading(true);

    try {
      if (isSignUp) {
        // 회원가입
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 이메일 인증 메일 발송
        await sendEmailVerification(user);

        // 사용자 문서 초기화
        await setDoc(doc(db, 'users', user.uid), {
          email: email,
          createdAt: new Date().toISOString(),
          provider: 'email',
          blacklist: [],
        }, { merge: true });

        // 이메일 인증 화면으로 이동
        router.replace('/verify-email');
      } else {
        // 로그인
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 이메일 인증 확인
        if (!user.emailVerified) {
          try {
            await sendEmailVerification(user);
          } catch (verifyError: any) {
            if (verifyError?.code === 'auth/too-many-requests') {
              Alert.alert(i18n.t('common.error'), i18n.t('auth.tooManyRequests'));
            }
          }
          router.replace('/verify-email');
          return;
        }

        // 기존 사용자 문서 확인 및 생성 (마이그레이션용)
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            email: email,
            provider: 'email',
            blacklist: [],
          }, { merge: true });
        } else if (!userDoc.data()?.email) {
          await setDoc(doc(db, 'users', user.uid), {
            email: email,
          }, { merge: true });
        }

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(
          i18n.t('auth.emailInUseTitle'),
          i18n.t('auth.emailInUseMessage'),
          [
            { text: i18n.t('common.cancel'), style: 'cancel' },
            {
              text: i18n.t('auth.resetPassword'),
              onPress: () => handlePasswordReset(),
            },
          ]
        );
      } else {
        Alert.alert(i18n.t('common.error'), getErrorMessage(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.enterEmailForReset'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.invalidEmail'));
      return;
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(i18n.t('common.success'), i18n.t('auth.resetEmailSent'));
    } catch (error) {
      Alert.alert(i18n.t('common.error'), getErrorMessage(error));
    }
  };

  const handleSocialLogin = async (provider: 'kakao' | 'naver' | 'instagram') => {
    setSocialLoading(provider);
    try {
      switch (provider) {
        case 'kakao':
          await signInWithKakao();
          break;
        case 'naver':
          await signInWithNaver();
          break;
        case 'instagram':
          await signInWithInstagram();
          break;
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(i18n.t('common.error'), getErrorMessage(error));
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.innerContainer}>
          <Text style={styles.title}>{i18n.t('app.name')}</Text>
          <Text style={styles.subtitle}>{i18n.t('app.subtitle')}</Text>

          {/* 소셜 로그인 버튼 */}
          <View style={styles.socialSection}>
            <TouchableOpacity
              style={[styles.socialButton, styles.kakaoButton]}
              onPress={() => handleSocialLogin('kakao')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'kakao' ? (
                <ActivityIndicator color="#3C1E1E" />
              ) : (
                <>
                  <Text style={styles.kakaoIcon}>K</Text>
                  <Text style={styles.kakaoText}>{i18n.t('auth.kakaoLogin')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.naverButton]}
              onPress={() => handleSocialLogin('naver')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'naver' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.naverIcon}>N</Text>
                  <Text style={styles.naverText}>{i18n.t('auth.naverLogin')}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.instagramButton]}
              onPress={() => handleSocialLogin('instagram')}
              disabled={!!socialLoading}
            >
              {socialLoading === 'instagram' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.instagramIcon}>IG</Text>
                  <Text style={styles.instagramText}>{i18n.t('auth.instagramLogin')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* 구분선 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{i18n.t('auth.orDivider')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 이메일/비밀번호 폼 */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={i18n.t('auth.emailPlaceholder')}
              placeholderTextColor="#aaa"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder={i18n.t('auth.passwordPlaceholder')}
              placeholderTextColor="#aaa"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.disabledButton]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? i18n.t('auth.registerButton') : i18n.t('auth.loginButton')}
                </Text>
              )}
            </TouchableOpacity>

            {isSignUp && (
              <Text style={styles.verificationHint}>
                {i18n.t('auth.verificationHint')}
              </Text>
            )}

            {!isSignUp && (
              <TouchableOpacity onPress={handlePasswordReset}>
                <Text style={styles.forgotText}>{i18n.t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
              <Text style={styles.switchText}>
                {isSignUp ? `${i18n.t('auth.hasAccount')} ${i18n.t('auth.login')}` : `${i18n.t('auth.noAccount')} ${i18n.t('auth.register')}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  innerContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#4CAF50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
  },
  // 소셜 로그인
  socialSection: {
    gap: 10,
    marginBottom: 24,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  kakaoButton: {
    backgroundColor: '#FEE500',
  },
  kakaoIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3C1E1E',
  },
  kakaoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C1E1E',
  },
  naverButton: {
    backgroundColor: '#03C75A',
  },
  naverIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  naverText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  instagramButton: {
    backgroundColor: '#E1306C',
  },
  instagramIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  instagramText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  // 구분선
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 13,
  },
  // 폼
  form: {
    gap: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#aaa',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  verificationHint: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
  forgotText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 13,
  },
  switchText: {
    textAlign: 'center',
    color: '#4CAF50',
    marginTop: 4,
  },
});
