import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 게시글 삭제 시 관련된 모든 채팅 세션과 메시지를 삭제합니다.
 */
export const deleteChatSessionsForPost = async (postId: string) => {
  try {
    // 1. 해당 게시글과 관련된 모든 채팅 세션 찾기
    const chatSessionsQuery = query(
      collection(db, 'chatSessions'),
      where('postId', '==', postId)
    );
    const chatSessionsSnapshot = await getDocs(chatSessionsQuery);

    if (chatSessionsSnapshot.empty) {
      return; // 채팅 세션이 없으면 종료
    }

    const batch = writeBatch(db);
    const sessionIds: string[] = [];

    // 2. 채팅 세션 삭제
    for (const sessionDoc of chatSessionsSnapshot.docs) {
      sessionIds.push(sessionDoc.id);
      batch.delete(doc(db, 'chatSessions', sessionDoc.id));

      // 3. 각 채팅 세션의 메시지 삭제
      const messagesQuery = query(
        collection(db, 'chatSessions', sessionDoc.id, 'messages')
      );
      const messagesSnapshot = await getDocs(messagesQuery);

      for (const messageDoc of messagesSnapshot.docs) {
        batch.delete(doc(db, 'chatSessions', sessionDoc.id, 'messages', messageDoc.id));
      }
    }

    // 4. 사용자들의 chatSessions 컬렉션에서 해당 세션 참조 삭제
    for (const sessionId of sessionIds) {
      const sessionData = chatSessionsSnapshot.docs.find(d => d.id === sessionId)?.data();
      if (sessionData?.participants) {
        for (const userId of sessionData.participants) {
          try {
            const userChatSessionRef = doc(db, 'users', userId, 'chatSessions', sessionId);
            batch.delete(userChatSessionRef);
          } catch (error) {
            console.error(`사용자 ${userId}의 채팅 세션 참조 삭제 오류:`, error);
          }
        }
      }
    }

    // 5. 모든 변경사항 일괄 적용
    await batch.commit();
    console.log(`게시글 ${postId}의 채팅 세션 ${sessionIds.length}개 삭제 완료`);
  } catch (error) {
    console.error('채팅 세션 삭제 오류:', error);
    throw error;
  }
};
