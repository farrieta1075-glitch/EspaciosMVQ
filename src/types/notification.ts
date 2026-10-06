export type NotificationType =
  | "REJECTED_CREATE"
  | "REJECTED_UPDATE"
  | "REJECTED_CANCEL"
  | "APPROVED_CREATE"
  | "APPROVED_UPDATE"
  | "APPROVED_CANCEL";

export interface AppNotification {
  id: string;
  userId: string;
  areaId: string;
  reservationId: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}
