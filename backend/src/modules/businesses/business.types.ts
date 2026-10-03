export interface BusinessRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  opening_hour: number;
  closing_hour: number;
  slot_minutes: number;
}

export interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  openingHour: number;
  closingHour: number;
  slotMinutes: number;
}
