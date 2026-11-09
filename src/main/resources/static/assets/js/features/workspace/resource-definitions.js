export const resourceDefinitions = {
  accounts: { title:'Quản lý tài khoản', description:'Tạo tài khoản, cập nhật vai trò, khóa hoặc mở khóa truy cập.', endpoint:'/api/admin/accounts', fields:[
    {name:'username',label:'Tên đăng nhập',required:true},{name:'email',label:'Email',type:'email'},
    {name:'role',label:'Vai trò',type:'select',required:true,options:[['STUDENT','Sinh viên'],['LECTURER','Giảng viên'],['TRAINING_OFFICE','Ban Đào tạo'],['ADMIN','Quản trị viên']]},
    {name:'studentCode',label:'Mã sinh viên'},{name:'lecturerCode',label:'Mã giảng viên'},
    {name:'displayName',label:'Họ và tên'},{name:'program',label:'Ngành / chương trình'},{name:'cohort',label:'Khóa tuyển sinh'},{name:'department',label:'Khoa / đơn vị'},
    {name:'status',label:'Trạng thái',type:'select',options:[['ACTIVE','Đang hoạt động'],['LOCKED','Đã khóa'],['DISABLED','Đã vô hiệu hóa']]},
    {name:'password',label:'Mật khẩu khởi tạo',type:'password',required:true,createOnly:true,wide:true}
  ],columns:[['username','Tên đăng nhập'],['displayName','Họ và tên'],['role','Vai trò'],['email','Email'],['status','Trạng thái']]},
  courses: { title:'Quản lý môn học', description:'Quản lý danh mục môn học và điều kiện tiên quyết.', endpoint:'/api/training/courses', fields:[
    {name:'code',label:'Mã môn',required:true},{name:'name',label:'Tên môn học',required:true,wide:true},
    {name:'department',label:'Khoa / đơn vị',required:true},{name:'credits',label:'Số tín chỉ',type:'number',min:0,max:12,required:true},
    {name:'prerequisite',label:'Mô tả tiên quyết'},{name:'description',label:'Mô tả',type:'textarea',wide:true},{name:'syllabusUrl',label:'Liên kết đề cương',type:'url',wide:true},
    {name:'active',label:'Trạng thái sử dụng',type:'select',options:[['true','Đang sử dụng'],['false','Ngừng sử dụng']]}
  ],columns:[['code','Mã môn'],['name','Tên môn học'],['department','Khoa / đơn vị'],['credits','Tín chỉ'],['prerequisite','Tiên quyết'],['active','Đang sử dụng']]},
  semesters: { title:'Quản lý học kỳ & đợt đăng ký', description:'Thiết lập lịch học, thời gian mở/đóng đăng ký và trạng thái học kỳ.', endpoint:'/api/training/semesters', fields:[
    {name:'code',label:'Mã học kỳ',required:true},{name:'name',label:'Tên học kỳ',required:true,wide:true},
    {name:'startsAt',label:'Ngày bắt đầu học kỳ',type:'date'},
    {name:'endsAt',label:'Ngày kết thúc học kỳ',type:'date'},
    {name:'registrationOpenAt',label:'Mở đăng ký',type:'date'},
    {name:'registrationCloseAt',label:'Đóng đăng ký',type:'date'},
    {name:'registrationAlwaysOpen',label:'Mở đăng ký liên tục (tạm thời)',type:'select',options:[['false','Theo thời gian đăng ký'],['true','Mở đến khi có thông báo mới']]},
    {name:'status',label:'Trạng thái',type:'select',required:true,options:[['PLANNED','Đã lên kế hoạch'],['ACTIVE','Đang diễn ra'],['COMPLETED','Đã kết thúc'],['ARCHIVED','Lưu trữ']]}
  ],columns:[['code','Mã học kỳ'],['name','Tên học kỳ'],['startsAt','Bắt đầu'],['endsAt','Kết thúc'],['registrationOpenAt','Mở đăng ký'],['registrationCloseAt','Đóng đăng ký'],['status','Trạng thái']]},
  sections: { title:'Quản lý lớp học phần', description:'Phân công giảng viên, lịch học, phòng và sĩ số lớp.', endpoint:'/api/training/sections', fields:[
    {name:'id',label:'ID lớp (để trống để tự sinh)'},{name:'sectionCode',label:'Mã lớp học phần',required:true},
    {name:'courseCode',label:'Mã môn học',required:true},{name:'semesterCode',label:'Mã học kỳ',required:true},
    {name:'lecturerCode',label:'Mã giảng viên (để trống nếu chưa phân công)'},
    {name:'capacity',label:'Sĩ số tối đa',type:'number',min:1,required:true},
    {name:'importedEnrolled',label:'Sĩ số tại trường (nếu nhập từ Excel)',type:'number',min:0},
    {name:'status',label:'Trạng thái',type:'select',required:true,options:[['OPEN','Đang mở'],['CLOSED','Đã đóng'],['CANCELLED','Đã hủy']]}
  ],columns:[['sectionCode','Mã lớp'],['courseCode','Mã môn'],['semesterCode','Học kỳ'],['lecturerName','Giảng viên'],['schedule','Lịch học'],['enrolled','Sĩ số'],['status','Trạng thái']]},
  registrations: { title:'Quản lý đợt đăng ký', description:'Mở, gia hạn, đóng hoặc hủy đợt đăng ký theo học kỳ.', endpoint:'/api/training/registration-periods', fields:[
    {name:'semesterCode',label:'Mã học kỳ',required:true},{name:'startsAt',label:'Thời gian bắt đầu',type:'datetime-local',required:true},
    {name:'endsAt',label:'Thời gian kết thúc',type:'datetime-local',required:true},
    {name:'status',label:'Trạng thái',type:'select',required:true,options:[['SCHEDULED','Sắp mở'],['OPEN','Đang mở'],['CLOSED','Đã đóng'],['CANCELLED','Đã hủy']]}
  ],columns:[['semesterCode','Học kỳ'],['startsAt','Bắt đầu'],['endsAt','Kết thúc'],['status','Trạng thái']]},
  curricula: { title:'Quản lý khung chương trình', description:'Tạo và quản lý chương trình đào tạo theo ngành, khóa và phiên bản.', endpoint:'/api/training/curricula', fields:[
    {name:'code',label:'Mã chương trình',required:true},{name:'name',label:'Tên chương trình',required:true,wide:true},
    {name:'program',label:'Ngành / chuyên ngành',required:true},{name:'cohort',label:'Khóa tuyển sinh',required:true},
    {name:'version',label:'Phiên bản',required:true},{name:'status',label:'Trạng thái',type:'select',options:[['DRAFT','Bản nháp'],['ACTIVE','Đang áp dụng'],['ARCHIVED','Lưu trữ']]}
  ],columns:[['code','Mã CTĐT'],['name','Tên chương trình'],['program','Ngành'],['cohort','Khóa'],['version','Phiên bản'],['status','Trạng thái']]},
  prerequisites: { title:'Quản lý điều kiện tiên quyết', description:'Thiết lập quan hệ tiên quyết giữa các môn học.', endpoint:'/api/training/prerequisites', fields:[
    {name:'courseCode',label:'Mã môn học',required:true},{name:'prerequisiteCode',label:'Mã môn tiên quyết',required:true}
  ],columns:[['courseCode','Môn học'],['courseName','Tên môn'],['prerequisiteCode','Môn tiên quyết'],['prerequisiteName','Tên môn tiên quyết']]},
  logs: { title:'Nhật ký hệ thống', description:'Tra cứu thao tác tài khoản và sự kiện hệ thống.', endpoint:'/api/admin/audit-logs', fields:[], columns:[['createdAt','Thời gian'],['actor','Tài khoản'],['role','Vai trò'],['action','Thao tác'],['target','Đối tượng'],['details','Chi tiết']], readOnly:true },
  reports: { title:'Báo cáo và thống kê', description:'Theo dõi lượt đăng ký, tình trạng sĩ số và số lớp học phần.', endpoint:'/api/reports', fields:[], columns:[['semester','Học kỳ'],['courseCode','Mã môn'],['courseName','Môn học'],['sectionCode','Lớp'],['status','Trạng thái lớp'],['enrolled','Đã đăng ký'],['capacity','Sĩ số tối đa'],['waitlisted','Danh sách chờ']], readOnly:true }
};
