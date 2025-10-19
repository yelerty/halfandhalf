import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

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

  useEffect(() => {
    if (!auth.currentUser) return;

    // 내 채팅 세션 실시간 구독
    const q = query(
      collection(db, 'users', auth.currentUser.uid, 'chatSessions')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const sessions: ChatSession[] = [];

      for (const sessionDoc of snapshot.docs) {
        const sessionData = sessionDoc.data();
        const sessionId = sessionData.sessionId;

        // sessionId가 없으면 건너뛰기
        if (!sessionId) continue;

        // active가 false이거나 없으면 건너뛰기 (나간 채팅방)
        if (sessionData.active === false) continue;

        try {
          // 채팅 세션 정보 가져오기
          const chatSessionDoc = await getDoc(doc(db, 'chatSessions', sessionId));

          // 채팅 세션이 존재하는지 확인
          if (chatSessionDoc.exists()) {
            const chatData = chatSessionDoc.data();

            // 본인과의 채팅 세션 필터링
            const participants = chatData.participants || [];
            const uniqueParticipants = [...new Set(participants)];
            if (uniqueParticipants.length === 1) continue;

            // 채팅 세션 추가
            sessions.push({
              sessionId,
              postId: sessionData.postId,
              postTitle: `${chatData.postStore} - ${chatData.postItem}`,
              lastMessage: chatData.lastMessage || '채팅을 시작해보세요',
              lastMessageTime: chatData.lastMessageAt,
              unreadCount: sessionData.unreadCount || 0,
            });
          } else {
            // 채팅 세션이 삭제되었으면 내 참조도 삭제
            await deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'chatSessions', sessionId));
          }
        } catch (error) {
          console.error('채팅 세션 로드 오류:', error);
        }
      }

      // 최신 메시지 순으로 정렬
      sessions.sort((a, b) => {
        if (!a.lastMessageTime) return 1;
        if (!b.lastMessageTime) return -1;
        return b.lastMessageTime.seconds - a.lastMessageTime.seconds;
      });

      setChatSessions(sessions);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>채팅</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: 40 }} />
        ) : chatSessions.length === 0 ? (
          <Text style={styles.emptyText}>채팅 세션이 없습니다</Text>
        ) : (
          chatSessions.map((session) => (
            <TouchableOpacity
              key={session.sessionId}
              style={styles.chatCard}
              onPress={() => router.push(`/chat/${session.sessionId}`)}
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
  chatCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    marginRight: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
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
});
