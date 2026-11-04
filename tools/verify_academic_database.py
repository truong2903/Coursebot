"""Compare every supplied business field with a PostgreSQL (or legacy H2) application database."""
import argparse
import csv
from datetime import datetime, time
from decimal import Decimal
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

QUERIES = {
    '01_khoa': 'SELECT code,name FROM departments',
    '02_nganh': 'SELECT code,name,department_code FROM academic_programs',
    '03_lop_hanh_chinh': 'SELECT code,program_code,cohort FROM administrative_classes',
    '04_sinh_vien': 'SELECT s.student_code,s.full_name,a.code,s.cohort,p.code,p.name,d.code,d.name,s.phone,s.email,s.study_status FROM students s JOIN administrative_classes a ON a.code=s.administrative_class_code JOIN academic_programs p ON p.code=a.program_code JOIN departments d ON d.code=p.department_code',
    '05_giang_vien': 'SELECT lecturer_code,full_name,academic_department_code,subject_group,academic_degree,academic_title,phone,email FROM lecturers',
    '06_hoc_phan': 'SELECT code,name,credits,department FROM courses',
    '07_lop_hoc_phan': "SELECT s.section_code,c.code,se.code,s.capacity,m.day_of_week+1,m.start_period,m.period_count,m.room,CAST(SUBSTRING(m.weeks_expression,1,POSITION('-' IN m.weeks_expression)-1) AS INT),CAST(SUBSTRING(m.weeks_expression,POSITION('-' IN m.weeks_expression)+1) AS INT) FROM course_sections s JOIN courses c ON c.id=s.course_id JOIN semesters se ON se.id=s.semester_id JOIN section_meetings m ON m.section_id=s.id",
    '08_phan_cong_giang_day': 'SELECT se.code,s.section_code,l.lecturer_code FROM course_sections s JOIN semesters se ON se.id=s.semester_id JOIN lecturers l ON l.id=s.lecturer_id',
    '09_chuong_trinh_dao_tao': 'SELECT c.code,c.name,p.code,c.cohort,c.version FROM curricula c JOIN academic_programs p ON p.name=c.program',
    '10_ctdt_hoc_phan': "SELECT c.code,co.code,e.suggested_semester,CASE WHEN e.required_course THEN 'Bắt buộc' ELSE 'Tự chọn' END FROM curriculum_courses e JOIN curricula c ON c.id=e.curriculum_id JOIN courses co ON co.id=e.course_id",
    '11_dieu_kien_hoc_phan': 'SELECT c.code,p.code,e.condition_type FROM course_conditions e JOIN courses c ON c.id=e.course_id JOIN courses p ON p.id=e.condition_course_id',
    '12_ket_qua_hoc_tap': 'SELECT s.student_code,c.code,se.code,r.outcome,r.grade,r.letter_grade FROM academic_results r JOIN students s ON s.id=r.student_id JOIN courses c ON c.id=r.course_id JOIN semesters se ON se.id=r.semester_id',
    '13_dang_ky': "SELECT s.student_code,se.code,c.section_code,CASE CAST(e.status AS VARCHAR) WHEN 'ENROLLED' THEN 'Đã đăng ký' WHEN 'PENDING' THEN 'Chờ xác nhận' WHEN 'CANCELLED' THEN 'Đã hủy' ELSE CAST(e.status AS VARCHAR) END,CAST(e.enrolled_at AS DATE) FROM enrollments e JOIN students s ON s.id=e.student_id JOIN course_sections c ON c.id=e.section_id JOIN semesters se ON se.id=c.semester_id",
    '14_lich_hoc_ky': 'SELECT s.code,s.name,s.academic_year,s.term_number,s.starts_at,s.ends_at,s.week_one_starts_at,s.teaching_weeks,r.starts_at,r.ends_at FROM semesters s JOIN registration_periods r ON r.semester_id=s.id',
    '15_tiet_hoc': 'SELECT code,starts_at,ends_at,session_name,confirmation_status FROM teaching_periods',
}

def normal(value, column):
    if value is None or value == '': return ''
    if column == 'diem': return str(Decimal(value).normalize())
    if column.startswith('thoi_gian_'): return datetime.fromisoformat(value).isoformat(sep=' ')
    if column.startswith('gio_'): return time.fromisoformat(value).isoformat()
    return value

def find_psql():
    found = shutil.which('psql')
    if found:
        return found
    candidates = sorted(Path('C:/Program Files/PostgreSQL').glob('*/bin/psql.exe'))
    return str(candidates[-1]) if candidates else 'psql'

def fetch_postgres_rows(host, port, dbname, user, password):
    psql = find_psql()
    env = os.environ.copy()
    if password:
        env['PGPASSWORD'] = password
    results = {}
    for name, query in QUERIES.items():
        proc = subprocess.run(
            [psql, '-h', host, '-p', str(port), '-U', user, '-d', dbname, '-w', '--csv', '-c', query],
            capture_output=True, text=True, encoding='utf-8', env=env, check=True
        )
        rows = list(csv.reader(io.StringIO(proc.stdout)))
        results[name] = rows[1:] if rows else []
    return results

def fetch_h2_rows(h2_path: Path):
    jar = sorted((Path.home()/'.m2/repository/com/h2database/h2').glob('*/*.jar'))[-1]
    results = {}
    with tempfile.TemporaryDirectory() as tmp:
        statements = []
        for name, query in QUERIES.items():
            filename = (Path(tmp)/(name+'.csv')).as_posix().replace("'", "''")
            statements.append(f"CALL CSVWRITE('{filename}','{query.replace(chr(39),chr(39)*2)}');")
        sql = Path(tmp)/'check.sql'
        sql.write_text('\n'.join(statements), encoding='utf-8')
        subprocess.run(['java', '-cp', str(jar), 'org.h2.tools.RunScript',
                        '-url', 'jdbc:h2:file:' + h2_path.resolve().as_posix() + ';IFEXISTS=TRUE',
                        '-user', 'sa', '-script', str(sql)], check=True)
        for name in QUERIES:
            with (Path(tmp)/(name+'.csv')).open(encoding='utf-8', newline='') as stream:
                results[name] = list(csv.reader(stream))[1:]
    return results

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_directory', type=Path)
    parser.add_argument('--db-name', default=os.environ.get('DB_NAME', 'coursebot_academic_demo'))
    parser.add_argument('--db-host', default=os.environ.get('DB_HOST', 'localhost'))
    parser.add_argument('--db-port', type=int, default=int(os.environ.get('DB_PORT', '5432')))
    parser.add_argument('--db-user', default=os.environ.get('DB_USERNAME', 'postgres'))
    parser.add_argument('--h2-database', type=Path, default=None, help='Optional legacy H2 database path')
    parser.add_argument('--periods', type=Path, default=Path('config/academic-demo-periods.csv'))
    parser.add_argument('--output', type=Path, default=Path('data/imports/academic-demo/application-verification.json'))
    args = parser.parse_args()

    password = os.environ.get('DB_PASSWORD') or os.environ.get('PGPASSWORD', '')
    if args.h2_database is not None:
        actual_by_table = fetch_h2_rows(args.h2_database)
        target_label = str(args.h2_database.resolve())
    else:
        actual_by_table = fetch_postgres_rows(args.db_host, args.db_port, args.db_name, args.db_user, password)
        target_label = f"jdbc:postgresql://{args.db_host}:{args.db_port}/{args.db_name}"

    checks = {}
    for name in QUERIES:
        source = args.csv_directory/(name+'.csv')
        if name == '15_tiet_hoc' and not source.exists():
            source = args.periods
        with source.open(encoding='utf-8-sig', newline='') as stream:
            rows = list(csv.reader(stream))
            columns = rows[0]
            expected = rows[1:]
        actual = actual_by_table[name]
        normalize = lambda rows: sorted(tuple(normal(v, c) for c, v in zip(columns, row)) for row in rows)
        if len(expected) != len(actual) or normalize(expected) != normalize(actual):
            raise AssertionError('Application/source fields differ: ' + name)
        checks[name] = {'rows': len(actual), 'all_fields_match': True}
    result = {
        'database': target_label,
        'tables': checks,
        'total_business_rows_verified': sum(c['rows'] for c in checks.values()),
        'all_passed': True
    }
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
