import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import i18n from '../../i18n';

interface PostDetail {
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

export default function PostDetailScreen() {
  const params = useLocalSearchParams();
  const postId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
        setPost({
          id: postDoc.id,
          ...postDoc.data(),
        } as PostDetail);
      } else {
        Alert.alert(i18n.t('common.error'), i18n.t('postDetail.notFound'));
        router.back();
      }
    } catch (error: any) {
      console.error('게시글 로드 오류:', error);
      Alert.alert(i18n.t('common.error'), i18n.t('postDetail.loadError'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => {
    if (!post || !auth.currentUser) return;

    // 본인 게시글 체크
    if (post.userId === auth.currentUser.uid) {
      Alert.alert(i18n.t('common.confirm'), i18n.t('home.cannotChatOwnPost'));
      return;
    }

    const currentUserId = auth.currentUser.uid;
    const participants = [currentUserId, post.userId].sort();
    const sessionId = `${post.id}_${participants[0]}_${participants[1]}`;

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{i18n.t('postDetail.itemInfo')}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="cube" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{i18n.t('postDetail.item')}</Text>
              <Text style={styles.infoValue}>{post.item}</Text>
            </View>
          </View>
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

          <View style={styles.infoRow}>
            <Ionicons name="time" size={20} color="#666" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>{i18n.t('postDetail.time')}</Text>
              <Text style={styles.infoValue}>
                {post.startTime} ~ {post.endTime}
              </Text>
            </View>
          </View>
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

        <View style={styles.spacer} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.chatButton} onPress={handleStartChat}>
          <Ionicons name="chatbubble" size={20} color="white" />
          <Text style={styles.chatButtonText}>{i18n.t('postDetail.startChat')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    height: 80,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
