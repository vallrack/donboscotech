
export type UserRole = 'docent' | 'coordinator' | 'secretary' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
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
  days: string[]; // ["Mon", "Tue"...]
}

export type AttendanceMethod = 'QR' | 'Manual';
export type AttendanceType = 'entry' | 'exit';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  time: string;
  type: AttendanceType;
  method: AttendanceMethod;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
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
