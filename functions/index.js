const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();

const ALLOWED_REDIRECT_URIS = [
  "https://auth.expo.io",
  "exp://",
  "halfandhalf://",
];

function isAllowedRedirectUri(uri) {
  if (typeof uri !== "string" || uri.length > 2000) return false;
  return ALLOWED_REDIRECT_URIS.some((prefix) => uri.startsWith(prefix));
}

function sanitizeString(value, maxLength = 500) {
  if (typeof value !== "string") return null;
  return value.slice(0, maxLength).trim();
}

// 환경변수에서 소셜 로그인 설정 읽기
// Firebase Functions 환경변수 설정 방법:
// firebase functions:secrets:set KAKAO_REST_API_KEY
// firebase functions:secrets:set NAVER_CLIENT_ID
// firebase functions:secrets:set NAVER_CLIENT_SECRET
// firebase functions:secrets:set INSTAGRAM_APP_ID
// firebase functions:secrets:set INSTAGRAM_APP_SECRET

/**
 * 카카오 소셜 로그인
 * 클라이언트에서 받은 auth code를 토큰으로 교환하고 Firebase custom token 반환
 */
exports.kakaoAuth = onRequest(
  { cors: true, secrets: ["KAKAO_REST_API_KEY"] },
  async (req, res) => {
    try {
      const code = sanitizeString(req.body.code, 1000);
      const redirectUri = sanitizeString(req.body.redirectUri, 2000);
      if (!code || !redirectUri) {
        return res.status(400).json({ error: "code and redirectUri are required" });
      }
      if (!isAllowedRedirectUri(redirectUri)) {
        return res.status(400).json({ error: "Invalid redirect URI" });
      }

      // 1. Auth code → Access token
      const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.KAKAO_REST_API_KEY,
          redirect_uri: redirectUri,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.status(400).json({ error: tokenData.error_description });
      }

      // 2. Access token → User info
      const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();

      const kakaoId = String(userData.id);
      const email = userData.kakao_account?.email || `kakao_${kakaoId}@kakao.local`;
      const nickname = userData.kakao_account?.profile?.nickname || "";

      // 3. Firebase 사용자 생성 또는 조회
      const uid = `kakao_${kakaoId}`;
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().getUser(uid);
      } catch (e) {
        firebaseUser = await admin.auth().createUser({
          uid,
          email,
          displayName: nickname,
        });
      }

      // 4. Firestore 사용자 문서 업데이트
      await admin.firestore().doc(`users/${uid}`).set(
        {
          email,
          displayName: nickname,
          provider: "kakao",
          socialId: kakaoId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          blacklist: [],
        },
        { merge: true }
      );

      // 5. Custom token 발급
      const customToken = await admin.auth().createCustomToken(uid);
      return res.json({ token: customToken, email, displayName: nickname });
    } catch (error) {
      console.error("Kakao auth error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  }
);

/**
 * 네이버 소셜 로그인
 */
exports.naverAuth = onRequest(
  { cors: true, secrets: ["NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"] },
  async (req, res) => {
    try {
      const code = sanitizeString(req.body.code, 1000);
      const state = sanitizeString(req.body.state, 500);
      if (!code || !state) {
        return res.status(400).json({ error: "code and state are required" });
      }

      // 1. Auth code → Access token
      const tokenRes = await fetch(
        `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${process.env.NAVER_CLIENT_ID}&client_secret=${process.env.NAVER_CLIENT_SECRET}&code=${code}&state=${state}`,
        { method: "POST" }
      );
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return res.status(400).json({ error: tokenData.error_description });
      }

      // 2. Access token → User info
      const userRes = await fetch("https://openapi.naver.com/v1/nid/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userData = await userRes.json();
      const profile = userData.response;

      const naverId = profile.id;
      const email = profile.email || `naver_${naverId}@naver.local`;
      const nickname = profile.nickname || profile.name || "";

      // 3. Firebase 사용자 생성 또는 조회
      const uid = `naver_${naverId}`;
      try {
        await admin.auth().getUser(uid);
      } catch (e) {
        await admin.auth().createUser({
          uid,
          email,
          displayName: nickname,
        });
      }

      // 4. Firestore 사용자 문서 업데이트
      await admin.firestore().doc(`users/${uid}`).set(
        {
          email,
          displayName: nickname,
          provider: "naver",
          socialId: naverId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          blacklist: [],
        },
        { merge: true }
      );

      // 5. Custom token 발급
      const customToken = await admin.auth().createCustomToken(uid);
      return res.json({ token: customToken, email, displayName: nickname });
    } catch (error) {
      console.error("Naver auth error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  }
);

/**
 * 인스타그램 소셜 로그인
 */
exports.instagramAuth = onRequest(
  { cors: true, secrets: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"] },
  async (req, res) => {
    try {
      const code = sanitizeString(req.body.code, 1000);
      const redirectUri = sanitizeString(req.body.redirectUri, 2000);
      if (!code || !redirectUri) {
        return res.status(400).json({ error: "code and redirectUri are required" });
      }
      if (!isAllowedRedirectUri(redirectUri)) {
        return res.status(400).json({ error: "Invalid redirect URI" });
      }

      // 1. Auth code → Short-lived token
      const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.INSTAGRAM_APP_ID,
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error_message) {
        return res.status(400).json({ error: tokenData.error_message });
      }

      // 2. Get user profile
      const userRes = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${tokenData.access_token}`
      );
      const userData = await userRes.json();

      const igId = String(tokenData.user_id || userData.id);
      const username = userData.username || "";

      // 3. Firebase 사용자 생성 또는 조회
      const uid = `instagram_${igId}`;
      const email = `instagram_${igId}@instagram.local`;
      try {
        await admin.auth().getUser(uid);
      } catch (e) {
        await admin.auth().createUser({
          uid,
          email,
          displayName: username,
        });
      }

      // 4. Firestore 사용자 문서 업데이트
      await admin.firestore().doc(`users/${uid}`).set(
        {
          email,
          displayName: username,
          provider: "instagram",
          socialId: igId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          blacklist: [],
        },
        { merge: true }
      );

      // 5. Custom token 발급
      const customToken = await admin.auth().createCustomToken(uid);
      return res.json({ token: customToken, email, displayName: username });
    } catch (error) {
      console.error("Instagram auth error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  }
);

/**
 * 서버사이드 일일 사용량 증가 및 제한 검증
 */
const FREE_MAX_POSTS = 3;
const FREE_MAX_CHATS = 5;

function getTodayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

exports.incrementUsage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required");
  }

  const { type } = request.data;
  if (type !== "post" && type !== "chat") {
    throw new HttpsError("invalid-argument", "type must be 'post' or 'chat'");
  }

  const uid = request.auth.uid;
  const userRef = admin.firestore().doc(`users/${uid}`);
  const today = getTodayKST();

  const result = await admin.firestore().runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const data = userDoc.data() || {};
    const subscription = data.subscription || {};
    const isPremium = subscription.status === "premium";

    if (isPremium) {
      return { allowed: true };
    }

    const usage = data.dailyUsage || {};
    const isNewDay = usage.date !== today;
    const postCount = isNewDay ? 0 : (usage.postCount || 0);
    const chatStartCount = isNewDay ? 0 : (usage.chatStartCount || 0);

    if (type === "post" && postCount >= FREE_MAX_POSTS) {
      return { allowed: false, reason: "post_limit" };
    }
    if (type === "chat" && chatStartCount >= FREE_MAX_CHATS) {
      return { allowed: false, reason: "chat_limit" };
    }

    const newUsage = {
      date: today,
      postCount: type === "post" ? postCount + 1 : postCount,
      chatStartCount: type === "chat" ? chatStartCount + 1 : chatStartCount,
    };

    transaction.update(userRef, { dailyUsage: newUsage });
    return { allowed: true };
  });

  if (!result.allowed) {
    throw new HttpsError("resource-exhausted", result.reason);
  }

  return { success: true };
});

/**
 * RevenueCat 웹훅 — 구독 상태 동기화
 */
exports.revenueCatWebhook = onRequest({ cors: true }, async (req, res) => {
  try {
    const event = req.body.event;
    if (!event) {
      return res.status(400).json({ error: "Missing event" });
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      return res.status(400).json({ error: "Missing app_user_id" });
    }

    const userRef = admin.firestore().doc(`users/${appUserId}`);
    const eventType = event.type;

    if (["INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"].includes(eventType)) {
      await userRef.set({
        subscription: {
          status: "premium",
          productId: event.product_id || null,
          expiresAt: event.expiration_at_ms
            ? new Date(event.expiration_at_ms)
            : null,
          platform: event.store || null,
        },
      }, { merge: true });
    } else if (["CANCELLATION", "EXPIRATION"].includes(eventType)) {
      await userRef.set({
        subscription: { status: "free" },
      }, { merge: true });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("RevenueCat webhook error:", error);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});
