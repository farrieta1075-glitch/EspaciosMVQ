export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  updatedAt: string;
}
