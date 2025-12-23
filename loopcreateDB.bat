@echo off

:: PostgreSQL credentials
set PG_USER=postgres
set PG_PASSWORD=295hAhVyG5Manager
set PG_HOST=localhost
set PG_PORT=5432

:: List of databases
set databases=tuonghoa anhmedia nncminhchau minhmapshop nlsjsc thegioithan tuonghoaimex

:: Export password for PostgreSQL
set PGPASSWORD=%PG_PASSWORD%

:: Loop through databases
for %%D in (%databases%) do (
   

    :: Run the psql command
    psql -U %PG_USER% -h %PG_HOST% -p %PG_PORT% -d %%D -c " Drop table IF EXISTS purchase_invoice;  CREATE TABLE IF NOT EXISTS purchase_invoice ( id SERIAL PRIMARY KEY, stringId VARCHAR(255), supplierId VARCHAR(255), invoiceNo VARCHAR(50), vat VARCHAR(50), invoiceDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP, hsCode VARCHAR(50), sequenceNumber VARCHAR(50), description TEXT, unit VARCHAR(50), unitPrice DECIMAL(15,3), qty DECIMAL(15,3), currency VARCHAR(50), amount DECIMAL(15,3), note TEXT, createdTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, modifiedTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP, isApproved BOOLEAN, isLocked BOOLEAN, isVisible BOOLEAN );"
	
    :: Check for errors
    if errorlevel 1 (
        echo Failed to create table in %%D
    ) else (
        echo Successfully created table in %%D
    )
)

:: Clear password for security
set PGPASSWORD=