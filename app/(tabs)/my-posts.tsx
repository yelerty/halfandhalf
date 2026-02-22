import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { deleteChatSessionsForPost } from '../../utils/chatUtils';
import { formatDate, formatTime, isPostExpired } from '../../utils/dateUtils';
import i18n from '../../i18n';

interface Post {
  id: string;
  store: string;
  item: string;
  date?: string;
  startTime: string;
  endTime: string;
  userEmail: string;
  userId: string;
  createdAt: any;
  expiredAt?: string;
}

export default function MyPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // 화면이 포커스될 때마다 보관함 새로고침
  useFocusEffect(
    useCallback(() => {
      loadArchivedPosts();
    }, [])
  );

  // 주기적으로 만료된 게시글 체크 (1분마다)
  useEffect(() => {
    let isMounted = true;

    const checkExpiredPosts = async () => {
      if (!auth.currentUser || posts.length === 0 || !isMounted) return;

      const now = new Date();
      const expiredPosts: Post[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const post of posts) {
        if (!isMounted) break;

        if (isPostExpired(post)) {
          expiredPosts.push(post);
          // 보관함에 저장
          await saveToArchive(post);
          // 채팅 세션 삭제 후 서버에서 삭제
          deletePromises.push(
            deleteChatSessionsForPost(post.id).then(() =>
              deleteDoc(doc(db, 'posts', post.id))
            )
          );
        }
      }

      if (deletePromises.length > 0 && isMounted) {
        await Promise.all(deletePromises);
        // 보관함 새로고침
        loadArchivedPosts();
      }
    };

    // 1분마다 체크
    const interval = setInterval(checkExpiredPosts, 60000);

    // 컴포넌트 마운트 시 즉시 한 번 실행
    checkExpiredPosts();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [posts]);

  useEffect(() => {
    if (!auth.currentUser) return;

    let isMounted = true;

    const q = query(
      collection(db, 'posts'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const now = new Date();
      const postsData: Post[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const docSnapshot of snapshot.docs) {
        if (!isMounted) break;

        const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;

        if (isPostExpired(post)) {
          // 보관함에 저장
          saveToArchive(post);
          // 채팅 세션 삭제 후 서버에서 삭제
          deletePromises.push(
            deleteChatSessionsForPost(docSnapshot.id).then(() =>
              deleteDoc(doc(db, 'posts', docSnapshot.id))
            )
          );
        } else {
          postsData.push(post);
        }
      }

      // 만료된 게시글 삭제
      await Promise.all(deletePromises);

      if (!isMounted) return;

      // 클라이언트에서 정렬 (createdAt 기준 내림차순)
      postsData.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.seconds - a.createdAt.seconds;
      });

      setPosts(postsData);
      setLoading(false);

      // 보관함 새로고침
      loadArchivedPosts();
    }, (error) => {
      // 권한 에러는 로그인 전이므로 무시
      if (error.code === 'permission-denied') {
        console.log('Still loading auth state...');
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      console.error('내 게시글 로드 오류:', error);
      if (isMounted) {
        setLoading(false);
        Alert.alert(i18n.t('common.error'), i18n.t('editPost.loadError'));
      }
    });

    // 보관된 게시글 로드
    loadArchivedPosts();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const saveToArchive = async (post: Post) => {
    try {
      const key = `@expired_posts_${auth.currentUser?.uid}`;
      const existing = await AsyncStorage.getItem(key);
      const expiredPosts = existing ? JSON.parse(existing) : [];

      // 이미 저장된 게시글인지 확인
      const alreadyExists = expiredPosts.some((p: Post) => p.id === post.id);
      if (!alreadyExists) {
        expiredPosts.push({
          ...post,
          expiredAt: new Date().toISOString(),
        });
        await AsyncStorage.setItem(key, JSON.stringify(expiredPosts));
      }
    } catch (error) {
      console.error('보관함 저장 오류:', error);
    }
  };

  const loadArchivedPosts = async () => {
    try {
      const key = `@expired_posts_${auth.currentUser?.uid}`;
      const existing = await AsyncStorage.getItem(key);
      if (existing) {
        const archived = JSON.parse(existing);
        // 최신순으로 정렬
        archived.sort((a: Post, b: Post) => {
          return new Date(b.expiredAt || 0).getTime() - new Date(a.expiredAt || 0).getTime();
        });
        setArchivedPosts(archived);
      }
    } catch (error) {
      console.error('보관된 게시글 로드 오류:', error);
    }
  };

  const handleRepost = async (archivedPost: Post) => {
    try {
      // 로그인 확인
      if (!auth.currentUser) {
        Alert.alert(i18n.t('common.error'), '로그인이 필요합니다');
        return;
      }

      // 위치 정보 가져오기
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(i18n.t('common.error'), i18n.t('createPost.permissionRequired'));
        return;
      }

      let location = null;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      } catch (locError) {
        console.error('위치 정보 가져오기 오류:', locError);
        Alert.alert(i18n.t('common.error'), i18n.t('createPost.locationRequired'));
        return;
      }

      // 현재 시간 기준으로 시간 설정
      const now = new Date();
      const startDate = new Date(now.getTime());
      const endDate = new Date(now.getTime() + 30 * 60 * 1000); // 30분 후

      // 임시 게시글 생성 (수정 화면으로 이동하기 위해)
      const tempPostRef = await addDoc(collection(db, 'posts'), {
        store: archivedPost.store || '',
        item: archivedPost.item || '',
        date: formatDate(now),
        startTime: formatTime(startDate),
        endTime: formatTime(endDate),
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || '',
        location: location,
        createdAt: serverTimestamp(),
      });

      // 수정 화면으로 이동 (재등록 모드로)
      router.push(`/edit-post/${tempPostRef.id}?repost=true&archivedId=${archivedPost.id}`);
    } catch (error: any) {
      console.error('재등록 오류:', error);
      Alert.alert(i18n.t('common.error'), error.message || '게시글 재등록 실패');
    }
  };

  const handleDeleteArchived = async (postId: string) => {
    Alert.alert(
      i18n.t('myPosts.deleteArchivedTitle'),
      i18n.t('myPosts.deleteArchivedMessage'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const key = `@expired_posts_${auth.currentUser?.uid}`;
              const existing = await AsyncStorage.getItem(key);
              if (existing) {
                const archived = JSON.parse(existing);
                const filtered = archived.filter((p: Post) => p.id !== postId);
                await AsyncStorage.setItem(key, JSON.stringify(filtered));
                setArchivedPosts(filtered);
                Alert.alert(i18n.t('common.success'), i18n.t('myPosts.deleteSuccess'));
              }
            } catch (error: any) {
              Alert.alert(i18n.t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('myPosts.title')}</Text>
      </View>

      {/* 탭 전환 버튼 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, !showArchived && styles.tabActive]}
          onPress={() => setShowArchived(false)}
        >
          <Text style={[styles.tabText, !showArchived && styles.tabTextActive]}>
            {i18n.t('myPosts.activePosts')} ({posts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, showArchived && styles.tabActive]}
          onPress={() => setShowArchived(true)}
        >
          <Text style={[styles.tabText, showArchived && styles.tabTextActive]}>
            {i18n.t('myPosts.archive')} ({archivedPosts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {loading && !showArchived ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : showArchived ? (
          archivedPosts.length === 0 ? (
            <Text style={styles.emptyText}>{i18n.t('myPosts.noArchivedPosts')}</Text>
          ) : (
            archivedPosts.map((post) => (
              <View key={post.id} style={styles.postCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{post.store}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteArchived(post.id)}
                    style={styles.deleteIconButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff5252" />
                  </TouchableOpacity>
                </View>
                {post.date && (
                  <Text style={styles.cardDate}>{post.date}</Text>
                )}
                <Text style={styles.cardTime}>
                  {post.startTime} - {post.endTime}
                </Text>
                <Text style={styles.cardItem}>{post.item}</Text>
                <Text style={styles.expiredText}>
                  {i18n.t('myPosts.expired')}: {new Date(post.expiredAt || '').toLocaleDateString()}
                </Text>
                <TouchableOpacity
                  style={styles.repostButton}
                  onPress={() => handleRepost(post)}
                >
                  <Ionicons name="refresh-outline" size={16} color="#4CAF50" />
                  <Text style={styles.repostText}>{i18n.t('myPosts.repost')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : (
          posts.length === 0 ? (
            <Text style={styles.emptyText}>{i18n.t('myPosts.noActivePosts')}</Text>
          ) : (
            posts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postCard}
                onPress={() => router.push(`/edit-post/${post.id}`)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{post.store}</Text>
                </View>
                {post.date && (
                  <Text style={styles.cardDate}>{post.date}</Text>
                )}
                <Text style={styles.cardTime}>
                  {post.startTime} - {post.endTime}
                </Text>
                <Text style={styles.cardItem}>{post.item}</Text>
                <View style={styles.editIndicator}>
                  <Ionicons name="pencil-outline" size={16} color="#4CAF50" />
                  <Text style={styles.editText}>{i18n.t('myPosts.editPost')}</Text>
                </View>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/create-post')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    flex: 1,
  },
  deleteIconButton: {
    padding: 4,
  },
  cardDate: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  cardItem: {
    fontSize: 16,
    marginBottom: 8,
  },
  expiredText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  editIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
  },
  editText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  repostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  repostText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
