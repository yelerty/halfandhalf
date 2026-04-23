import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { db } from '../config/firebase';
import {
  REVENUECAT_API_KEY,
  PREMIUM_ENTITLEMENT_ID,
  FREE_MAX_POSTS_PER_DAY,
  FREE_MAX_CHAT_STARTS_PER_DAY,
} from '../constants/subscription';

const functions = getFunctions();

export const initRevenueCat = () => {
  Purchases.configure({ apiKey: REVENUECAT_API_KEY });
};

export const loginRevenueCat = async (uid: string) => {
  await Purchases.logIn(uid);
};

const getTodayKST = (): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

export interface DailyUsage {
  date: string;
  postCount: number;
  chatStartCount: number;
}

export interface SubscriptionStatus {
  isPremium: boolean;
  expiresAt: Date | null;
  productId: string | null;
}

export const syncSubscriptionStatus = async (uid: string): Promise<SubscriptionStatus> => {
  try {
    const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();
    const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
    const activeEntitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
    const expiresAt = activeEntitlement?.expirationDate ? new Date(activeEntitlement.expirationDate) : null;
    const productId = activeEntitlement?.productIdentifier || null;

    await setDoc(doc(db, 'users', uid), {
      subscription: {
        status: isPremium ? 'premium' : 'free',
        expiresAt,
        productId,
      },
    }, { merge: true });

    return { isPremium, expiresAt, productId };
  } catch {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.data();
    return {
      isPremium: data?.subscription?.status === 'premium',
      expiresAt: data?.subscription?.expiresAt?.toDate?.() || null,
      productId: data?.subscription?.productId || null,
    };
  }
};

export const purchaseSubscription = async (uid: string): Promise<boolean> => {
  const offerings = await Purchases.getOfferings();
  const monthlyPackage: PurchasesPackage | undefined = offerings.current?.monthly ?? undefined;
  if (!monthlyPackage) throw new Error('No monthly package available');

  const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
  const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

  if (isPremium) {
    await setDoc(doc(db, 'users', uid), {
      subscription: {
        status: 'premium',
        productId: monthlyPackage.product.identifier,
      },
    }, { merge: true });
  }

  return isPremium;
};

export const restorePurchases = async (uid: string): Promise<boolean> => {
  const customerInfo = await Purchases.restorePurchases();
  const isPremium = !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

  await setDoc(doc(db, 'users', uid), {
    subscription: {
      status: isPremium ? 'premium' : 'free',
    },
  }, { merge: true });

  return isPremium;
};

export const getDailyUsage = async (uid: string): Promise<DailyUsage> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const data = userDoc.data();
  const usage = data?.dailyUsage;
  const today = getTodayKST();

  if (!usage || usage.date !== today) {
    return { date: today, postCount: 0, chatStartCount: 0 };
  }
  return usage;
};

// 서버사이드 검증 + 증가를 원자적으로 처리
const incrementUsage = httpsCallable(functions, 'incrementUsage');

export const incrementPostCount = async (): Promise<void> => {
  await incrementUsage({ type: 'post' });
};

export const incrementChatStartCount = async (): Promise<void> => {
  await incrementUsage({ type: 'chat' });
};

export const canCreatePost = async (uid: string, isPremium: boolean): Promise<boolean> => {
  if (isPremium) return true;
  const usage = await getDailyUsage(uid);
  return usage.postCount < FREE_MAX_POSTS_PER_DAY;
};

export const canStartChat = async (uid: string, isPremium: boolean): Promise<boolean> => {
  if (isPremium) return true;
  const usage = await getDailyUsage(uid);
  return usage.chatStartCount < FREE_MAX_CHAT_STARTS_PER_DAY;
};
