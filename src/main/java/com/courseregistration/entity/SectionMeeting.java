package com.courseregistration.entity;

import jakarta.persistence.*;
import java.time.LocalTime;
import java.util.*;
import java.util.regex.Pattern;

/** One class meeting. Empty weeks mean all weeks; unparseable weeks remain unknown. */
@Entity
@Table(name = "section_meetings", indexes = @Index(name = "idx_meeting_section", columnList = "section_id"))
public class SectionMeeting {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY) @JoinColumn(name = "section_id")
    private CourseSection section;
    private Integer dayOfWeek;
    private LocalTime startsAt;
    private LocalTime endsAt;
    @Column(length = 80) private String room;
    @Column(length = 500) private String weeksExpression;
    @Column(length = 40) private String timeRaw;
    private Integer sourceRow;
    private Integer startPeriod;
    private Integer periodCount;
    @Column(length=100) private String timeSourceStatus;

    protected SectionMeeting() {}
    public SectionMeeting(Integer dayOfWeek, LocalTime startsAt, LocalTime endsAt, String room, String weeksExpression) {
        this.dayOfWeek=dayOfWeek; this.startsAt=startsAt; this.endsAt=endsAt;
        this.room=room; this.weeksExpression=weeksExpression;
    }
    public Long getId(){return id;}
    public Integer getDayOfWeek(){return dayOfWeek;}
    public LocalTime getStartsAt(){return startsAt;}
    public LocalTime getEndsAt(){return endsAt;}
    public String getRoom(){return room;}
    public String getWeeksExpression(){return weeksExpression;}
    public String getTimeRaw(){return timeRaw;}
    public Integer getSourceRow(){return sourceRow;}
    public void setSection(CourseSection section){this.section=section;}
    public Set<Integer> getWeeks(){return parseWeeks(weeksExpression);}
    public static Set<Integer> parseWeeks(String expression) {
        if(expression==null||expression.isBlank())return Set.of();
        if(!expression.matches("\\d+(?:-\\d+)?(?:\\s*,\\s*\\d+(?:-\\d+)?)*"))return null;
        Set<Integer> weeks=new TreeSet<>();
        for(String token:expression.split(",")){
            String[] bounds=token.trim().split("-");
            int start,end;
            try{start=Integer.parseInt(bounds[0]);end=Integer.parseInt(bounds[bounds.length-1]);}
            catch(NumberFormatException error){return null;}
            if(start<1||end<start||end>100)return null;
            for(int week=start;week<=end;week++)weeks.add(week);
        }
        return weeks;
    }
    public boolean hasValidTime(){return dayOfWeek!=null&&dayOfWeek>=1&&dayOfWeek<=7&&startsAt!=null&&endsAt!=null&&startsAt.isBefore(endsAt);}
    public boolean overlaps(SectionMeeting other){
        if(!hasValidTime()||!other.hasValidTime()||!dayOfWeek.equals(other.dayOfWeek))return false;
        if(!startsAt.isBefore(other.endsAt)||!other.startsAt.isBefore(endsAt))return false;
        var first=getWeeks();var second=other.getWeeks();
        // Unknown or unrestricted weeks must never silently bypass a time collision.
        return first==null||second==null||first.isEmpty()||second.isEmpty()||!Collections.disjoint(first,second);
    }
    public String summary(){
        String day=dayOfWeek==null?"Chưa xếp lịch":dayOfWeek==7?"Chủ nhật":"Thứ "+(dayOfWeek+1);
        String time=hasValidTime()?startsAt+" – "+endsAt:startPeriod!=null&&periodCount!=null?"Tiết "+startPeriod+"–"+(startPeriod+periodCount-1)+" (chưa có giờ quy đổi)":timeRaw==null?"Chưa có giờ học":timeRaw+" (cần kiểm tra)";
        return day+" · "+time+(timeSourceStatus==null?"":" · "+timeSourceStatus)+(weeksExpression==null||weeksExpression.isBlank()?"":" · Tuần "+weeksExpression);
    }
    public static SectionMeeting legacy(String schedule,String room){
        var matcher=Pattern.compile("^(Thứ [2-7]|Chủ nhật)\\s*·\\s*(\\d{2}:\\d{2})\\s*[–-]\\s*(\\d{2}:\\d{2})$").matcher(schedule==null?"":schedule.trim());
        if(!matcher.matches())return new SectionMeeting(null,null,null,room,null);
        try{return new SectionMeeting(matcher.group(1).equals("Chủ nhật")?7:Integer.parseInt(matcher.group(1).substring(4))-1,
                LocalTime.parse(matcher.group(2)),LocalTime.parse(matcher.group(3)),room,null);}
        catch(java.time.format.DateTimeParseException error){return new SectionMeeting(null,null,null,room,null);}
    }
}
