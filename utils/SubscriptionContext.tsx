import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../config/firebase';
import {
  syncSubscriptionStatus,
  getDailyUsage,
  DailyUsage,
  SubscriptionStatus,
} from './subscription';

interface SubscriptionContextType {
  isPremium: boolean;
  dailyUsage: DailyUsage;
  loading: boolean;
  refresh: () => Promise<void>;
}

const defaultUsage: DailyUsage = { date: '', postCount: 0, chatStartCount: 0 };

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  dailyUsage: defaultUsage,
  loading: true,
  refresh: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(defaultUsage);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const status: SubscriptionStatus = await syncSubscriptionStatus(user.uid);
      setIsPremium(status.isPremium);

      const usage = await getDailyUsage(user.uid);
      setDailyUsage(usage);
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        refresh();
      } else {
        setIsPremium(false);
        setDailyUsage(defaultUsage);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [refresh]);

  return (
    <SubscriptionContext.Provider value={{ isPremium, dailyUsage, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
