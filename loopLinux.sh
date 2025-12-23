#!/bin/sh

# Danh sách các cơ sở dữ liệu
databases="tuonghoa anhmedia nncminhchau minhmapshop thegioithan nlsjsc"

# Thông tin đăng nhập PostgreSQL
PG_USER="postgres"
PG_PASSWORD="295hAhVyG5Manager"
PG_HOST="localhost"
PG_PORT="5432"

# Xuất biến môi trường chứa mật khẩu để đăng nhập không cần tương tác
export PGPASSWORD=$PG_PASSWORD

# Vòng lặp qua từng cơ sở dữ liệu và chạy câu lệnh SQL
for db in $databases; do
    echo "Thực thi truy vấn trên cơ sở dữ liệu: $db"
    
    psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d "$db" -c " alter table usertb add column phoneNumber varchar(255) DEFAULT 'none'; alter table usertb add column createdTime timestamp DEFAULT '2025-01-01 00:00:00'; alter table authorities add column visible BOOLEAN DEFAULT TRUE;" || {
        echo "Không thể sửa đổi bảng trên cơ sở dữ liệu $db"
    }
done

# Xóa biến môi trường chứa mật khẩu
unset PGPASSWORD

update usertb set isAccountNonExpired = true;
update usertb set isAccountNonLocked = true;
update usertb set isCredentialsNonExpired = true;
update usertb set isAccountNonExpired = true;