
import { format } from 'date-fns';

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'jewish' | 'international';
  isDayOff: boolean;
}

// YYYY-MM-DD format
const holidaysData: Holiday[] = [
  // --- 2024 ---
  // International Holidays 2024
  { date: '2024-01-01', name: 'New Year\'s Day', type: 'international', isDayOff: true },
  { date: '2024-12-25', name: 'Christmas Day', type: 'international', isDayOff: true },

  // Jewish Holidays 2024
  { date: '2024-03-24', name: 'פורים', type: 'jewish', isDayOff: false },
  { date: '2024-04-22', name: 'ערב פסח', type: 'jewish', isDayOff: true },
  { date: '2024-04-23', name: 'פסח', type: 'jewish', isDayOff: true },
  { date: '2024-04-29', name: 'שביעי של פסח', type: 'jewish', isDayOff: true },
  { date: '2024-05-14', name: 'יום העצמאות', type: 'jewish', isDayOff: true },
  { date: '2024-06-11', name: 'ערב שבועות', type: 'jewish', isDayOff: true },
  { date: '2024-06-12', name: 'שבועות', type: 'jewish', isDayOff: true },
  { date: '2024-10-02', name: 'ערב ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2024-10-03', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2024-10-04', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2024-10-11', name: 'ערב יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2024-10-12', name: 'יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2024-10-16', name: 'ערב סוכות', type: 'jewish', isDayOff: true },
  { date: '2024-10-17', name: 'סוכות', type: 'jewish', isDayOff: true },
  { date: '2024-10-23', name: 'שמחת תורה', type: 'jewish', isDayOff: true },
  
  // --- 2025 ---
  // International Holidays 2025
  { date: '2025-01-01', name: 'New Year\'s Day', type: 'international', isDayOff: true },
  { date: '2025-12-25', name: 'Christmas Day', type: 'international', isDayOff: true },

  // Jewish Holidays 2025
  { date: '2025-03-14', name: 'פורים', type: 'jewish', isDayOff: false },
  { date: '2025-04-12', name: 'ערב פסח', type: 'jewish', isDayOff: true },
  { date: '2025-04-13', name: 'פסח', type: 'jewish', isDayOff: true },
  { date: '2025-04-19', name: 'שביעי של פסח', type: 'jewish', isDayOff: true },
  { date: '2025-05-01', name: 'יום העצמאות', type: 'jewish', isDayOff: true },
  { date: '2025-06-01', name: 'ערב שבועות', type: 'jewish', isDayOff: true },
  { date: '2025-06-02', name: 'שבועות', type: 'jewish', isDayOff: true },
  { date: '2025-09-22', name: 'ערב ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2025-09-23', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2025-09-24', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2025-10-01', name: 'ערב יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2025-10-02', name: 'יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2025-10-06', name: 'ערב סוכות', type: 'jewish', isDayOff: true },
  { date: '2025-10-07', name: 'סוכות', type: 'jewish', isDayOff: true },
  { date: '2025-10-13', name: 'שמחת תורה', type: 'jewish', isDayOff: true },

  // --- 2026 ---
  // International Holidays 2026
  { date: '2026-01-01', name: 'New Year\'s Day', type: 'international', isDayOff: true },
  { date: '2026-12-25', name: 'Christmas Day', type: 'international', isDayOff: true },

  // Jewish Holidays 2026
  { date: '2026-03-13', name: 'פורים', type: 'jewish', isDayOff: false },
  { date: '2026-04-11', name: 'ערב פסח', type: 'jewish', isDayOff: true },
  { date: '2026-04-12', name: 'פסח', type: 'jewish', isDayOff: true },
  { date: '2026-04-18', name: 'שביעי של פסח', type: 'jewish', isDayOff: true },
  { date: '2026-04-30', name: 'יום העצמאות', type: 'jewish', isDayOff: true },
  { date: '2026-05-31', name: 'ערב שבועות', type: 'jewish', isDayOff: true },
  { date: '2026-06-01', name: 'שבועות', type: 'jewish', isDayOff: true },
  { date: '2026-09-21', name: 'ערב ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2026-09-22', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2026-09-23', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2026-09-30', name: 'ערב יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2026-10-01', name: 'יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2026-10-05', name: 'ערב סוכות', type: 'jewish', isDayOff: true },
  { date: '2026-10-06', name: 'סוכות', type: 'jewish', isDayOff: true },
  { date: '2026-10-12', name: 'שמחת תורה', type: 'jewish', isDayOff: true },

  // --- 2027 ---
  // International Holidays 2027
  { date: '2027-01-01', name: 'New Year\'s Day', type: 'international', isDayOff: true },
  { date: '2027-12-25', name: 'Christmas Day', type: 'international', isDayOff: true },

  // Jewish Holidays 2027
  { date: '2027-03-12', name: 'פורים', type: 'jewish', isDayOff: false },
  { date: '2027-04-21', name: 'ערב פסח', type: 'jewish', isDayOff: true },
  { date: '2027-04-22', name: 'פסח', type: 'jewish', isDayOff: true },
  { date: '2027-04-28', name: 'שביעי של פסח', type: 'jewish', isDayOff: true },
  { date: '2027-05-10', name: 'יום העצמאות', type: 'jewish', isDayOff: true },
  { date: '2027-06-10', name: 'ערב שבועות', type: 'jewish', isDayOff: true },
  { date: '2027-06-11', name: 'שבועות', type: 'jewish', isDayOff: true },
  { date: '2027-09-11', name: 'ערב ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2027-09-12', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2027-09-13', name: 'ראש השנה', type: 'jewish', isDayOff: true },
  { date: '2027-09-20', name: 'ערב יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2027-09-21', name: 'יום כיפור', type: 'jewish', isDayOff: true },
  { date: '2027-09-25', name: 'ערב סוכות', type: 'jewish', isDayOff: true },
  { date: '2027-09-26', name: 'סוכות', type: 'jewish', isDayOff: true },
  { date: '2027-10-02', name: 'שמחת תורה', type: 'jewish', isDayOff: true },
];

export const holidays: Holiday[] = holidaysData;

const holidaysMap = new Map<string, Holiday>(holidays.map(h => [h.date, h]));

export function getHolidayForDate(date: Date): Holiday | undefined {
    const dateString = format(date, 'yyyy-MM-dd');
    return holidaysMap.get(dateString);
}
