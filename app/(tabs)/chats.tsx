import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import i18n from '../../i18n';
import { Animated, PanResponder } from 'react-native';

interface ChatSession {
  sessionId: string;
  postId: string;
  postTitle: string;
  lastMessage: string;
  lastMessageTime: any;
  unreadCount: number;
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleDeleteChat = (sessionId: string) => {
    Alert.alert(
      i18n.t('chats.deleteTitle'),
      i18n.t('chats.deleteConfirm'),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (!auth.currentUser) {
              Alert.alert(i18n.t('common.error'), i18n.t('auth.login'));
              return;
            }

            try {
              // 자신의 chatSessions 참조 삭제
              const userSessionRef = doc(db, 'users', auth.currentUser.uid, 'chatSessions', sessionId);
              await deleteDoc(userSessionRef);
              setSelectedSessionId(null);
            } catch (error: any) {
              console.error('채팅 삭제 오류:', error);
              let errorMsg = i18n.t('chats.deleteError');
              if (error.code === 'permission-denied') {
                errorMsg = i18n.t('errors.firebaseConfig');
              }
              Alert.alert(i18n.t('common.error'), errorMsg);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    let isMounted = true;

    // 내 채팅 세션 실시간 구독
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'chatSessions')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const sessions: ChatSession[] = [];

        for (const sessionDoc of snapshot.docs) {
          const sessionData = sessionDoc.data();
          const sessionId = sessionData.sessionId;

          // sessionId가 없으면 건너뛰기
          if (!sessionId) continue;

          // active가 false이거나 없으면 건너뛰기 (나간 채팅방)
          if (sessionData.active === false) continue;

          // 필수 데이터 확인 (postStore, postItem은 users/chatSessions에 저장됨)
          if (!sessionData.postStore || !sessionData.postItem) continue;

          // 채팅 세션 추가 (N+1 쿼리 제거, 저장된 데이터 사용)
          sessions.push({
            sessionId,
            postId: sessionData.postId,
            postTitle: `${sessionData.postStore} - ${sessionData.postItem}`,
            lastMessage: sessionData.lastMessage || i18n.t('chats.startChatting'),
            lastMessageTime: sessionData.lastMessageAt,
            unreadCount: sessionData.unreadCount || 0,
          });
        }

        if (!isMounted) return;

        // 최신 메시지 순으로 정렬
        sessions.sort((a, b) => {
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
        });

        setChatSessions(sessions);
        setLoading(false);
      },
      (error) => {
        // 권한 에러는 로그인 전이므로 무시
        if (error.code !== 'permission-denied') {
          console.error('채팅 세션 로딩 오류:', error);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t('chats.title')}</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : chatSessions.length === 0 ? (
          <Text style={styles.emptyText}>{i18n.t('chats.noChats')}</Text>
        ) : (
          chatSessions.map((session) => (
            <View
              key={session.sessionId}
              style={[
                styles.chatCardWrapper,
                selectedSessionId === session.sessionId && styles.chatCardSelected,
              ]}
            >
              <TouchableOpacity
                style={styles.chatCard}
                onPress={() => router.push(`/chat/${session.sessionId}`)}
                onLongPress={() => setSelectedSessionId(session.sessionId)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="chatbubbles" size={40} color="#4CAF50" />
                  {session.unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {session.unreadCount > 99 ? '99+' : session.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.chatInfo}>
                  <Text style={styles.postTitle}>{session.postTitle}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {session.lastMessage}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#ccc" />
              </TouchableOpacity>

              {selectedSessionId === session.sessionId && (
                <View style={styles.deleteAction}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteChat(session.sessionId)}
                  >
                    <Ionicons name="trash" size={20} color="white" />
                    <Text style={styles.deleteText}>{i18n.t('common.delete')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => setSelectedSessionId(null)}
                  >
                    <Text style={styles.cancelText}>{i18n.t('common.cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
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
  content: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  chatCardWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatCardSelected: {
    backgroundColor: '#f5f5f5',
  },
  chatCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff1744',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: '#ff1744',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  deleteAction: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ff5252',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  deleteText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  cancelText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
});
