import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inLoginScreen = segments[0] === 'login';

    if (!user && inAuthGroup) {
      // 로그인 안되어있으면 로그인 화면으로
      router.replace('/login');
    } else if (user && inLoginScreen) {
      // 로그인 되어있으면 메인으로
      router.replace('/(tabs)');
    }
  }, [user, segments, loading]);

  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ title: '공동구매 등록', presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" options={{ title: '채팅' }} />
    </Stack>
  );
}
