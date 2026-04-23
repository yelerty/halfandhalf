import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { db, auth } from '../../config/firebase';
import { POST_CATEGORIES } from '../../constants/categories';
import { useSubscription } from '../../utils/SubscriptionContext';
import { canStartChat, incrementChatStartCount } from '../../utils/subscription';
import UpgradePrompt from '../../components/UpgradePrompt';
import i18n from '../../i18n';

interface PostDetail {
  id: string;
  store: string;
  item: string;
  items?: string[];
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  userEmail: string;
  userId: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  category?: string;
  imageUrls?: string[];
  createdAt: any;
}

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const { isPremium } = useSubscription();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadPostDetail();
  }, [postId]);

  const loadPostDetail = async () => {
    if (!postId) {
      Alert.alert(i18n.t('common.error'), i18n.t('postDetail.notFound'));
      router.back();
      return;
    }

    try {
      const postDoc = await getDoc(doc(db, 'posts', postId));

      if (postDoc.exists()) {
        const postData = {
          id: postDoc.id,
          ...postDoc.data(),
        } as PostDetail;
        setPost(postData);

        // 기존 채팅 세션 확인
        if (auth.currentUser) {
          await checkExistingSession(auth.currentUser.uid, postData.userId);
        }
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('postDetail.notFound'), [
          { text: i18n.t('common.confirm'), onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      Alert.alert(i18n.t('common.error'), i18n.t('postDetail.loadError'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSession = async (currentUserId: string, postOwnerId: string) => {
    try {
      // 1. 현재 사용자의 chatSessions에서 이 게시글과 관련된 세션 조회
      const userSessionsRef = collection(db, 'users', currentUserId, 'chatSessions');
      const snapshot = await getDocs(userSessionsRef);

      for (const docSnap of snapshot.docs) {
        const sessionData = docSnap.data();
        if (sessionData.postId === postId) {
          setExistingSessionId(sessionData.sessionId || docSnap.id);
          return;
        }
      }

      // 2. 상대방이 먼저 세션을 만든 경우: 글로벌 chatSessions에서도 확인
      const globalSessionsRef = collection(db, 'chatSessions');
      const globalQ = query(globalSessionsRef, where('postId', '==', postId));
      const globalSnapshot = await getDocs(globalQ);

      for (const docSnap of globalSnapshot.docs) {
        const sessionData = docSnap.data();
        const participants: string[] = sessionData.participants || [];
        if (participants.includes(currentUserId)) {
          setExistingSessionId(docSnap.id);
          return;
        }
      }

      setExistingSessionId(null);
    } catch (error) {
      console.log('Error checking existing session:', error);
      setExistingSessionId(null);
    }
  };

  const handleStartChat = async () => {
    if (!post || !auth.currentUser) return;

    // 본인 게시글 체크
    if (post.userId === auth.currentUser.uid) {
      Alert.alert(i18n.t('common.confirm'), i18n.t('home.cannotChatOwnPost'));
      return;
    }

    // 새 채팅인 경우에만 제한 체크
    if (!existingSessionId) {
      const allowed = await canStartChat(auth.currentUser.uid, isPremium);
      if (!allowed) {
        setShowUpgrade(true);
        return;
      }
      await incrementChatStartCount();
    }

    const currentUserId = auth.currentUser.uid;
    const participants = [currentUserId, post.userId].sort();

    let sessionId: string;
    if (existingSessionId) {
      sessionId = existingSessionId;
    } else {
      const randomId = Crypto.randomUUID();
      sessionId = `${post.id}_${randomId}`;
    }

    router.push({
      pathname: `/chat/${sessionId}`,
      params: {
        postId: post.id,
        postStore: post.store,
        postItem: post.item,
        postUserId: post.userId,
        postUserEmail: post.userEmail,
        postStartTime: post.startTime,
        postEndTime: post.endTime,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{i18n.t('postDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: post.store }} />
      <UpgradePrompt
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        message={i18n.t('subscription.limits.chatLimitReached')}
      />
      <View style={styles.topWrapper}>
        <ScrollView style={styles.container}>
          <View style={styles.header}>
          <Text style={styles.storeName}>{post.store}</Text>
          <View style={styles.userInfo}>
            <Ionicons name="person-circle" size={40} color="#999" />
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{post.userEmail}</Text>
              <Text style={styles.userId}>ID: {post.userId.substring(0, 8)}...</Text>
            </View>
          </View>
        </View>

        {post.imageUrls && post.imageUrls.length > 0 && (
          <View style={styles.imageSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} pagingEnabled>
              {post.imageUrls.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {post.category && (
          <View style={styles.categorySection}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {i18n.t(`categories.${post.category}`)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('postDetail.itemInfo')}</Text>
          {post.items && post.items.length > 0 ? (
            post.items.map((item, index) => {
              const itemsLength = post.items?.length || 0;
              return (
                <View key={index} style={styles.infoRow}>
                  <Ionicons name="cube" size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>{i18n.t('postDetail.item')} {itemsLength > 1 ? `(${index + 1})` : ''}</Text>
                    <Text style={styles.infoValue}>{item}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.infoRow}>
              <Ionicons name="cube" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{i18n.t('postDetail.item')}</Text>
                <Text style={styles.infoValue}>{post.item}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('postDetail.schedule')}</Text>

          {post.date && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{i18n.t('postDetail.date')}</Text>
                <Text style={styles.infoValue}>{post.date}</Text>
              </View>
            </View>
          )}

          {post.startTime && post.endTime && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{i18n.t('postDetail.time')}</Text>
                <Text style={styles.infoValue}>
                  {post.startTime} ~ {post.endTime}{post.endDate && post.endDate !== post.date ? ` (${post.endDate})` : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {post.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{i18n.t('postDetail.location')}</Text>
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#666" />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{i18n.t('postDetail.coordinates')}</Text>
                <Text style={styles.infoValue}>
                  {post.location.latitude.toFixed(4)}, {post.location.longitude.toFixed(4)}
                </Text>
              </View>
            </View>
          </View>
        )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
              <Ionicons name="chatbubble" size={20} color="white" />
              <Text style={styles.chatButtonText}>
                {existingSessionId ? '채팅으로 가기' : i18n.t('postDetail.startChat')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  storeName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userId: {
    fontSize: 12,
    color: '#999',
  },
  imageSection: {
    backgroundColor: 'white',
    marginTop: 12,
  },
  detailImage: {
    width: Dimensions.get('window').width,
    height: 250,
  },
  categorySection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryBadgeText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 40,
  },
  spacer: {
    height: 0,
  },
  footer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  chatButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  chatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
