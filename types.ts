
export type Gender = 'LELAKI' | 'PEREMPUAN';
export type Group = string;
export type Form = string;
export type Field = 'MUZIK' | 'VISUAL' | 'TARI' | 'TEATER';

export interface Student {
  id: string;
  name: string;
  gender: Gender;
  group: Group;
  form: Form;
  field: Field;
  role?: string; // Role Akses
  notes?: string;
}

export interface Coach {
  name: string;
  field: string;
}

export interface AttendanceRecord {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'PRESENT' | 'ABSENT';
  timeSlot: string; // Slot masa sesi
}

export type View = 'DASHBOARD' | 'DATA_MURID' | 'TAMBAH_MURID' | 'IMPORT_MURID' | 'RINGKASAN' | 'MANUAL' | 'CARIAN_ARKIB';
