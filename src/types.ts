export type RailwayPointCategory =
  | 'km_marker'
  | 'switch'
  | 'crossing'
  | 'bridge'
  | 'culvert'
  | 'station'
  | 'signal'
  | 'other';

export type FontFamilyType = 'sans' | 'mono' | 'serif' | 'rounded';
export type LineHeightType = 'tight' | 'normal' | 'relaxed';
export type TextAlignType = 'left' | 'center' | 'right';

export interface TextStyleConfig {
  color?: string;
  fontFamily?: FontFamilyType;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  lineHeight?: LineHeightType;
  textAlign?: TextAlignType;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
}

export interface PointNote {
  id: string;
  text: string;
  createdAt: string;
  author: string;
  style?: TextStyleConfig;
}

export interface PointPhoto {
  id: string;
  dataUrl: string; // base64 or URL
  caption: string;
  takenAt: string;
}

export interface RailwayPoint {
  id: string;
  title: string;
  kmValue: string; // e.g. "142+350" or "48.2"
  lineName: string; // e.g. "Ankara - Eskişehir YHT"
  locationDesc?: string; // e.g. "Polatlı Batı Girişi"
  category: RailwayPointCategory;
  lat: number;
  lng: number;
  description: string;
  notes: PointNote[];
  photos: PointPhoto[];
  createdAt: string;
  updatedAt: string;
  textStyle?: TextStyleConfig;
  titleTextStyle?: TextStyleConfig;
}

export interface FilterOptions {
  search: string;
  selectedLine: string;
  category: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  email?: string;
  userName?: string;
  role?: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  details: string;
  ip?: string;
}
