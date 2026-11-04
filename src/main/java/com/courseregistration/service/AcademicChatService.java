package com.courseregistration.service;

import com.courseregistration.dto.*;
import com.courseregistration.entity.*;
import com.courseregistration.repository.*;
import com.courseregistration.service.policy.CourseConditionEvaluator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Read-only academic answers grounded in the signed-in student's records. */
@Service
public class AcademicChatService {
    public record Answer(String reply, List<String> sources, List<String> suggestions) {}

    private final AuthService auth;
    private final CourseService courses;
    private final EnrollmentService enrollment;
    private final CourseRepository catalog;
    private final CourseSectionRepository sections;
    private final EnrollmentRepository registrations;
    private final SemesterRepository semesters;
    private final RegistrationPeriodRepository registrationPeriods;
    private final CurriculumRepository curricula;
    private final CurriculumCourseRepository curriculumCourses;
    private final AcademicResultRepository academicResults;
    private final CourseConditionEvaluator conditionEvaluator;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final List<String> PROMPTS = List.of(
            "Gợi ý môn học phù hợp",
            "Tôi còn thiếu môn nào?",
            "Xem kết quả học tập",
            "Khi nào hết hạn đăng ký?"
    );

    public AcademicChatService(AuthService auth,
                               CourseService courses,
                               EnrollmentService enrollment,
                               CourseRepository catalog,
                               CourseSectionRepository sections,
                               EnrollmentRepository registrations,
                               SemesterRepository semesters,
                               RegistrationPeriodRepository registrationPeriods,
                               CurriculumRepository curricula,
                               CurriculumCourseRepository curriculumCourses,
                               AcademicResultRepository academicResults,
                               CourseConditionEvaluator conditionEvaluator) {
        this.auth = auth;
        this.courses = courses;
        this.enrollment = enrollment;
        this.catalog = catalog;
        this.sections = sections;
        this.registrations = registrations;
        this.semesters = semesters;
        this.registrationPeriods = registrationPeriods;
        this.curricula = curricula;
        this.curriculumCourses = curriculumCourses;
        this.academicResults = academicResults;
        this.conditionEvaluator = conditionEvaluator;
    }

    @Transactional(readOnly = true)
    public Answer answer(ChatRequest request) {
        var student = auth.currentStudent();
        String text = normalize(request.message());
        if (contains(text, "sinh vien khac", "nguoi khac", "danh sach sinh vien", "so dien thoai", "email cua", "mat khau", "api key", "cau lenh sql", "bo qua huong dan"))
            return result("Mình chỉ tra cứu học vụ của tài khoản đang đăng nhập. Mình không cung cấp hồ sơ người khác, mật khẩu hoặc thực hiện lệnh thay đổi dữ liệu.", "Phạm vi trợ lý EduPortal");
        var ids = Pattern.compile("\\b\\d{2}[a-z]{2}\\d{3}\\b").matcher(text);
        while (ids.find()) if (!ids.group().equals(normalize(student.getStudentCode())))
            return result("Mình chỉ tra cứu dữ liệu học vụ của bạn, không cung cấp thông tin sinh viên khác.", "Phiên đăng nhập hiện tại");
        var term = courses.currentSemester();
        for (var candidate : semesters.findAllByOrderByStartsAtDesc())
            if (Pattern.compile("(?<![a-z0-9])" + Pattern.quote(normalize(candidate.getCode())) + "(?![a-z0-9])").matcher(text).find()) { term = candidate; break; }
        final Semester selectedTerm = term;
        var records = registrations.findAllByStudentOrderByEnrolledAtDesc(student).stream()
                .filter(r -> r.getSection().getSemester().getCode().equals(selectedTerm.getCode())).toList();
        var active = records.stream().filter(r -> r.getStatus() == Enrollment.Status.ENROLLED).map(Enrollment::getSection).toList();
        int credits = active.stream().mapToInt(s -> s.getCourse().getCredits()).sum();
        if (contains(text, "goi y", "mon nao nen", "nen hoc mon", "xep lich", "ke hoach hoc", "mon phu hop"))
            return recommend(student, term, active, records, credits);
        var allCourses = catalog.findAll();
        Course course = findCourse(text, allCourses);
        if (course == null && contains(text, "mon do", "mon nay", "lop do", "lop nay", "con mon", "dieu kien cua mon") && request.history() != null) {
            for (int i = request.history().size() - 1; i >= 0; i--) {
                var previous = request.history().get(i);
                if (previous != null && "user".equals(previous.role())) {
                    course = findCourse(normalize(previous.content()), allCourses);
                    if (course != null) break;
                }
            }
        }
        if (course != null) return courseAnswer(course, student, term, active, credits, text);
        if (contains(text, "han dang ky", "mo dang ky", "dong dang ky", "dot dang ky", "thoi diem dang ky", "bao gio dang ky", "khi nao dang ky", "khong dang ky duoc", "khong the dang ky"))
            return registrationWindow(term);
        if (contains(text, "huy", "rut mon", "rut hoc phan")) return dropPolicy(term);
        if (contains(text, "tien quyet", "hoc truoc", "song hanh", "dieu kien"))
            return result("Điều kiện được lưu trong hệ thống:\n• Tiên quyết: phải có kết quả Đạt.\n• Học trước: đã có kết quả học tập ở học kỳ trước, không bắt buộc đạt.\n• Song hành: đã đạt hoặc đang đăng ký môn đi kèm trong cùng học kỳ.\nNhập mã môn (ví dụ INF202) để mình đối chiếu hồ sơ của bạn. Hệ thống kiểm tra tự động đồng bộ cả 3 loại điều kiện (Tiên quyết, Học trước, Song hành) khi đăng ký lớp, xét duyệt danh sách chờ, hủy môn song hành và tư vấn học vụ.", "Điều kiện học phần trong database", "Kết quả học tập của bạn");
        if (contains(text, "lich su", "cho xac nhan", "da huy")) {
            String rows = records.stream().limit(20)
                    .map(r -> r.getSection().getCourse().getCode() + " · " + r.getSection().getSectionCode() + " — " + switch (r.getStatus()) {
                        case ENROLLED -> "Đã đăng ký";
                        case PENDING -> "Chờ xác nhận";
                        case CANCELLED -> "Đã hủy";
                    }).collect(Collectors.joining("\n• "));
            return result("Lịch sử đăng ký " + term.getCode() + ":\n" + (rows.isEmpty() ? "Chưa có bản ghi." : "• " + rows)
                    + (records.size() > 20 ? "\nCòn " + (records.size() - 20) + " bản ghi; xem đầy đủ tại Lịch sử đăng ký." : "")
                    + "\nChờ xác nhận khác với danh sách chờ lớp đầy, chưa được tính vào lịch học và tín chỉ đang đăng ký.", "Lịch sử đăng ký của bạn");
        }
        if (contains(text, "lich hoc", "thoi khoa bieu", "lich cua toi", "hoc thu", "hoc ngay", "hom nay", "ngay mai"))
            return schedule(term, active, text);
        if (contains(text, "diem", "ket qua", "da dat", "da hoan thanh", "da hoc", "chua dat", "rot", "truot", "hoc lai"))
            return grades(student, text);
        if (contains(text, "chuong trinh", "khung", "mon con thieu", "con thieu mon", "chua hoc", "mon con lai", "lo trinh"))
            return curriculum(student, active);
        if (contains(text, "tin chi", "bao nhieu mon", "da dang ky", "bao nhieu hoc phan"))
            return result("Học kỳ " + term.getCode() + ", bạn có " + active.size() + " học phần đang hiệu lực, tổng " + credits + "/" + enrollment.maxCredits() + " tín chỉ.\n"
                    + "Giới hạn " + enrollment.maxCredits() + " tín chỉ là cấu hình thử nghiệm của project, chưa phải quy định chính thức của trường.", "Đăng ký của bạn", "Cấu hình giới hạn tín chỉ");
        if (contains(text, "du cho", "het cho", "lop day", "danh sach cho"))
            return result("Khi lớp đủ chỗ, thao tác Đăng ký lớp sẽ đưa bạn vào danh sách chờ nếu đợt đăng ký đang mở và bạn đủ điều kiện. Khi có chỗ, hệ thống kiểm tra lại tín chỉ, đầy đủ 3 điều kiện học phần (tiên quyết, học trước, song hành) và trùng lịch trước khi chuyển người đủ điều kiện vào lớp. Trạng thái Chờ xác nhận trong dữ liệu mẫu không phải danh sách chờ này.", "Quy trình danh sách chờ của project");
        if (contains(text, "hoc ky", "tuan hoc")) {
            String dates = term.getStartsAt() == null
                    ? "Chưa có ngày học chính thức."
                    : "Bắt đầu " + DATE.format(term.getStartsAt()) + ", kết thúc "
                            + (term.getEndsAt() == null ? "chưa xác định" : DATE.format(term.getEndsAt())) + ".";
            if (term.getWeekOneStartsAt() != null) {
                dates += " Tuần 1 bắt đầu " + DATE.format(term.getWeekOneStartsAt())
                        + "; tổng " + term.getTeachingWeeks() + " tuần giảng dạy.";
                var currentWeek = term.teachingWeekOf(LocalDate.now());
                if (currentWeek.isPresent()) {
                    dates += " Hôm nay là tuần " + currentWeek.getAsInt() + ".";
                }
            }
            return result(term.getName() + " (" + term.getCode() + "). " + dates, "Lịch học kỳ trong database");
        }
        if (contains(text, "toi la ai", "ho so", "nganh cua toi", "khoa cua toi"))
            return result("Bạn là " + student.getFullName() + ", mã sinh viên " + student.getStudentCode() + ", ngành " + student.getProgram() + ", khóa " + Objects.toString(student.getCohort(), "chưa khai báo") + ".", "Hồ sơ tài khoản đang đăng nhập");
        if (contains(text, "hoc phi", "le phi", "hoc bong", "tot nghiep", "quy che", "quy dinh", "lien he", "hotline", "phong dao tao", "de cuong"))
            return result("Project chưa có tài liệu học vụ chính thức, mức học phí, điều kiện học bổng/tốt nghiệp hoặc địa chỉ liên hệ đã xác nhận. Mình không thể suy ra các thông tin đó từ thời khóa biểu. Bạn hãy liên hệ Ban Đào tạo qua kênh chính thức của trường. Mình có thể giải thích dữ liệu môn học và các cấu hình thử nghiệm hiện có.", "Phạm vi dữ liệu hiện có");
        if (contains(text, "dang ky giup", "dang ky ho", "tu dang ky", "them mon", "dang ky"))
            return result("Mình chỉ tra cứu và gợi ý, không tự đăng ký thay bạn. Bạn có thể mở Đăng ký học phần, tìm lớp, xem Chi tiết rồi tự xác nhận thao tác. " + registrationWindow(term).reply(), "Quy trình đăng ký của project");
        if (text.equals("hi") || text.equals("hello") || text.startsWith("chao") || contains(text, "ban la ai", "giup", "huong dan", "lam duoc gi"))
            return result("Chào bạn! Mình là trợ lý EduPortal. Mình có thể tra cứu lịch học, tín chỉ, điểm, lịch sử đăng ký, chương trình đào tạo; giải thích điều kiện và gợi ý môn phù hợp. Bạn thử hỏi “Gợi ý môn học phù hợp” hoặc “Tôi còn thiếu môn nào?”.", "Chức năng trợ lý EduPortal");
        return result("Mình chưa xác định được thông tin bạn muốn tra cứu. Bạn có thể nhập mã môn, hỏi về lịch học, điểm, môn còn thiếu, điều kiện hoặc thời hạn đăng ký. Thông tin không có trong database sẽ được báo rõ.", "Phạm vi trợ lý EduPortal");
    }

    private Answer courseAnswer(Course course, Student student, Semester term, List<CourseSection> active, int credits, String text) {
        var classes = sections.findAllBySemester_CodeOrderBySectionCode(term.getCode()).stream()
                .filter(s -> s.getCourse().getCode().equals(course.getCode())).toList();
        var counts = counts();
        var rules = rules();
        var studied = studied(student, term);
        List<String> problems = problems(course, student, active, rules, studied);
        String detail = course.getCode() + " — " + course.getName() + ", " + course.getCredits() + " tín chỉ.\n";
        if (!course.isActive()) detail += "Môn đang ngừng sử dụng.\n";
        detail += "Điều kiện: " + course.getPrerequisite() + ".\n";
        if (contains(text, "hoc phi", "le phi")) detail += "Chưa có mức học phí chính thức của môn này trong database.\n";
        if (unknownConditions(course, rules)) detail += "Chưa đủ dữ liệu điều kiện để kết luận bạn đủ điều kiện đăng ký.\n";
        else detail += problems.isEmpty() ? "Bạn đáp ứng các điều kiện học phần đã được khai báo.\n" : "Chưa đáp ứng: " + String.join("; ", problems) + ".\n";
        if (student.getCompletedCourseCodes().contains(course.getCode()))
            detail += "Bạn đã có kết quả Đạt môn này. Chưa có quy chế học cải thiện chính thức để tư vấn đăng ký lại.\n";
        if (classes.isEmpty()) detail += "Không có lớp của môn này trong học kỳ " + term.getCode() + ".\n";
        for (var section : classes.stream().limit(5).toList()) {
            int occupied = section.totalEnrolled(counts.getOrDefault(section.getId(), 0L));
            detail += "• " + section.getSectionCode() + ": " + section.getSchedule() + "; phòng " + section.getRoom() + "; giảng viên " + section.getLecturerName() + "; sĩ số " + occupied + "/" + section.getCapacity() + "; trạng thái " + section.getStatus() + ".\n";
            if (section.isScheduleReviewRequired()) detail += "  Lịch hoặc sĩ số cần Ban Đào tạo xác nhận.\n";
            if (section.getLinkedSectionCode() != null && !section.getLinkedSectionCode().equals(section.getSectionCode()))
                detail += "  Lớp kèm theo nguồn: " + section.getLinkedSectionCode() + "; cần xác nhận quy tắc đăng ký cùng lớp.\n";
            if (conflicts(section, active)) detail += "  Trùng lịch với ít nhất một lớp bạn đang học (xét mọi buổi và tuần).\n";
            if (credits + course.getCredits() > enrollment.maxCredits())
                detail += "  Đăng ký thêm sẽ vượt giới hạn " + enrollment.maxCredits() + " tín chỉ.\n";
        }
        if (classes.size() > 5) detail += "Còn " + (classes.size() - 5) + " lớp khác; xem bộ lọc học phần để chọn lớp.\n";
        if (contains(text, "diem", "ket qua")) {
            var grades = gradeRows(student).stream().filter(r -> course.getCode().equals(r.getCourse().getCode())).toList();
            detail += grades.isEmpty()
                    ? "Chưa có kết quả học tập của bạn cho môn này.\n"
                    : grades.stream().map(AcademicResult::formatTranscriptLine).collect(Collectors.joining("\n")) + "\n";
        }
        detail += courses.registrationOpen(term)
                ? "Đợt đăng ký đang mở. Bạn cần tự xác nhận đăng ký trên giao diện."
                : "Đợt đăng ký học kỳ này đang đóng; thông tin trên dùng để tra cứu và chuẩn bị kế hoạch.";
        return result(detail, "Danh mục học phần và lớp học kỳ " + term.getCode(), "Điều kiện và kết quả học tập của bạn", "Lịch đăng ký trong database");
    }

    private Answer recommend(Student student, Semester term, List<CourseSection> active, List<Enrollment> records, int credits) {
        if (credits >= enrollment.maxCredits())
            return result("Bạn đã có " + credits + " tín chỉ, đạt hoặc vượt giới hạn thử nghiệm " + enrollment.maxCredits() + ". Mình không đề xuất đăng ký thêm.", "Đăng ký và cấu hình tín chỉ");
        var curriculum = curriculumRows(student);
        var rules = rules();
        var studied = studied(student, term);
        var counts = counts();
        Set<String> inProgram = curriculum.stream().map(cc -> cc.getCourse().getCode()).collect(Collectors.toSet());
        Set<String> existing = records.stream().filter(r -> r.getStatus() != Enrollment.Status.CANCELLED).map(r -> r.getSection().getCourse().getCode()).collect(Collectors.toSet());
        List<CourseSection> planned = new ArrayList<>(active), chosen = new ArrayList<>();
        List<CourseSection> options = new ArrayList<>(sections.findAllBySemester_CodeOrderBySectionCode(term.getCode()));
        Map<String, Integer> rank = new HashMap<>();
        for (int i = 0; i < curriculum.size(); i++) rank.put(curriculum.get(i).getCourse().getCode(), i);
        options.sort(Comparator.comparingInt((CourseSection s) -> rank.getOrDefault(s.getCourse().getCode(), Integer.MAX_VALUE)).thenComparing(CourseSection::getSectionCode));
        int total = credits;
        for (var s : options) {
            var c = s.getCourse();
            if (!inProgram.isEmpty() && !inProgram.contains(c.getCode()) || s.getStatus() != CourseSection.Status.OPEN || !c.isActive() || s.isScheduleReviewRequired() || existing.contains(c.getCode()) || student.getCompletedCourseCodes().contains(c.getCode()))
                continue;
            if (s.getLinkedSectionCode() != null && !s.getLinkedSectionCode().equals(s.getSectionCode())) continue;
            if (unknownConditions(c, rules) || !problems(c, student, active, rules, studied).isEmpty() || total + c.getCredits() > enrollment.maxCredits() || s.totalEnrolled(counts.getOrDefault(s.getId(), 0L)) >= s.getCapacity())
                continue;
            if (s.getEffectiveMeetings().stream().anyMatch(m -> !m.hasValidTime() || m.getWeeks() == null) || conflicts(s, planned))
                continue;
            chosen.add(s); planned.add(s); existing.add(c.getCode()); total += c.getCredits();
            if (chosen.size() == 3) break;
        }
        String prefix = courses.registrationOpen(term) ? "Đợt đăng ký đang mở. " : "Đợt đăng ký đang đóng; đây là kế hoạch tham khảo, hiện chưa thể đăng ký. ";
        if (chosen.isEmpty())
            return result(prefix + "Chưa tìm được lớp đồng thời đáp ứng điều kiện đã biết, chỗ trống, lịch, tín chỉ và các môn còn thiếu. Mình không bỏ qua điều kiện để tạo gợi ý.", "Chương trình theo ngành/khóa", "Kết quả và đăng ký của bạn", "Lịch, tuần học, chỗ trống");
        String rows = chosen.stream()
                .map(s -> s.getCourse().getCode() + " — " + s.getCourse().getName() + " (" + s.getCourse().getCredits() + " tín chỉ), lớp " + s.getSectionCode() + ": " + s.getSchedule() + "; phòng " + s.getRoom())
                .collect(Collectors.joining("\n• "));
        return result(prefix + (inProgram.isEmpty() ? "Chưa có khung chương trình cho ngành/khóa của bạn; các lớp sau chỉ là lựa chọn để khám phá, không thay thế lộ trình học." : "Ưu tiên môn trong chương trình ngành/khóa của bạn chưa hoàn thành.")
                + "\n• " + rows + "\nNếu chọn toàn bộ các lớp này: " + total + "/" + enrollment.maxCredits() + " tín chỉ, không trùng lịch với nhau hoặc lớp đang học theo dữ liệu đã biết. Giờ có nhãn Mẫu vẫn cần nhà trường xác nhận. Mình không tự đăng ký thay bạn.",
                "Khung chương trình và kết quả của bạn", "Từng buổi, tuần học, sĩ số lớp", "Giới hạn tín chỉ thử nghiệm");
    }

    private Answer registrationWindow(Semester term) {
        String lead = term.getName() + " (" + term.getCode() + "): " + (courses.registrationOpen(term) ? "đang mở đăng ký." : "đang đóng đăng ký.");
        var period = registrationPeriods.findBySemester_Code(term.getCode());
        if (term.isRegistrationAlwaysOpen()) {
            lead += " Đang dùng chế độ mở liên tục tạm thời, chưa có hạn đóng chính thức.";
        } else if (period.isPresent()) {
            var p = period.get();
            lead += " Thời gian đợt đã khai báo: " + formatDateTime(p.getStartsAt()) + " đến " + formatDateTime(p.getEndsAt()) + "; trạng thái cấu hình " + p.getStatus() + ".";
        } else {
            lead += " Ngày mở: " + formatDate(term.getRegistrationOpenAt()) + "; ngày đóng: " + formatDate(term.getRegistrationCloseAt()) + ".";
        }
        return result(lead, "Học kỳ và đợt đăng ký trong database");
    }

    private Answer schedule(Semester term, List<CourseSection> active, String text) {
        Integer day = null, week = null;
        var dayMatch = Pattern.compile("\\bthu\\s*([2-7])\\b").matcher(text);
        if (dayMatch.find()) day = Integer.parseInt(dayMatch.group(1)) - 1;
        if (text.contains("chu nhat")) day = 7;
        var weekMatch = Pattern.compile("\\btuan\\s*(\\d{1,2})\\b").matcher(text);
        if (weekMatch.find()) week = Integer.parseInt(weekMatch.group(1));
        String label = term.getCode();
        if (contains(text, "hom nay", "ngay mai")) {
            LocalDate date = LocalDate.now().plusDays(text.contains("ngay mai") ? 1 : 0);
            if (term.getWeekOneStartsAt() == null)
                return result("Chưa có ngày bắt đầu tuần 1 của học kỳ " + term.getCode() + ", nên chưa thể kết luận lịch ngày " + formatDate(date) + ". Bạn có thể hỏi lịch theo thứ và tuần, ví dụ “Lịch học thứ 3 tuần 8”.", "Lịch học kỳ chưa đầy đủ");
            var resolvedWeek = term.teachingWeekOf(date);
            if (resolvedWeek.isEmpty())
                return result("Ngày " + formatDate(date) + " nằm ngoài số tuần giảng dạy đã khai báo của học kỳ " + term.getCode() + ". Chưa có dữ liệu lịch thi/nghỉ bù để kết luận thêm.", "Ngày tuần 1 và số tuần của học kỳ");
            day = date.getDayOfWeek().getValue();
            week = resolvedWeek.getAsInt();
            label += " · " + formatDate(date);
        }
        if (day != null) label += " · " + (day == 7 ? "Chủ nhật" : "Thứ " + (day + 1));
        if (week != null) label += " · Tuần " + week;
        List<String> rows = new ArrayList<>();
        int uncertain = 0;
        for (var section : active) for (var meeting : section.getEffectiveMeetings()) {
            if (meeting.getDayOfWeek() == null || !meeting.hasValidTime() || meeting.getWeeks() == null) { uncertain++; continue; }
            if (day != null && !day.equals(meeting.getDayOfWeek())) continue;
            if (week != null && !meeting.getWeeks().isEmpty() && !meeting.getWeeks().contains(week)) continue;
            rows.add(section.getCourse().getCode() + " · " + section.getSectionCode() + ": " + meeting.summary() + "; phòng " + Objects.toString(meeting.getRoom(), "chưa có phòng"));
        }
        return result("Thời khóa biểu " + label + ":\n" + (rows.isEmpty() ? "Không có buổi học đã xác định phù hợp với bộ lọc này." : "• " + String.join("\n• ", rows))
                + (uncertain > 0 ? "\nCó " + uncertain + " buổi chưa đủ lịch/tuần rõ nghĩa, cần Ban Đào tạo xác nhận." : ""),
                "Đăng ký đang hiệu lực của bạn", "Từng buổi, tuần học và ngày bắt đầu tuần 1");
    }

    private Answer dropPolicy(Semester term) {
        String rule = "Cấu hình thử nghiệm cho phép tự hủy trong " + enrollment.dropWindowDays() + " ngày đầu học kỳ; đây chưa phải quy định chính thức của trường. ";
        if (term.getStartsAt() != null) {
            LocalDate deadline = term.getStartsAt().plusDays(enrollment.dropWindowDays());
            rule += "Ngày bắt đầu " + formatDate(term.getStartsAt()) + "; phải hủy trước ngày " + formatDate(deadline) + " (từ ngày này hệ thống từ chối tự hủy). "
                    + (LocalDate.now().isBefore(deadline) ? "Bạn có thể tự thao tác Hủy lớp." : "Hiện đã quá hạn; hãy liên hệ Ban Đào tạo.");
        } else {
            rule += term.isRegistrationAlwaysOpen()
                    ? "Học kỳ chưa có ngày bắt đầu và đang mở liên tục tạm thời, hệ thống hiện cho phép tự hủy."
                    : "Chưa có ngày bắt đầu để xác định hạn, hãy liên hệ Ban Đào tạo.";
        }
        return result(rule + " Mình không tự hủy lớp thay bạn.", "Cấu hình hạn tự hủy", "Ngày bắt đầu học kỳ");
    }

    private Answer grades(Student student, String text) {
        var rows = gradeRows(student);
        boolean failed = contains(text, "chua dat", "rot", "truot", "hoc lai");
        if (rows.isEmpty())
            return result("Chưa có bảng kết quả học tập chi tiết của bạn trong database. Các môn đã hoàn thành được khai báo: " + String.join(", ", student.getCompletedCourseCodes()) + ". Không đủ dữ liệu để tự tính GPA.", "Kết quả học tập của bạn");
        var shown = rows.stream().filter(r -> !failed || r.isFailed()).limit(15).toList();
        String answer = failed ? "Các lần học có kết quả Chưa đạt (môn đã học lại đạt sẽ được ghi chú):" : "Kết quả học tập gần đây của bạn:";
        answer += shown.isEmpty()
                ? "\nKhông có kết quả Chưa đạt."
                : "\n" + shown.stream()
                        .map(r -> r.formatTranscriptLine() + (failed && student.getCompletedCourseCodes().contains(r.getCourse().getCode()) ? " — đã có lần khác Đạt" : ""))
                        .collect(Collectors.joining("\n"));
        answer += "\nĐã lưu " + rows.size() + " kết quả; có " + student.getCompletedCourseCodes().size() + " mã môn đã đạt. Mình chưa tính GPA/xếp loại vì chưa có công thức chính thức của trường.";
        return result(answer, "Bảng kết quả học tập của tài khoản đang đăng nhập");
    }

    private Answer curriculum(Student student, List<CourseSection> active) {
        var rows = curriculumRows(student);
        if (rows.isEmpty())
            return result("Chưa có khung chương trình đang áp dụng cho ngành " + student.getProgram() + ", khóa " + Objects.toString(student.getCohort(), "chưa khai báo") + ". Mình không tự suy ra chương trình từ danh sách lớp mở.", "Chương trình theo ngành và khóa");
        Set<String> studying = active.stream().map(s -> s.getCourse().getCode()).collect(Collectors.toSet());
        var missing = rows.stream().filter(r -> !student.getCompletedCourseCodes().contains(r.getCourse().getCode())).toList();
        String items = missing.stream().limit(18)
                .map(r -> r.getCourse().getCode() + " — " + r.getCourse().getName() + ", HK gợi ý " + r.getSuggestedSemester() + ", "
                        + (r.isRequiredCourse() ? "bắt buộc" : "tự chọn")
                        + (studying.contains(r.getCourse().getCode()) ? " (đang học)" : ""))
                .collect(Collectors.joining("\n• "));
        return result("Chương trình ngành " + student.getProgram() + ", khóa " + student.getCohort() + " có " + rows.size() + " môn được khai báo, còn " + missing.size() + " môn chưa có kết quả Đạt (gồm môn tự chọn, không có nghĩa tất cả đều bắt buộc).\n"
                + (items.isEmpty() ? "Bạn đã hoàn thành các môn trong khung dữ liệu hiện có." : "• " + items)
                + "\nĐây là khung được nhập vào project, chưa đủ để kết luận điều kiện tốt nghiệp. Xem đầy đủ tại Khung chương trình.",
                "Khung chương trình đúng ngành/khóa", "Các mã môn đã đạt và đang học");
    }

    private List<CurriculumCourse> curriculumRows(Student student) {
        if (student.getProgram() == null || student.getCohort() == null) {
            return List.of();
        }
        var activeCurricula = curricula.findAllByProgramIgnoreCaseAndCohortIgnoreCaseAndStatusOrderByVersionDesc(
                student.getProgram(), student.getCohort(), Curriculum.Status.ACTIVE);
        if (activeCurricula.isEmpty()) {
            return List.of();
        }
        return curriculumCourses.findAllByCurriculum_CodeOrderByOrderIndexAsc(activeCurricula.getFirst().getCode());
    }

    private List<AcademicResult> gradeRows(Student student) {
        return academicResults.findTranscriptByStudentId(student.getId());
    }

    private Set<String> studied(Student student, Semester term) {
        return conditionEvaluator.priorStudiedCodes(student, term);
    }

    private Map<String, List<CourseConditionRepository.RuleView>> rules() {
        return conditionEvaluator.allRulesByCourse();
    }

    private List<String> problems(Course course, Student student, List<CourseSection> active,
                                  Map<String, List<CourseConditionRepository.RuleView>> rules, Set<String> studied) {
        Set<String> concurrent = active.stream().map(s -> s.getCourse().getCode()).collect(Collectors.toSet());
        var unmet = conditionEvaluator.findUnmetConditions(course, student, concurrent, rules, studied);
        return conditionEvaluator.formatChatProblems(unmet);
    }

    private boolean unknownConditions(Course course, Map<String, List<CourseConditionRepository.RuleView>> rules) {
        return !rules.containsKey(course.getCode())
                && course.getPrerequisiteCodes().isEmpty()
                && contains(normalize(course.getPrerequisite()), "chua co", "chua ro");
    }

    private Map<String, Long> counts() {
        return registrations.activeCountsBySection().stream()
                .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));
    }

    private boolean conflicts(CourseSection first, List<CourseSection> others) {
        return others.stream()
                .filter(s -> !s.getId().equals(first.getId()))
                .anyMatch(s -> first.getEffectiveMeetings().stream().anyMatch(a -> s.getEffectiveMeetings().stream().anyMatch(a::overlaps)));
    }

    private Course findCourse(String text, List<Course> all) {
        return all.stream()
                .filter(c -> Pattern.compile("(?<![a-z0-9])" + Pattern.quote(normalize(c.getCode())) + "(?![a-z0-9])").matcher(text).find()
                        || text.contains(normalize(c.getName())))
                .sorted(Comparator.comparingInt((Course c) -> normalize(c.getName()).length()).reversed())
                .findFirst().orElse(null);
    }

    private Answer result(String reply, String... sources) {
        return new Answer(reply, List.of(sources), PROMPTS);
    }

    static String normalize(String text) {
        return Normalizer.normalize(Objects.toString(text, ""), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .trim();
    }

    private static boolean contains(String text, String... terms) {
        return Arrays.stream(terms).anyMatch(text::contains);
    }

    private static String formatDate(LocalDate date) {
        return date == null ? "chưa xác định" : DATE.format(date);
    }

    private static String formatDateTime(LocalDateTime value) {
        return value == null ? "chưa xác định" : value.format(DATE_TIME);
    }
}
