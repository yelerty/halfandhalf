import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Alert, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDoc, getDocs, setDoc, serverTimestamp, limit, startAfter } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import * as Location from 'expo-location';
import { calculateDistance } from '../../utils/location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteChatSessionsForPost } from '../../utils/chatUtils';
import { isPostExpired } from '../../utils/dateUtils';
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
  location?: {
    latitude: number;
    longitude: number;
  };
  createdAt: any;
}

const PAGE_SIZE = 20;

export default function HomeScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeFilter, setStoreFilter] = useState('');
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const blacklistSet = useMemo(() => new Set(blacklist), [blacklist]);

  // 만료된 게시글을 로컬에 저장
  const saveExpiredPost = async (post: Post) => {
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
      console.error('만료된 게시글 저장 오류:', error);
    }
  };

  // 사용자 위치 가져오기
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  // 블랙리스트 불러오기
  useEffect(() => {
    if (!auth.currentUser) return;

    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setBlacklist(docSnapshot.data()?.blacklist || []);
        }
      },
      (error) => {
        // 권한 에러는 로그인 전이므로 무시
        if (error.code !== 'permission-denied') {
          console.error('블랙리스트 로딩 오류:', error);
        }
      }
    );

    return unsubscribe;
  }, []);

  // 게시글 불러오기 & 만료된 게시글 삭제 (페이지네이션)
  const loadPosts = useCallback(async (isRefresh = false) => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const postsData: Post[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const docSnapshot of snapshot.docs) {
        const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;

        if (isPostExpired(post)) {
          if (post.userId === auth.currentUser?.uid) {
            saveExpiredPost(post);
          }
          deletePromises.push(
            deleteChatSessionsForPost(docSnapshot.id).then(() =>
              deleteDoc(doc(db, 'posts', docSnapshot.id))
            )
          );
        } else {
          postsData.push(post);
        }
      }

      await Promise.all(deletePromises);

      setPosts(postsData);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error: any) {
      if (error.code !== 'permission-denied') {
        console.error('게시글 로딩 오류:', error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (!auth.currentUser || !lastDoc || !hasMore || loadingMore) return;

    setLoadingMore(true);

    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const postsData: Post[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const docSnapshot of snapshot.docs) {
        const post = { id: docSnapshot.id, ...docSnapshot.data() } as Post;

        if (isPostExpired(post)) {
          if (post.userId === auth.currentUser?.uid) {
            saveExpiredPost(post);
          }
          deletePromises.push(
            deleteChatSessionsForPost(docSnapshot.id).then(() =>
              deleteDoc(doc(db, 'posts', docSnapshot.id))
            )
          );
        } else {
          postsData.push(post);
        }
      }

      await Promise.all(deletePromises);

      setPosts(prev => [...prev, ...postsData]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('추가 게시글 로딩 오류:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, hasMore, loadingMore]);

  useEffect(() => {
    loadPosts();
  }, []);

  // 필터링 (내 게시글 제외 & 매장 & 블랙리스트 & 30km 반경)
  useEffect(() => {
    let filtered = posts;

    // 내 게시글 제외
    filtered = filtered.filter(post => post.userId !== auth.currentUser?.uid);

    // 30km 반경 필터 (위치 정보가 있는 경우에만)
    if (userLocation) {
      filtered = filtered.filter(post => {
        if (!post.location) return false; // 위치 정보 없는 게시글 제외

        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          post.location.latitude,
          post.location.longitude
        );

        return distance <= 30; // 30km 이내만 표시
      });
    }

    // 매장 필터
    if (storeFilter.trim()) {
      filtered = filtered.filter(post =>
        post.store.toLowerCase().includes(storeFilter.toLowerCase())
      );
    }

    // 블랙리스트 필터
    filtered = filtered.filter(post => !blacklistSet.has(post.userId));

    setFilteredPosts(filtered);
  }, [posts, storeFilter, blacklistSet, userLocation]);

  const handleAddToBlacklist = async (userId: string, userEmail: string) => {
    if (!auth.currentUser) {
      Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
      return;
    }

    try {
      const currentUserId = auth.currentUser.uid;
      const userDocRef = doc(db, 'users', currentUserId);
      const userDoc = await getDoc(userDocRef);

      const currentBlacklist = userDoc.exists() ? (userDoc.data()?.blacklist || []) : [];

      if (!currentBlacklist.includes(userId)) {
        await setDoc(userDocRef, {
          blacklist: [...currentBlacklist, userId]
        }, { merge: true });

        Alert.alert(i18n.t('common.success'), `${userEmail}${i18n.t('home.addedToBlacklist')}`);
      }
    } catch (error) {
      console.error('블랙리스트 추가 오류:', error);
      Alert.alert(i18n.t('common.error'), i18n.t('errors.generic'));
    }
  };

  const handleViewDetail = (post: Post) => {
    router.push({
      pathname: `/post-detail/${post.id}`,
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('app.name')}</Text>
        <Text style={styles.subtitle}>{i18n.t('app.subtitle')}</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={i18n.t('home.searchPlaceholder')}
            value={storeFilter}
            onChangeText={setStoreFilter}
            placeholderTextColor="#999"
          />
          {storeFilter ? (
            <TouchableOpacity onPress={() => setStoreFilter('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPosts(true)}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : filteredPosts.length === 0 ? (
          <Text style={styles.emptyText}>
            {storeFilter ? i18n.t('home.noResults') : i18n.t('home.noPosts')}
          </Text>
        ) : (
          filteredPosts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.postCard}
              onPress={() => handleViewDetail(post)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{post.store}</Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleAddToBlacklist(post.userId, post.userEmail);
                  }}
                  style={styles.blockButton}
                >
                  <Ionicons name="ban" size={20} color="#ff5252" />
                </TouchableOpacity>
              </View>
              {post.date && (
                <Text style={styles.cardDate}>{post.date}</Text>
              )}
              <Text style={styles.cardTime}>
                {post.startTime} - {post.endTime}
              </Text>
              <Text style={styles.cardItem}>{post.item}</Text>
              <Text style={styles.cardUser}>{post.userEmail}</Text>
              <View style={styles.chatIndicator}>
                <Ionicons name="arrow-forward" size={16} color="#4CAF50" />
                <Text style={styles.chatText}>{i18n.t('home.viewDetail')}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        {hasMore && !loading && filteredPosts.length > 0 && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={loadMorePosts}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Text style={styles.loadMoreText}>{i18n.t('home.loadMore')}</Text>
            )}
          </TouchableOpacity>
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
  subtitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 4,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  blockButton: {
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
  cardUser: {
    fontSize: 12,
    color: '#999',
  },
  chatIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 6,
  },
  chatText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  loadMoreButton: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
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
