package com.courseregistration.dto;

import com.courseregistration.entity.SectionMeeting;
import jakarta.validation.constraints.*;
import java.time.LocalTime;
import java.util.List;

public record MeetingDto(@NotNull @Min(1) @Max(7) Integer dayOfWeek,
        @NotNull LocalTime startsAt, @NotNull LocalTime endsAt, String room,
        String weeksExpression, List<Integer> weeks, boolean valid, Integer sourceRow, String timeRaw) {
    public static MeetingDto from(SectionMeeting m){
        var weeks=m.getWeeks();
        return new MeetingDto(m.getDayOfWeek(),m.getStartsAt(),m.getEndsAt(),m.getRoom(),m.getWeeksExpression(),
                weeks==null?null:List.copyOf(weeks),m.hasValidTime()&&weeks!=null,m.getSourceRow(),m.getTimeRaw());
    }
    public SectionMeeting toEntity(){
        SectionMeeting meeting=new SectionMeeting(dayOfWeek,startsAt,endsAt,room==null?null:room.trim(),weeksExpression);
        if(!meeting.hasValidTime()||meeting.getWeeks()==null)throw new IllegalArgumentException("Buổi học cần thứ 1–7, giờ bắt đầu trước giờ kết thúc và tuần học dạng 2-9,11-18.");
        return meeting;
    }
}
