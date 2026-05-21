package com.ams.bomcore.service.inventory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
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

    @Transactional(rollbackFor = Exception.class)
    public PatchResult patchFromXlsx(MultipartFile file, UUID tenantId, UUID companyId) {

        PatchResult result = new PatchResult();

        List<String> errors = new ArrayList<>();

        int updatedCount = 0;
        int skippedCount = 0;

        try (
                InputStream is = file.getInputStream();
                Workbook workbook = new XSSFWorkbook(is)
        ) {

            Sheet sheet = workbook.getSheetAt(0);

            if (sheet == null) {
                result.setSuccess(false);
                result.setMessage("XLSX sheet is empty");
                return result;
            }

            Row headerRow = sheet.getRow(0);

            if (headerRow == null) {
                result.setSuccess(false);
                result.setMessage("Missing header row");
                return result;
            }

            Map<String, Integer> colMap = new HashMap<>();

            for (Cell cell : headerRow) {
                String name = getCellString(cell);

                if (name != null && !name.isBlank()) {
                    colMap.put(name.trim().toLowerCase(), cell.getColumnIndex());
                }
            }

            if (!colMap.containsKey("id")) {
                result.setSuccess(false);
                result.setMessage("XLSX must contain 'id' column");
                return result;
            }

            boolean hasOrderCol = colMap.containsKey("order_to_deduction");
            boolean hasQuotaCol = colMap.containsKey("material_quota_percentage");
            boolean hasUnitPriceCol = colMap.containsKey("unit_price");

            if (!hasOrderCol && !hasQuotaCol && !hasUnitPriceCol) {
                result.setSuccess(false);
                result.setMessage(
                        "XLSX must contain at least one of: order_to_deduction, material_quota_percentage, unit_price"
                );
                return result;
            }

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {

                Row row = sheet.getRow(r);

                if (row == null) {
                    continue;
                }

                String idStr = getCellString(row, colMap.get("id"));

                if (idStr == null || idStr.isBlank()) {
                    skippedCount++;
                    continue;
                }

                UUID inventoryId;

                try {
                    inventoryId = UUID.fromString(idStr.trim());
                } catch (Exception e) {
                    errors.add("Row " + (r + 1) + ": invalid UUID '" + idStr + "'");
                    continue;
                }

                Optional<InventoryEntity> opt = inventoryRepository.findById(inventoryId);

                if (opt.isEmpty()) {
                    errors.add("Row " + (r + 1) + ": inventory not found for id=" + inventoryId);
                    continue;
                }

                InventoryEntity inv = opt.get();

                if (!inv.getTenantId().equals(tenantId)
                        || !inv.getCompanyId().equals(companyId)) {

                    errors.add(
                            "Row " + (r + 1)
                                    + ": id=" + inventoryId
                                    + " does not belong to this tenant/company"
                    );
                    continue;
                }

                boolean changed = false;

                // =====================================================
                // order_to_deduction
                // =====================================================

                if (hasOrderCol) {

                    String val = getCellString(
                            row,
                            colMap.get("order_to_deduction")
                    );

                    String newVal =
                            (val == null || val.isBlank())
                                    ? null
                                    : val.trim();

                    if (!java.util.Objects.equals(
                            inv.getOrderToDeduction(),
                            newVal
                    )) {
                        inv.setOrderToDeduction(newVal);
                        changed = true;
                    }
                }

                // =====================================================
                // material_quota_percentage
                // =====================================================

                if (hasQuotaCol) {

                    String val = getCellString(
                            row,
                            colMap.get("material_quota_percentage")
                    );

                    if (val != null && !val.isBlank()) {

                        try {

                            BigDecimal quota = new BigDecimal(val.trim());

                            if (quota.compareTo(BigDecimal.ZERO) < 0) {
                                errors.add(
                                        "Row " + (r + 1)
                                                + ": material_quota_percentage cannot be negative"
                                );
                                continue;
                            }

                            inv.setMaterialQuotaPercentage(quota);
                            changed = true;

                        } catch (Exception e) {

                            errors.add(
                                    "Row " + (r + 1)
                                            + ": invalid material_quota_percentage '"
                                            + val
                                            + "'"
                            );
                            continue;
                        }
                    }
                }

                // =====================================================
                // unit_price
                // =====================================================

                if (hasUnitPriceCol) {

                    String val = getCellString(
                            row,
                            colMap.get("unit_price")
                    );

                    if (val != null && !val.isBlank()) {

                        try {

                            BigDecimal price = new BigDecimal(val.trim());

                            if (price.compareTo(BigDecimal.ZERO) < 0) {
                                errors.add(
                                        "Row " + (r + 1)
                                                + ": unit_price cannot be negative"
                                );
                                continue;
                            }

                            inv.setUnitPrice(price);
                            changed = true;

                        } catch (Exception e) {

                            errors.add(
                                    "Row " + (r + 1)
                                            + ": invalid unit_price '"
                                            + val
                                            + "'"
                            );
                            continue;
                        }
                    }
                }

                if (changed) {
                    inv.setUpdatedAt(Instant.now());
                    inventoryRepository.save(inv);
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            }

        } catch (Exception e) {

            result.setSuccess(false);
            result.setMessage("Failed to read XLSX: " + e.getMessage());
            result.setErrors(errors);

            return result;
        }

        result.setSuccess(errors.isEmpty());
        result.setUpdated(updatedCount);
        result.setSkipped(skippedCount);
        result.setErrors(errors);

        result.setMessage(
                String.format(
                        "Patch completed: %d updated, %d skipped, %d errors",
                        updatedCount,
                        skippedCount,
                        errors.size()
                )
        );

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
