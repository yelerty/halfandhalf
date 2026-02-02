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

    const inAuthGroup = segments[0] === '(tabs)' || segments[0] === 'create-post' || segments[0] === 'edit-post' || segments[0] === 'chat';

    if (!user && !segments[0]) {
      // 초기 로드 시 로그인 화면으로
      router.replace('/login');
    } else if (!user && inAuthGroup) {
      // 로그인 안되어있으면 로그인 화면으로
      router.replace('/login');
    } else if (user && segments[0] === 'login') {
      // 로그인 되어있으면 메인으로
      router.replace('/(tabs)');
    }
  }, [user, segments, loading]);

  // 로딩 중이거나 로그인 안된 상태에서는 최소한의 스택만 렌더링
  if (loading) {
    return null;
  }

  // 로그인 안된 상태에서는 login 화면만 렌더링 (권한 에러 완전 방지)
  if (!user) {
    return (
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    );
  }

  // 로그인된 상태에서만 전체 스택 렌더링
  return (
    <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="create-post" options={{ title: '공동구매 등록', presentation: 'modal' }} />
      <Stack.Screen name="edit-post/[id]" options={{ title: '게시글 수정' }} />
      <Stack.Screen name="chat/[id]" options={{ title: '채팅' }} />
    </Stack>
  );
}
