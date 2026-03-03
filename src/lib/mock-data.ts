import { User, AttendanceRecord } from './types';

export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Juan Pérez', email: 'juan.perez@donbosco.edu', role: 'docent' },
  { id: 'u2', name: 'María García', email: 'maria.garcia@donbosco.edu', role: 'docent' },
  { id: 'u3', name: 'Carlos Ruiz', email: 'carlos.ruiz@donbosco.edu', role: 'coordinator' },
  { id: 'u4', name: 'Ana Martínez', email: 'ana.martinez@donbosco.edu', role: 'admin' },
];

export const MOCK_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 'a1',
    userId: 'u1',
    userName: 'Juan Pérez',
    date: '2023-10-25',
    time: '07:05',
    type: 'entry',
    method: 'QR',
    location: { lat: 6.2442, lng: -75.5812, address: 'Ciudad Don Bosco, Medellín' }
  },
  {
    id: 'a2',
    userId: 'u1',
    userName: 'Juan Pérez',
    date: '2023-10-25',
    time: '16:30',
    type: 'exit',
    method: 'QR',
    location: { lat: 6.2442, lng: -75.5812, address: 'Ciudad Don Bosco, Medellín' }
  },
  {
    id: 'a3',
    userId: 'u2',
    userName: 'María García',
    date: '2023-10-25',
    time: '08:15',
    type: 'entry',
    method: 'Manual',
    location: { lat: 6.2442, lng: -75.5812, address: 'Ciudad Don Bosco, Medellín' }
  }
];