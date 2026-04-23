import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// expo-notifications는 Expo Go(SDK 53+)에서 지원되지 않으므로 동적 import 사용
let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch {
  console.log('expo-notifications를 불러올 수 없습니다 (Expo Go 환경).');
}

/**
 * 푸시 알림 권한 요청 및 토큰 등록
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications || !Device) return null;

  try {
    // 실제 기기에서만 동작
    if (!Device.isDevice) {
      console.log('푸시 알림은 실제 기기에서만 동작합니다.');
      return null;
    }

    // 권한 확인
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('푸시 알림 권한이 거부되었습니다.');
      return null;
    }

    // Expo 푸시 토큰 가져오기
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Android 알림 채널 설정
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    return token;
  } catch (error) {
    console.log('푸시 알림 등록 실패 (Expo Go에서는 지원되지 않음):', error);
    return null;
  }
}

/**
 * 푸시 토큰을 Firestore 사용자 문서에 저장
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  await setDoc(doc(db, 'users', userId), {
    pushToken: token,
  }, { merge: true });
}

/**
 * 포그라운드 알림 핸들러 설정
 */
export function setupNotificationHandler(): void {
  if (!Notifications) return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.log('알림 핸들러 설정 실패:', error);
  }
}

/**
 * 알림 응답 리스너 등록 (사용자가 알림을 탭했을 때)
 * cleanup 함수를 반환
 */
export function addNotificationResponseListener(
  handler: (sessionId: string) => void
): () => void {
  if (!Notifications) return () => {};

  try {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.sessionId) {
        handler(data.sessionId as string);
      }
    });

    return () => subscription.remove();
  } catch (error) {
    console.log('알림 리스너 등록 실패:', error);
    return () => {};
  }
}
