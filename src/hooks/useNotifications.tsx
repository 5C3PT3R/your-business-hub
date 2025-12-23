import { useState, useEffect, useCallback } from 'react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAt: Date;
}

const NOTIFICATIONS_KEY = 'upflo_notifications';
const READ_NOTIFICATIONS_KEY = 'upflo_read_notifications';

// Get initial notifications from localStorage or use defaults
const getStoredNotifications = (): Notification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((n: any) => ({ ...n, createdAt: new Date(n.createdAt) }));
    }
  } catch (e) {
    console.error('Error reading notifications from localStorage:', e);
  }
  return [];
};

const getReadNotificationIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch (e) {
    console.error('Error reading read notifications from localStorage:', e);
  }
  return new Set();
};

// Singleton state to share across components
let globalNotifications: Notification[] = getStoredNotifications();
let globalReadIds: Set<string> = getReadNotificationIds();
let listeners: Set<() => void> = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

const saveToStorage = () => {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(globalNotifications));
  localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...globalReadIds]));
};

export function useNotifications() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const notifications = globalNotifications.map(n => ({
    ...n,
    read: globalReadIds.has(n.id)
  }));

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((title: string, message: string) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      title,
      message,
      time: 'Just now',
      read: false,
      createdAt: new Date(),
    };
    globalNotifications = [newNotification, ...globalNotifications];
    saveToStorage();
    notifyListeners();
  }, []);

  const markAsRead = useCallback((id: string) => {
    globalReadIds.add(id);
    saveToStorage();
    notifyListeners();
  }, []);

  const markAllAsRead = useCallback(() => {
    globalNotifications.forEach(n => globalReadIds.add(n.id));
    saveToStorage();
    notifyListeners();
  }, []);

  const clearNotification = useCallback((id: string) => {
    globalNotifications = globalNotifications.filter(n => n.id !== id);
    globalReadIds.delete(id);
    saveToStorage();
    notifyListeners();
  }, []);

  const clearAll = useCallback(() => {
    globalNotifications = [];
    globalReadIds.clear();
    saveToStorage();
    notifyListeners();
  }, []);

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  };
}
