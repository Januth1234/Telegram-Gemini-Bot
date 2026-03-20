/**
 * Push notifications service using Firebase Cloud Messaging (FCM).
 * Handles permission, FCM token, saving token to Firestore, and foreground messages.
 */

import { getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, type MessagePayload } from "firebase/messaging";
import { firebaseService } from "./firebaseService";

const VAPID_KEY =
  (typeof process !== "undefined" && process.env?.VAPID_KEY) || (import.meta as any).env?.VITE_VAPID_KEY || "";

const FCM_SW_PATH = "/firebase-messaging-sw.js";

export type ForegroundMessageHandler = (payload: MessagePayload) => void;

class NotificationService {
  private messaging: ReturnType<typeof getMessaging> | null = null;
  private foregroundHandler: ForegroundMessageHandler | null = null;
  private tokenRequested = false;

  private getMessagingInstance() {
    if (typeof window === "undefined") return null;
    if (this.messaging) return this.messaging;
    try {
      const app = getApp();
      this.messaging = getMessaging(app);
      return this.messaging;
    } catch {
      return null;
    }
  }

  /** Check if push is supported (HTTPS, SW, notifications). */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_KEY
    );
  }

  /** Current permission state. */
  get permission(): NotificationPermission | "unsupported" {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  }

  /** Request notification permission and optionally get FCM token and save to Firestore. */
  async requestPermissionAndToken(saveToFirestore = true): Promise<string | null> {
    if (!this.isSupported()) return null;
    if (this.permission === "granted") {
      return this.getTokenAndSave(saveToFirestore);
    }
    if (this.permission === "denied") return null;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return null;
      return this.getTokenAndSave(saveToFirestore);
    } catch (_) {
      return null;
    }
  }

  /** Get FCM token; register SW if needed. Optionally save to Firestore for current user. */
  async getTokenAndSave(saveToFirestore = true): Promise<string | null> {
    if (!this.isSupported()) return null;
    const messaging = this.getMessagingInstance();
    if (!messaging) return null;
    try {
      let registration: ServiceWorkerRegistration | undefined;
      try {
        registration = await navigator.serviceWorker.getRegistration();
      } catch {
        registration = undefined;
      }
      if (!registration) {
        registration = await navigator.serviceWorker.register(FCM_SW_PATH, { scope: "/" });
        await navigator.serviceWorker.ready;
      }
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (token && saveToFirestore) {
        const user = firebaseService.currentUser();
        if (user?.uid) await firebaseService.saveFCMToken(user.uid, token);
      }
      return token;
    } catch (_) {
      return null;
    }
  }

  /**
   * Call once after login to request permission and store token.
   * Safe to call multiple times; will not re-prompt if already granted/denied.
   */
  async setupForUser(): Promise<string | null> {
    if (this.tokenRequested) return this.getTokenAndSave(true);
    this.tokenRequested = true;
    const token = await this.requestPermissionAndToken(true);
    this.setupForegroundListener();
    return token;
  }

  /** Listen for foreground messages (when app is open). */
  onForegroundMessage(handler: ForegroundMessageHandler): () => void {
    this.foregroundHandler = handler;
    this.setupForegroundListener();
    return () => {
      this.foregroundHandler = null;
    };
  }

  private setupForegroundListener() {
    const messaging = this.getMessagingInstance();
    if (!messaging) return;
    try {
      onMessage(messaging, (payload) => {
        if (this.foregroundHandler) this.foregroundHandler(payload);
      });
    } catch {
      // ignore
    }
  }
}

export const notificationService = new NotificationService();
