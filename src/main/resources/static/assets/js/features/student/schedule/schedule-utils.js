export const WEEKDAYS = [
  { day: 1, label: 'Thứ 2', short: 'T2' },
  { day: 2, label: 'Thứ 3', short: 'T3' },
  { day: 3, label: 'Thứ 4', short: 'T4' },
  { day: 4, label: 'Thứ 5', short: 'T5' },
  { day: 5, label: 'Thứ 6', short: 'T6' },
  { day: 6, label: 'Thứ 7', short: 'T7' },
  { day: 7, label: 'Chủ nhật', short: 'CN' }
];

const COLOR_MAP = {
  lavender: 'ev-blue',
  mint: 'ev-emerald',
  peach: 'ev-amber',
  sky: 'ev-sky',
  rose: 'ev-rose',
  lemon: 'ev-teal'
};

const PALETTE = ['ev-blue', 'ev-emerald', 'ev-violet', 'ev-amber', 'ev-sky', 'ev-rose', 'ev-teal', 'ev-indigo'];

const COLOR_SWATCH = {
  'ev-blue': '#2563EB',
  'ev-emerald': '#059669',
  'ev-violet': '#7C3AED',
  'ev-amber': '#D97706',
  'ev-sky': '#0284C7',
  'ev-rose': '#E11D48',
  'ev-teal': '#0D9488',
  'ev-indigo': '#4F46E5'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

export function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function monogram(name) {
  const parts = String(name || 'SV').trim().split(/\s+/).filter(Boolean);
  return parts.slice(-2).map(p => p[0]).join('').toUpperCase() || 'SV';
}

export function getCourseColorClass(course) {
  if (course.color && COLOR_MAP[course.color]) return COLOR_MAP[course.color];
  const key = String(course.code || course.id || '');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getColorSwatch(colorClass) {
  return COLOR_SWATCH[colorClass] || '#2563EB';
}

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatMinutes(mins) {
  if (mins == null) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function estimatePeriods(startMinutes, endMinutes) {
  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return 0;
  return Math.max(1, Math.round((endMinutes - startMinutes) / 54));
}

export function getSessionBucket(startMinutes) {
  if (startMinutes == null) return '';
  if (startMinutes < 12 * 60) return 'morning';
  if (startMinutes < 17 * 60 + 30) return 'afternoon';
  return 'evening';
}

export function getMondayOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function getIsoWeekday(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

export function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatFullDate(date) {
  return `${formatShortDate(date)}/${date.getFullYear()}`;
}

export function getAcademicWeekNumber(weekMonday, semester) {
  if (!semester?.startsAt) return null;
  const start = new Date(`${semester.startsAt}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const semMonday = getMondayOfWeek(start);
  const diffDays = Math.round((weekMonday - semMonday) / (24 * 60 * 60 * 1000));
  const weekNum = Math.floor(diffDays / 7) + 1;
  if (semester.endsAt) {
    const end = new Date(`${semester.endsAt}T00:00:00`);
    const maxWeeks = Math.max(1, Math.ceil((end - semMonday) / (7 * 24 * 60 * 60 * 1000)) + 1);
    if (weekNum < 1 || weekNum > maxWeeks) return null;
  } else if (weekNum < 1 || weekNum > 24) {
    return null;
  }
  return weekNum;
}

function parseLegacySchedule(scheduleText) {
  if (!scheduleText) return null;
  const dayMatch = WEEKDAYS.find(w => scheduleText.startsWith(w.label));
  const timeMatch = scheduleText.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!dayMatch || !timeMatch) return null;
  return {
    dayOfWeek: dayMatch.day,
    startsAt: timeMatch[1],
    endsAt: timeMatch[2]
  };
}

/**
 * Normalize API courses into structured calendar events + unscheduled list.
 */
export function normalizeScheduleEvents(courses = []) {
  const events = [];
  const unscheduled = [];

  courses.forEach(course => {
    const colorClass = getCourseColorClass(course);
    const meetings = Array.isArray(course.meetings) ? course.meetings : [];

    if (meetings.length > 0) {
      meetings.forEach((meeting, index) => {
        const startMinutes = parseTimeToMinutes(meeting.startsAt);
        const endMinutes = parseTimeToMinutes(meeting.endsAt);
        const dayOfWeek = Number(meeting.dayOfWeek);

        if (!dayOfWeek || dayOfWeek < 1 || dayOfWeek > 7 || startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
          unscheduled.push({ course, reason: 'Chưa có khung giờ hợp lệ' });
          return;
        }

        events.push({
          uid: `${course.id}::${index}`,
          courseId: course.id,
          sectionCode: course.sectionCode || course.id,
          code: course.code || '—',
          name: course.name || 'Học phần chưa đặt tên',
          department: course.department || '',
          credits: Number(course.credits) || 0,
          instructor: course.instructor || 'Chưa phân công',
          lecturerCode: course.lecturerCode || '',
          room: meeting.room || course.room || 'Chưa xếp phòng',
          dayOfWeek,
          startMinutes,
          endMinutes,
          startLabel: formatMinutes(startMinutes),
          endLabel: formatMinutes(endMinutes),
          periods: estimatePeriods(startMinutes, endMinutes),
          weeksExpression: meeting.weeksExpression || '',
          weeks: Array.isArray(meeting.weeks) ? meeting.weeks : null,
          colorClass,
          isConflict: false,
          course
        });
      });
    } else {
      const parsed = parseLegacySchedule(course.schedule);
      if (parsed) {
        const startMinutes = parseTimeToMinutes(parsed.startsAt);
        const endMinutes = parseTimeToMinutes(parsed.endsAt);
        events.push({
          uid: `${course.id}::legacy`,
          courseId: course.id,
          sectionCode: course.sectionCode || course.id,
          code: course.code || '—',
          name: course.name || 'Học phần chưa đặt tên',
          department: course.department || '',
          credits: Number(course.credits) || 0,
          instructor: course.instructor || 'Chưa phân công',
          lecturerCode: course.lecturerCode || '',
          room: course.room || 'Chưa xếp phòng',
          dayOfWeek: parsed.dayOfWeek,
          startMinutes,
          endMinutes,
          startLabel: formatMinutes(startMinutes),
          endLabel: formatMinutes(endMinutes),
          periods: estimatePeriods(startMinutes, endMinutes),
          weeksExpression: '',
          weeks: null,
          colorClass,
          isConflict: false,
          course
        });
      } else {
        unscheduled.push({ course, reason: course.schedule || 'Chưa xếp lịch học' });
      }
    }
  });

  events.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinutes - b.startMinutes || a.code.localeCompare(b.code));
  return { events, unscheduled };
}

function weeksOverlap(weeksA, weeksB) {
  if (!weeksA?.length || !weeksB?.length) return true;
  const setB = new Set(weeksB);
  return weeksA.some(w => setB.has(w));
}

export function detectConflicts(events) {
  const conflicts = [];
  events.forEach(ev => { ev.isConflict = false; });

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.courseId === b.courseId) continue;
      const timeOverlaps = a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
      if (!timeOverlaps) continue;
      if (!weeksOverlap(a.weeks, b.weeks)) continue;

      a.isConflict = true;
      b.isConflict = true;
      const dayLabel = WEEKDAYS[a.dayOfWeek - 1]?.label || `Thứ ${a.dayOfWeek + 1}`;
      conflicts.push({
        dayOfWeek: a.dayOfWeek,
        dayLabel,
        first: a,
        second: b
      });
    }
  }
  return conflicts;
}

/**
 * Interval-packing algorithm for overlapping events within a single day column.
 * Returns array of { ...event, colIndex, colCount }.
 */
export function layoutOverlappingEvents(dayEvents) {
  if (!dayEvents.length) return [];
  const sorted = [...dayEvents].sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const clusters = [];
  let currentCluster = [];
  let clusterMaxEnd = -1;

  for (const ev of sorted) {
    if (currentCluster.length === 0 || ev.startMinutes < clusterMaxEnd) {
      currentCluster.push(ev);
      clusterMaxEnd = Math.max(clusterMaxEnd, ev.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterMaxEnd = ev.endMinutes;
    }
  }
  if (currentCluster.length) clusters.push(currentCluster);

  const positioned = [];
  for (const cluster of clusters) {
    const colEnds = [];
    const assignments = [];

    for (const ev of cluster) {
      let placedCol = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.startMinutes) {
          placedCol = c;
          colEnds[c] = ev.endMinutes;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEnds.length;
        colEnds.push(ev.endMinutes);
      }
      assignments.push({ event: ev, colIndex: placedCol });
    }

    const colCount = Math.max(1, colEnds.length);
    for (const item of assignments) {
      positioned.push({
        ...item.event,
        colIndex: item.colIndex,
        colCount
      });
    }
  }
  return positioned;
}

export function computeStatistics(courses = [], events = []) {
  const totalCourses = courses.length;
  const totalCredits = courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const studyDaysSet = new Set(events.map(e => e.dayOfWeek));
  const totalPeriods = events.reduce((sum, e) => sum + (Number(e.periods) || 0), 0);
  const totalHours = events.reduce((sum, e) => sum + Math.max(0, e.endMinutes - e.startMinutes), 0) / 60;

  return {
    totalCourses,
    totalCredits,
    studyDays: studyDaysSet.size,
    studyDayNames: [...studyDaysSet].sort((a, b) => a - b).map(d => WEEKDAYS[d - 1]?.short).filter(Boolean),
    totalPeriods,
    totalHours: Math.round(totalHours * 10) / 10
  };
}

export function isEventActiveInWeek(event, academicWeek) {
  if (!academicWeek || !event.weeks?.length) return true;
  return event.weeks.includes(academicWeek);
}

export function findUpcomingClass(events, now = new Date()) {
  if (!events.length) return null;
  const todayDow = getIsoWeekday(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 1. Currently in progress
  const live = events.find(ev => ev.dayOfWeek === todayDow && ev.startMinutes <= nowMinutes && nowMinutes < ev.endMinutes);
  if (live) {
    return { status: 'live', event: live, minutesLeft: live.endMinutes - nowMinutes };
  }

  // 2. Next class later today or in upcoming days (wrapping Mon-Sun)
  let best = null;
  let bestDelta = Infinity;
  for (const ev of events) {
    let dayDiff = ev.dayOfWeek - todayDow;
    if (dayDiff < 0 || (dayDiff === 0 && ev.startMinutes <= nowMinutes)) {
      dayDiff += 7;
    }
    const deltaMinutes = dayDiff * 24 * 60 + (ev.startMinutes - nowMinutes);
    if (deltaMinutes > 0 && deltaMinutes < bestDelta) {
      bestDelta = deltaMinutes;
      best = { status: 'upcoming', event: ev, dayDiff, minutesUntil: deltaMinutes };
    }
  }
  return best;
}

export function formatCountdown(minutes) {
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `còn ${hours} giờ ${mins} phút` : `còn ${hours} giờ`;
  const days = Math.floor(hours / 24);
  return `sau ${days} ngày`;
}
