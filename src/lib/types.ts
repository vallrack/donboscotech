
export type UserRole = 'docent' | 'coordinator' | 'secretary' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  signatureUrl?: string;
  documentId?: string;
  campus?: string;
  program?: string;
  shiftIds?: string[];
}

export interface Campus {
  id: string;
  name: string;
  address?: string;
}

export interface Program {
  id: string;
  name: string;
  type: 'Technical' | 'Academic' | 'Administrative';
}

export interface Shift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  days: string[]; // ["Lun", "Mar"...]
}

export type AttendanceMethod = 'QR' | 'Manual' | 'QR Terminal';
export type AttendanceType = 'entry' | 'exit';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  time: string;
  type: AttendanceType;
  method: AttendanceMethod;
  shiftId?: string;
  shiftName?: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  docentSignature?: string; // Firma capturada del docente
  isVerified?: boolean; // Validación por coordinador
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedBySignature?: string; // Firma del coordinador
  verifiedAt?: any;
  createdAt?: any;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'high' | 'normal';
  status: 'active' | 'inactive';
  createdAt: any;
  createdBy: string;
  authorName: string;
}
