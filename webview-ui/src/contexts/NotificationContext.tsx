import React, { createContext, useState, ReactNode } from 'react';

interface Notification {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (notification: Notification) => void;
  dismissNotification: (index: number) => void;
}

export const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  showNotification: () => {},
  dismissNotification: () => {},
});

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = (notification: Notification) => {
    const newNotification = {
      ...notification,
      duration: notification.duration || 5000, // Default 5 seconds
    };
    
    setNotifications(prev => [...prev, newNotification]);

    // Auto-dismiss notification after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n !== newNotification));
      }, newNotification.duration);
    }
  };

  const dismissNotification = (index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}; 