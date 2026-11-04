package com.courseregistration;

import com.courseregistration.entity.SectionMeeting;
import org.junit.jupiter.api.Test;
import java.time.LocalTime;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class SectionMeetingTest {
    private SectionMeeting meeting(int day,String start,String end,String weeks){return new SectionMeeting(day,LocalTime.parse(start),LocalTime.parse(end),"D9-102",weeks);}
    @Test void expandsWeekRangesWithoutIncludingTheExcludedWeek(){
        var weeks=SectionMeeting.parseWeeks("2-9,11-18");
        assertEquals(16,weeks.size());assertFalse(weeks.contains(10));assertTrue(weeks.containsAll(Set.of(2,9,11,18)));
    }
    @Test void disjointWeeksDoNotConflict(){assertFalse(meeting(1,"09:00","11:00","2,4,6").overlaps(meeting(1,"10:00","12:00","3,5,7")));}
    @Test void commonWeeksDoConflict(){assertTrue(meeting(1,"09:00","11:00","2-9").overlaps(meeting(1,"10:00","12:00","9-18")));}
    @Test void consecutiveMeetingsDoNotConflict(){assertFalse(meeting(1,"09:00","11:00",null).overlaps(meeting(1,"11:00","12:00",null)));}
    @Test void differentDaysDoNotConflict(){assertFalse(meeting(1,"09:00","11:00",null).overlaps(meeting(2,"10:00","12:00",null)));}
    @Test void unknownWeekNotationRemainsUnknownAndConservative(){
        assertNull(SectionMeeting.parseWeeks("11.13"));
        assertNull(SectionMeeting.parseWeeks("9-2"));
        assertTrue(meeting(1,"09:00","11:00","11.13").overlaps(meeting(1,"10:00","12:00","2-9")));
    }
    @Test void legacyScheduleSupportsSundayAndAdjacentWeekdays(){
        var sunday=SectionMeeting.legacy("Chủ nhật · 07:30 – 10:00","A1");
        assertTrue(sunday.hasValidTime());assertEquals(7,sunday.getDayOfWeek());
        assertEquals(1,SectionMeeting.legacy("Thứ 2 · 07:30 – 10:00","A1").getDayOfWeek());
        assertFalse(SectionMeeting.legacy("Thứ 2 · 13:15 – 11:45","A1").hasValidTime());
    }
}
