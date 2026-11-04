"""Validate supplied CSVs against their workbook and create an isolated H2 source database."""
import argparse
import csv
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import openpyxl

# Columns are kept in the original order; foreign keys make incomplete imports fail.
DEFINITIONS = [
    ('01_khoa', 'ma_khoa VARCHAR(40) PRIMARY KEY, ten_khoa VARCHAR(160) NOT NULL'),
    ('02_nganh', 'ma_nganh VARCHAR(40) PRIMARY KEY, ten_nganh VARCHAR(160) NOT NULL, ma_khoa VARCHAR(40) NOT NULL REFERENCES src_01_khoa'),
    ('03_lop_hanh_chinh', 'ma_lop_hanh_chinh VARCHAR(40) PRIMARY KEY, ma_nganh VARCHAR(40) NOT NULL REFERENCES src_02_nganh, khoa_hoc VARCHAR(20) NOT NULL'),
    ('04_sinh_vien', 'ma_sinh_vien VARCHAR(30) PRIMARY KEY, ho_ten VARCHAR(120) NOT NULL, ma_lop_hanh_chinh VARCHAR(40) NOT NULL REFERENCES src_03_lop_hanh_chinh, khoa_hoc VARCHAR(20) NOT NULL, ma_nganh VARCHAR(40) NOT NULL REFERENCES src_02_nganh, ten_nganh VARCHAR(160) NOT NULL, ma_khoa VARCHAR(40) NOT NULL REFERENCES src_01_khoa, ten_khoa VARCHAR(160) NOT NULL, so_dien_thoai VARCHAR(30), email VARCHAR(160) UNIQUE NOT NULL, trang_thai_hoc_tap VARCHAR(40) NOT NULL'),
    ('05_giang_vien', 'ma_giang_vien VARCHAR(30) PRIMARY KEY, ho_ten VARCHAR(120) NOT NULL, ma_khoa VARCHAR(40) NOT NULL REFERENCES src_01_khoa, bo_mon VARCHAR(160), hoc_vi VARCHAR(80), hoc_ham VARCHAR(80), so_dien_thoai VARCHAR(30), email VARCHAR(160) UNIQUE NOT NULL'),
    ('06_hoc_phan', 'ma_hoc_phan VARCHAR(20) PRIMARY KEY, ten_hoc_phan VARCHAR(160) NOT NULL, so_tin_chi INT NOT NULL CHECK(so_tin_chi>=0), ma_khoa VARCHAR(40) NOT NULL REFERENCES src_01_khoa'),
    ('14_lich_hoc_ky', 'ma_hoc_ky VARCHAR(30) PRIMARY KEY, ten_hoc_ky VARCHAR(100) NOT NULL, nam_hoc VARCHAR(20) NOT NULL, hoc_ky INT NOT NULL, ngay_bat_dau DATE NOT NULL, ngay_ket_thuc DATE NOT NULL, ngay_bat_dau_tuan_1 DATE NOT NULL, so_tuan_hoc INT NOT NULL CHECK(so_tuan_hoc>0), thoi_gian_mo_dang_ky TIMESTAMP NOT NULL, thoi_gian_dong_dang_ky TIMESTAMP NOT NULL, CHECK(ngay_bat_dau<=ngay_bat_dau_tuan_1 AND ngay_bat_dau_tuan_1<=ngay_ket_thuc), CHECK(thoi_gian_mo_dang_ky<thoi_gian_dong_dang_ky)'),
    ('07_lop_hoc_phan', 'ma_lop_hoc_phan VARCHAR(30) PRIMARY KEY, ma_hoc_phan VARCHAR(20) NOT NULL REFERENCES src_06_hoc_phan, ma_hoc_ky VARCHAR(30) NOT NULL REFERENCES src_14_lich_hoc_ky, si_so_toi_da INT NOT NULL CHECK(si_so_toi_da>0), thu INT NOT NULL CHECK(thu BETWEEN 2 AND 8), tiet_bat_dau INT NOT NULL CHECK(tiet_bat_dau>0), so_tiet INT NOT NULL CHECK(so_tiet>0), phong_hoc VARCHAR(40), tuan_bat_dau INT NOT NULL CHECK(tuan_bat_dau>0), tuan_ket_thuc INT NOT NULL CHECK(tuan_ket_thuc>=tuan_bat_dau)'),
    ('08_phan_cong_giang_day', 'ma_hoc_ky VARCHAR(30) NOT NULL REFERENCES src_14_lich_hoc_ky, ma_lop_hoc_phan VARCHAR(30) NOT NULL REFERENCES src_07_lop_hoc_phan, ma_giang_vien VARCHAR(30) NOT NULL REFERENCES src_05_giang_vien, PRIMARY KEY(ma_hoc_ky,ma_lop_hoc_phan,ma_giang_vien)'),
    ('09_chuong_trinh_dao_tao', 'ma_chuong_trinh VARCHAR(40) PRIMARY KEY, ten_chuong_trinh VARCHAR(160) NOT NULL, ma_nganh VARCHAR(40) NOT NULL REFERENCES src_02_nganh, khoa_ap_dung VARCHAR(20) NOT NULL, phien_ban VARCHAR(40) NOT NULL'),
    ('10_ctdt_hoc_phan', 'ma_chuong_trinh VARCHAR(40) NOT NULL REFERENCES src_09_chuong_trinh_dao_tao, ma_hoc_phan VARCHAR(20) NOT NULL REFERENCES src_06_hoc_phan, hoc_ky_du_kien INT NOT NULL CHECK(hoc_ky_du_kien>0), loai_hoc_phan VARCHAR(40) NOT NULL, PRIMARY KEY(ma_chuong_trinh,ma_hoc_phan)'),
    ('11_dieu_kien_hoc_phan', 'ma_hoc_phan VARCHAR(20) NOT NULL REFERENCES src_06_hoc_phan, ma_mon_dieu_kien VARCHAR(20) NOT NULL REFERENCES src_06_hoc_phan, loai_dieu_kien VARCHAR(40) NOT NULL, PRIMARY KEY(ma_hoc_phan,ma_mon_dieu_kien,loai_dieu_kien), CHECK(ma_hoc_phan<>ma_mon_dieu_kien)'),
    ('12_ket_qua_hoc_tap', 'ma_sinh_vien VARCHAR(30) NOT NULL REFERENCES src_04_sinh_vien, ma_hoc_phan VARCHAR(20) NOT NULL REFERENCES src_06_hoc_phan, ma_hoc_ky VARCHAR(30) NOT NULL REFERENCES src_14_lich_hoc_ky, ket_qua VARCHAR(20) NOT NULL, diem DECIMAL(4,2) CHECK(diem BETWEEN 0 AND 10), diem_chu VARCHAR(10), PRIMARY KEY(ma_sinh_vien,ma_hoc_phan,ma_hoc_ky)'),
    ('13_dang_ky', 'ma_sinh_vien VARCHAR(30) NOT NULL REFERENCES src_04_sinh_vien, ma_hoc_ky VARCHAR(30) NOT NULL REFERENCES src_14_lich_hoc_ky, ma_lop_hoc_phan VARCHAR(30) NOT NULL REFERENCES src_07_lop_hoc_phan, trang_thai_dang_ky VARCHAR(30) NOT NULL, ngay_dang_ky DATE NOT NULL, PRIMARY KEY(ma_sinh_vien,ma_lop_hoc_phan)'),
    ('15_tiet_hoc', 'ma_tiet INT PRIMARY KEY, gio_bat_dau TIME NOT NULL, gio_ket_thuc TIME NOT NULL, buoi VARCHAR(20) NOT NULL, trang_thai_xac_nhan VARCHAR(100) NOT NULL, CHECK(gio_bat_dau<gio_ket_thuc)'),
]

def quote(value):
    return 'NULL' if value == '' or value is None else "'" + str(value).replace("'", "''") + "'"

def comparable(value, column):
    if value is None or value == '':
        return ''
    if column == 'diem':
        return str(Decimal(str(value)).normalize())
    if column.startswith('ngay_'):
        return value.date().isoformat() if isinstance(value, datetime) else str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat(sep=' ') if isinstance(value, datetime) else value.isoformat()
    return str(value)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv_directory', type=Path)
    parser.add_argument('--workbook', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('data/imports/academic-demo'))
    parser.add_argument('--periods', type=Path, default=Path('config/academic-demo-periods.csv'))
    args = parser.parse_args()
    output = args.output.resolve()
    database = output / 'academic-demo'
    if database.with_suffix('.mv.db').exists():
        raise SystemExit('Database already exists; choose a new --output directory.')
    data, hashes = {}, {}
    book = openpyxl.load_workbook(args.workbook, read_only=True, data_only=False)
    raw_book = []
    for sh in book:
        for number, row in enumerate(sh.iter_rows(values_only=True), 1):
            if any(v is not None for v in row):
                raw_book.append((sh.title, number, json.dumps(row, ensure_ascii=False, default=str)))
    for name, _ in DEFINITIONS:
        path = args.csv_directory / (name + '.csv')
        if name == '15_tiet_hoc' and not path.exists():
            path = args.periods
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream)
            rows = list(reader)
            if any(None in r for r in rows):
                raise ValueError(f'Unexpected CSV cells: {name}')
            sheet_rows = list(book[name].iter_rows(values_only=True)) if name in book.sheetnames else None
            if sheet_rows is None and name != '15_tiet_hoc':
                raise ValueError('Missing workbook sheet: ' + name)
            if sheet_rows is None:
                data[name] = rows
                hashes[name + '.csv'] = hashlib.sha256(path.read_bytes()).hexdigest()
                continue
            if list(sheet_rows[0]) != reader.fieldnames or len(sheet_rows)-1 != len(rows):
                raise ValueError(f'Workbook/CSV shape differs: {name}')
            for number, (excel, row) in enumerate(zip(sheet_rows[1:], rows), 2):
                for column, value in zip(reader.fieldnames, excel):
                    if comparable(value, column) != comparable(row[column], column):
                        raise ValueError(f'Workbook/CSV differ at {name}:{number}:{column}')
            data[name] = rows
            hashes[name + '.csv'] = hashlib.sha256(path.read_bytes()).hexdigest()
    book.close()
    hashes[args.workbook.name] = hashlib.sha256(args.workbook.read_bytes()).hexdigest()
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    index = lambda name, key: {r[key]: r for r in data[name]}
    departments = index('01_khoa', 'ma_khoa')
    programs = index('02_nganh', 'ma_nganh')
    classes = index('03_lop_hanh_chinh', 'ma_lop_hanh_chinh')
    sections = index('07_lop_hoc_phan', 'ma_lop_hoc_phan')
    semesters = index('14_lich_hoc_ky', 'ma_hoc_ky')
    emails = [r['email'].lower() for key in ('04_sinh_vien', '05_giang_vien') for r in data[key]]
    if len(emails) != len(set(emails)):
        raise ValueError('Duplicate account email')
    for r in data['04_sinh_vien']:
        cls, program = classes[r['ma_lop_hanh_chinh']], programs[r['ma_nganh']]
        if cls['ma_nganh'] != r['ma_nganh'] or cls['khoa_hoc'] != r['khoa_hoc'] or program['ten_nganh'] != r['ten_nganh'] or program['ma_khoa'] != r['ma_khoa'] or departments[r['ma_khoa']]['ten_khoa'] != r['ten_khoa']:
            raise ValueError('Inconsistent student/class/program/department: ' + r['ma_sinh_vien'])
    for key in ('08_phan_cong_giang_day', '13_dang_ky'):
        for r in data[key]:
            if sections[r['ma_lop_hoc_phan']]['ma_hoc_ky'] != r['ma_hoc_ky']:
                raise ValueError('Section/semester mismatch in ' + key)
    assignments = Counter(r['ma_lop_hoc_phan'] for r in data['08_phan_cong_giang_day'])
    if any(assignments[code] != 1 for code in sections):
        raise ValueError('Application currently requires one assigned lecturer per section')
    for r in data['12_ket_qua_hoc_tap']:
        if r['ket_qua'] not in {'Đạt', 'Chưa đạt'} or (r['diem'] and (Decimal(r['diem']) >= 4) != (r['ket_qua'] == 'Đạt')):
            raise ValueError('Inconsistent academic result')
    for r in data['07_lop_hoc_phan']:
        if int(r['tuan_ket_thuc']) > int(semesters[r['ma_hoc_ky']]['so_tuan_hoc']):
            raise ValueError('Section weeks exceed semester')
        periods = index('15_tiet_hoc', 'ma_tiet')
        if any(str(i) not in periods for i in range(int(r['tiet_bat_dau']),int(r['tiet_bat_dau'])+int(r['so_tiet']))):
            raise ValueError('Missing teaching period')
    for key, column, allowed in (
        ('11_dieu_kien_hoc_phan', 'loai_dieu_kien', {'Tiên quyết','Học trước','Song hành'}),
        ('13_dang_ky', 'trang_thai_dang_ky', {'Đã đăng ký','Chờ xác nhận','Đã hủy'}),
        ('10_ctdt_hoc_phan', 'loai_hoc_phan', {'Bắt buộc','Tự chọn'}),
        ('04_sinh_vien', 'trang_thai_hoc_tap', {'Đang học','Cảnh báo học vụ','Bảo lưu'})):
        if any(r[column] not in allowed for r in data[key]):
            raise ValueError('Unsupported status in ' + key)
    sql = ['CREATE TABLE source_import (sha256 CHAR(64) PRIMARY KEY, manifest_json CLOB NOT NULL);',
           'CREATE TABLE source_raw_rows (file_name VARCHAR NOT NULL, row_number INT NOT NULL, data_json CLOB NOT NULL, PRIMARY KEY(file_name,row_number));']
    sql += [f'CREATE TABLE src_{name} ({definition});' for name, definition in DEFINITIONS]
    sql += ['SET AUTOCOMMIT FALSE;', f'INSERT INTO source_import VALUES({quote(digest)},{quote(json.dumps(hashes, ensure_ascii=False))});']
    for name, rows in data.items():
        for number, r in enumerate(rows, 2):
            sql.append(f'INSERT INTO src_{name} VALUES(' + ','.join(quote(v) for v in r.values()) + ');')
            sql.append(f'INSERT INTO source_raw_rows VALUES({quote(name+".csv")},{number},{quote(json.dumps(r, ensure_ascii=False))});')
    sql += [f'INSERT INTO source_raw_rows VALUES({quote("xlsx:"+sheet)},{number},{quote(raw)});' for sheet, number, raw in raw_book]
    sql.append('COMMIT;')
    output.mkdir(parents=True, exist_ok=True)
    sql_path = output / 'academic-demo.sql'
    sql_path.write_text('\n'.join(sql), encoding='utf-8')
    jar = sorted((Path.home()/'.m2/repository/com/h2database/h2').glob('*/*.jar'))[-1]
    java = shutil.which('java')
    url = 'jdbc:h2:file:' + database.as_posix()
    subprocess.run([java,'-cp',str(jar),'org.h2.tools.RunScript','-url',url,'-user','sa','-script',str(sql_path)], check=True)
    with tempfile.TemporaryDirectory() as tmp:
        checks = [f"SELECT '{name}=' || COUNT(*) FROM src_{name};" for name in data]
        expected_rows = [(name+'.csv', number, r) for name, rows in data.items() for number,r in enumerate(rows,2)]
        expected_rows += [('xlsx:'+sheet, number, json.loads(raw)) for sheet,number,raw in raw_book]
        export = Path(tmp)/'raw.csv'
        checks.append(f"CALL CSVWRITE({quote(export.as_posix())},'SELECT * FROM source_raw_rows ORDER BY file_name,row_number');")
        result = subprocess.run([java,'-cp',str(jar),'org.h2.tools.Shell','-url',url,'-user','sa','-sql',' '.join(checks)], capture_output=True, text=True, check=True)
        for name, rows in data.items():
            if f'{name}={len(rows)}\n' not in result.stdout:
                raise AssertionError('Persisted count mismatch: '+name)
        with export.open(encoding='utf-8', newline='') as stream:
            persisted = [(r['FILE_NAME'],int(r['ROW_NUMBER']),json.loads(r['DATA_JSON'])) for r in csv.DictReader(stream)]
        if persisted != sorted(expected_rows, key=lambda r:(r[0],r[1])):
            raise AssertionError('Raw source round-trip differs')
    summary = {'sha256': digest, 'source_hashes': hashes, 'counts': {k:len(v) for k,v in data.items()},
               'raw_rows_verified': len(expected_rows), 'workbook_csv_parity': True,
               'registration_statuses': dict(Counter(r['trang_thai_dang_ky'] for r in data['13_dang_ky'])),
               'period_statuses': dict(Counter(r['trang_thai_xac_nhan'] for r in data['15_tiet_hoc'])),
               'missing_information': ['Giờ tiết đang dùng bảng mẫu do người dùng cung cấp; chờ xác nhận của nhà trường']}
    (output/'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2),encoding='utf-8')
    (output/'verification.txt').write_text(result.stdout+'\nAll source rows match. All declared foreign keys and constraints passed.\n',encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
