# Gửi ảnh và chứng từ từ máy Windows lên nhánh tạm để phiên trên cloud lấy về.
#
# Vì sao cần: phiên Claude đang dựng site chạy trong container trên cloud của
# Anthropic, không phải trên máy này — nó không đọc được ổ Q:. Kho Git là kênh
# chung duy nhất giữa hai bên.
#
# Cách chạy (PowerShell, đứng trong thư mục kho landing-combo-nam):
#
#     .\scripts\gui-anh.ps1
#
# hoặc chỉ định thư mục nguồn khác:
#
#     .\scripts\gui-anh.ps1 -Nguon "Q:\ECommerce\LUNNAR-MONEY\Products\COMBO NAM"
#
# Script KHÔNG đổi tên và KHÔNG chọn lọc file: nó đẩy nguyên trạng lên một
# nhánh riêng tên `assets-inbox`. Việc chọn ảnh nào vào vị trí nào để phiên trên
# cloud làm, vì nó biết từng khung hình cần gì.
#
# Nhánh `assets-inbox` KHÔNG bao giờ merge vào main — sau khi lấy xong ảnh sẽ
# xoá, nên lịch sử nhánh chính không bị phình vì file nhị phân.

param(
  [string]$Nguon = "Q:\ECommerce\LUNNAR-MONEY\Products\COMBO NÁM",
  [string]$Nhanh = "assets-inbox",
  [int]$GioiHanMb = 300
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Nguon)) {
  Write-Error "Không thấy thư mục nguồn: $Nguon`nChạy lại với -Nguon '<đường dẫn đúng>'"
}

if (-not (Test-Path ".git")) {
  Write-Error "Phải đứng trong thư mục kho landing-combo-nam (chỗ có thư mục .git)."
}

# Chỉ lấy các định dạng dùng được trên web và chứng từ. Bỏ file thiết kế nặng
# (PSD, AI) — chúng không lên web được và làm nhánh phình vô ích.
$DuoiNhan = @(".jpg", ".jpeg", ".png", ".webp", ".avif", ".heic", ".tif", ".tiff", ".pdf")

$files = Get-ChildItem -Path $Nguon -Recurse -File |
  Where-Object { $DuoiNhan -contains $_.Extension.ToLower() }

if ($files.Count -eq 0) {
  Write-Error "Không tìm thấy file ảnh hoặc PDF nào trong $Nguon"
}

$tongMb = [math]::Round((($files | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
Write-Host "Tìm thấy $($files.Count) file, tổng $tongMb MB" -ForegroundColor Cyan

if ($tongMb -gt $GioiHanMb) {
  Write-Error ("Tổng $tongMb MB vượt giới hạn $GioiHanMb MB. " +
    "Lọc bớt file rồi chạy lại, hoặc tăng -GioiHanMb nếu chắc chắn.")
}

$nhanhHienTai = (git rev-parse --abbrev-ref HEAD).Trim()

# Nhánh inbox dựng lại từ main mỗi lần: nó là hộp thư, không phải lịch sử.
git fetch origin main --quiet
git switch -c $Nhanh origin/main --force-create 2>$null
if ($LASTEXITCODE -ne 0) { git switch -C $Nhanh origin/main }

$dich = "assets-inbox"
if (Test-Path $dich) { Remove-Item $dich -Recurse -Force }
New-Item -ItemType Directory -Path $dich | Out-Null

foreach ($f in $files) {
  # Giữ nguyên cấu trúc thư mục con để còn biết file nào nằm nhóm nào.
  $tuongDoi = $f.FullName.Substring((Resolve-Path $Nguon).Path.Length).TrimStart("\")
  $dichFile = Join-Path $dich $tuongDoi
  $thuMucCha = Split-Path $dichFile -Parent
  if (-not (Test-Path $thuMucCha)) { New-Item -ItemType Directory -Path $thuMucCha -Force | Out-Null }
  Copy-Item $f.FullName $dichFile
}

# Bản kê để phiên trên cloud biết file gốc tên gì, nặng bao nhiêu, ở đâu ra.
$files | Select-Object `
  @{n = 'ten'; e = { $_.Name } },
  @{n = 'thuMuc'; e = { $_.DirectoryName.Substring((Resolve-Path $Nguon).Path.Length).TrimStart("\") } },
  @{n = 'kb'; e = { [math]::Round($_.Length / 1KB) } },
  @{n = 'sua'; e = { $_.LastWriteTime.ToString("yyyy-MM-dd") } } |
  ConvertTo-Json -Depth 3 | Set-Content (Join-Path $dich "_ban-ke.json") -Encoding utf8

git add $dich
git commit -m "chore: ảnh và chứng từ gốc từ máy local (nhánh tạm, không merge)" --quiet
git push -u origin $Nhanh --force --quiet

Write-Host ""
Write-Host "Đã đẩy $($files.Count) file lên nhánh '$Nhanh'." -ForegroundColor Green
Write-Host "Quay lại nhánh cũ: git switch $nhanhHienTai"
Write-Host ""
Write-Host "Giờ quay sang phiên Claude đang mở và nhắn: 'ảnh đã lên nhánh assets-inbox'" -ForegroundColor Yellow
