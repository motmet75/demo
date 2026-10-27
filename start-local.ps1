$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path -LiteralPath 'secrets/application-secrets.properties')) {
    throw 'Missing secrets/application-secrets.properties. Configure spring.datasource.url, spring.datasource.username and spring.datasource.password first.'
}
$jarPath = Join-Path $PSScriptRoot 'target/demo-0.0.1-SNAPSHOT.jar'
if (-not (Test-Path -LiteralPath $jarPath)) { throw 'Build the application before starting localhost.' }
$existing = Get-NetTCPConnection -State Listen -LocalPort 8081 -ErrorAction SilentlyContinue
if ($existing) { throw 'Port 8081 is already occupied. Stop the existing application or choose another port.' }
New-Item -ItemType Directory -Force 'tmp/local-app' | Out-Null
if (-not (Test-Path -LiteralPath 'tmp/local-app/localhost.p12')) {
    & keytool -genkeypair -alias localhost -keyalg RSA -keysize 2048 -validity 365 -storetype PKCS12 -keystore tmp/local-app/localhost.p12 -storepass local-test-only -dname 'CN=localhost, OU=Local Development, O=Anhmedia, C=VN' -ext 'SAN=dns:localhost,ip:127.0.0.1,ip:::1' -noprompt
    if ($LASTEXITCODE -ne 0) { throw 'Failed to generate the localhost TLS certificate.' }
}
$process = Start-Process -FilePath 'java' -ArgumentList @('-jar', ('"' + $jarPath + '"'), '--spring.profiles.active=local') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput 'tmp/local-app/stdout.log' -RedirectStandardError 'tmp/local-app/stderr.log' -PassThru
$process.Id | Set-Content 'tmp/local-app/app.pid'
Write-Output "Starting Invoice Desk (PID $($process.Id)). Logs: tmp/local-app/stdout.log"
Write-Output 'Backend: http://localhost:8081. Frontend: http://localhost:5173/bom-inventory/invoice-desk'
