package com.ams.bomcore.service.inventory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Currency;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.InventoryRepository;

@Service
public class InventoryPatchXlsxService {

    private final InventoryRepository inventoryRepository;

    public InventoryPatchXlsxService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    private record PendingPatch(InventoryEntity entity, String orderToDeduction,
                                BigDecimal quota, BigDecimal price, String currency,
                                boolean changeOrder, boolean changeQuota,
                                boolean changePrice, boolean changeCurrency) {}

    /**
     * Patch rows by tenant-scoped immutable inventory UUID. Validate the
     * ENTIRE XLSX before writing anything, so invalid currency / duplicate IDs
     * never leave the database half updated.
     *
     * Currency is the denomination of unit_price. Changing it is a PRICE
     * re-denomination, not a cosmetic label: require an explicit reviewed
     * unit_price and confirm_currency_change=YES for each changed row.
     * The server never infers or invents a foreign exchange rate.
     */
    @Transactional(rollbackFor = Exception.class)
    public PatchResult patchFromXlsx(MultipartFile file, UUID tenantId, UUID companyId) {
        PatchResult result = new PatchResult();
        List<String> errors = new ArrayList<>();
        Map<UUID, PendingPatch> pending = new LinkedHashMap<>();
        int skipped = 0;

        if (file == null || file.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("Vui lòng chọn file XLSX hợp lệ.");
            return result;
        }
        try (InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getNumberOfSheets() == 0 ? null : workbook.getSheetAt(0);
            if (sheet == null || sheet.getRow(0) == null) {
                result.setSuccess(false);
                result.setMessage("Thiếu sheet hoặc dòng tiêu đề.");
                return result;
            }
            Map<String, Integer> columns = new HashMap<>();
            for (Cell cell : sheet.getRow(0)) {
                String name = getCellString(cell);
                if (name != null && !name.isBlank()) {
                    columns.put(name.trim().toLowerCase(Locale.ROOT), cell.getColumnIndex());
                }
            }
            if (!columns.containsKey("id") ||
                    !(columns.containsKey("order_to_deduction")
                    || columns.containsKey("material_quota_percentage")
                    || columns.containsKey("unit_price")
                    || columns.containsKey("currency"))) {
                result.setSuccess(false);
                result.setMessage("XLSX phải có id và ít nhất một cột order_to_deduction, material_quota_percentage, unit_price, currency.");
                return result;
            }
            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;
                String idText = getCellString(row, columns.get("id"));
                if (idText == null || idText.isBlank()) {
                    skipped++;
                    continue;
                }
                String prefix = "Dòng " + (r + 1) + ": ";
                try {
                    UUID id = UUID.fromString(idText.trim());
                    if (pending.containsKey(id)) throw new IllegalArgumentException(
                            "inventoryId bị trùng trong Excel: " + id);
                    InventoryEntity entity = inventoryRepository.findById(id)
                            .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tồn kho " + id));
                    if (!Objects.equals(tenantId, entity.getTenantId())
                            || !Objects.equals(companyId, entity.getCompanyId())) {
                        throw new IllegalArgumentException("Dòng tồn kho không thuộc tenant/company đang chọn.");
                    }
                    String oldCurrency = Objects.toString(entity.getCurrency(), "")
                            .trim().toUpperCase(Locale.ROOT);
                    String rawCurrency = getCellString(row, columns.get("currency"));
                    String newCurrency = rawCurrency == null || rawCurrency.isBlank()
                            ? oldCurrency : rawCurrency.trim().toUpperCase(Locale.ROOT);
                    if (columns.containsKey("currency") && !newCurrency.isBlank()) {
                        if (!newCurrency.matches("[A-Z]{3}"))
                            throw new IllegalArgumentException("Tiền tệ phải là mã ISO 3 ký tự.");
                        try {
                            Currency.getInstance(newCurrency);
                        } catch (IllegalArgumentException e) {
                            throw new IllegalArgumentException("Mã tiền tệ không hỗ trợ: " + newCurrency);
                        }
                    }
                    boolean changedCurrency = columns.containsKey("currency")
                            && !newCurrency.equals(oldCurrency);
                    String rawPrice = getCellString(row, columns.get("unit_price"));
                    BigDecimal newPrice = null;
                    if (rawPrice != null && !rawPrice.isBlank()) {
                        try {
                            newPrice = new BigDecimal(rawPrice.trim().replace(",", ""));
                        } catch (NumberFormatException e) {
                            throw new IllegalArgumentException("Đơn giá không hợp lệ: " + rawPrice);
                        }
                        if (newPrice.signum() < 0)
                            throw new IllegalArgumentException("Đơn giá phải không âm.");
                        if (newPrice.precision() > 24 || newPrice.scale() > 10)
                            throw new IllegalArgumentException("Đơn giá vượt quá giới hạn cho phép.");
                    }
                    if (changedCurrency) {
                        String confirm = getCellString(row, columns.get("confirm_currency_change"));
                        if (!"YES".equalsIgnoreCase(Objects.toString(confirm, "").trim()))
                            throw new IllegalArgumentException(
                                "Đổi " + (oldCurrency.isBlank() ? "(trống)" : oldCurrency) +
                                " sang " + newCurrency +
                                " cần confirm_currency_change=YES và đơn giá mới được kiểm tra.");
                        if (newPrice == null)
                            throw new IllegalArgumentException("Đổi tiền tệ phải nhập unit_price trong đồng tiền mới.");
                    }
                    // Optional stale-file guard from the generated template:
                    // a file downloaded before a different price change cannot
                    // silently overwrite that newer price.
                    String expectedCurrency = getCellString(row, columns.get("original_currency"));
                    if (expectedCurrency != null && !expectedCurrency.isBlank()
                            && !expectedCurrency.trim().equalsIgnoreCase(oldCurrency))
                        throw new IllegalArgumentException("Tiền tệ tồn kho đã đổi sau khi tải mẫu; tải lại Excel.");
                    String expectedPrice = getCellString(row, columns.get("original_unit_price"));
                    if (expectedPrice != null && !expectedPrice.isBlank()) {
                        BigDecimal compare;
                        try { compare = new BigDecimal(expectedPrice.trim().replace(",", "")); }
                        catch (NumberFormatException e) {
                            throw new IllegalArgumentException("original_unit_price không hợp lệ.");
                        }
                        if (entity.getUnitPrice() == null ||
                                entity.getUnitPrice().compareTo(compare) != 0)
                            throw new IllegalArgumentException("Giá kho đã đổi sau khi tải mẫu; tải lại Excel.");
                    }

                    String order = entity.getOrderToDeduction();
                    if (columns.containsKey("order_to_deduction")) {
                        String raw = getCellString(row, columns.get("order_to_deduction"));
                        order = raw == null || raw.isBlank() ? null : raw.trim();
                    }
                    BigDecimal quota = null;
                    String rawQuota = getCellString(row, columns.get("material_quota_percentage"));
                    if (rawQuota != null && !rawQuota.isBlank()) {
                        try { quota = new BigDecimal(rawQuota.trim()); }
                        catch (NumberFormatException e) {
                            throw new IllegalArgumentException("material_quota_percentage không hợp lệ.");
                        }
                        if (quota.signum() < 0)
                            throw new IllegalArgumentException("material_quota_percentage không thể âm.");
                    }
                    pending.put(id, new PendingPatch(entity, order, quota,
                            newPrice, newCurrency, columns.containsKey("order_to_deduction"),
                            quota != null, newPrice != null, changedCurrency));
                } catch (IllegalArgumentException ex) {
                    errors.add(prefix + ex.getMessage());
                }
            }
        } catch (Exception ex) {
            result.setSuccess(false);
            result.setMessage("Lỗi đọc XLSX: " + ex.getMessage());
            result.setErrors(errors);
            return result;
        }
        if (!errors.isEmpty()) {
            result.setSuccess(false);
            result.setMessage("Không ghi thay đổi nào: " + errors.size() + " dòng Excel không hợp lệ.");
            result.setErrors(errors);
            result.setSkipped(skipped);
            return result;
        }
        int updated = 0;
        for (PendingPatch patch : pending.values()) {
            InventoryEntity inv = patch.entity();
            boolean changed = false;
            if (patch.changeOrder() && !Objects.equals(inv.getOrderToDeduction(), patch.orderToDeduction())) {
                inv.setOrderToDeduction(patch.orderToDeduction());
                changed = true;
            }
            if (patch.changeQuota() && (inv.getMaterialQuotaPercentage() == null ||
                    inv.getMaterialQuotaPercentage().compareTo(patch.quota()) != 0)) {
                inv.setMaterialQuotaPercentage(patch.quota());
                changed = true;
            }
            if (patch.changePrice() && (inv.getUnitPrice() == null ||
                    inv.getUnitPrice().compareTo(patch.price()) != 0)) {
                inv.setUnitPrice(patch.price());
                changed = true;
            }
            if (patch.changeCurrency()) {
                inv.setCurrency(patch.currency());
                changed = true;
            }
            if (changed) {
                inv.setUpdatedAt(Instant.now());
                inventoryRepository.save(inv);
                updated++;
            } else {
                skipped++;
            }
        }
        result.setSuccess(true);
        result.setUpdated(updated);
        result.setSkipped(skipped);
        result.setErrors(List.of());
        result.setMessage("Đã cập nhật " + updated + " dòng, bỏ qua " + skipped +
                " dòng. Giá và tiền tệ được lưu đúng theo Excel, không tự tính tỷ giá.");
        return result;
    }

    // =============================================================
    // HELPERS
    // =============================================================

    private String getCellString(Row row, Integer colIndex) {

        if (row == null || colIndex == null) {
            return null;
        }

        Cell cell = row.getCell(colIndex);

        return getCellString(cell);
    }

    private String getCellString(Cell cell) {

        if (cell == null) {
            return null;
        }

        DataFormatter formatter = new DataFormatter();

        if (cell.getCellType() == CellType.BLANK) {
            return null;
        }

        String val = formatter.formatCellValue(cell);

        return val == null ? null : val.trim();
    }

    // =============================================================
    // RESULT DTO
    // =============================================================

    public static class PatchResult {

        private boolean success;
        private String message;
        private int updated;
        private int skipped;
        private List<String> errors = new ArrayList<>();

        public boolean isSuccess() {
            return success;
        }

        public void setSuccess(boolean success) {
            this.success = success;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public int getUpdated() {
            return updated;
        }

        public void setUpdated(int updated) {
            this.updated = updated;
        }

        public int getSkipped() {
            return skipped;
        }

        public void setSkipped(int skipped) {
            this.skipped = skipped;
        }

        public List<String> getErrors() {
            return errors;
        }

        public void setErrors(List<String> errors) {
            this.errors = errors;
        }
    }
}
