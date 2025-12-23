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
    
     psql -U "$PG_USER" -h "$PG_HOST" -p "$PG_PORT" -d "$db" -c "  CREATE TABLE IF NOT EXISTS ProductTagTb ( id SERIAL PRIMARY KEY, stringId VARCHAR(255), productTagCode VARCHAR(255), productTagName VARCHAR(255), createdTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, modifiedTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, isApproved BOOLEAN, isLocked BOOLEAN, isVisible BOOLEAN );CREATE TABLE IF NOT EXISTS ProductTagTb ( id SERIAL PRIMARY KEY, stringId VARCHAR(255), productTagCode VARCHAR(255), productTagName VARCHAR(255), createdTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, modifiedTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, isApproved BOOLEAN, isLocked BOOLEAN, isVisible BOOLEAN ); Drop table IF EXISTS  ProductTabItemTb ;    CREATE TABLE IF NOT EXISTS ProductTagItemTb ( id SERIAL PRIMARY KEY, stringId VARCHAR(255), productTagItemCode VARCHAR(255), productTagItemName VARCHAR(255), productCode VARCHAR(255), createdTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, modifiedTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, isApproved BOOLEAN, isLocked BOOLEAN, isVisible BOOLEAN );" || {
        echo "Không thể sửa đổi bảng trên cơ sở dữ liệu $db"
    }
done

# Xóa biến môi trường chứa mật khẩu
unset PGPASSWORD