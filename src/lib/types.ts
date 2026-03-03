export type UserRole = 'docent' | 'coordinator' | 'secretary' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type AttendanceMethod = 'QR' | 'Manual';
export type AttendanceType = 'entry' | 'exit';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: AttendanceType;
  method: AttendanceMethod;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export interface DayAttendance {
  userId: string;
  userName: string;
  date: string;
  entry?: AttendanceRecord;
  exit?: AttendanceRecord;
}
