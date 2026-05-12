package com.ams.bomcore.service.inventory;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.InventoryRepository;

/**
 * Patch inventory records from a minimal CSV containing only:
 *   id, order_to_deduction, material_quota_percentage
 *
 * Rules:
 * - id is mandatory; rows with blank id are skipped.
 * - Only columns present in the CSV header are updated;
 *   absent columns leave the existing value unchanged.
 * - Records must belong to the given tenantId + companyId.
 * - The operation is a single transaction; any error aborts all changes.
 *
 * Expected CSV header (order does not matter, only id is required):
 *   id,order_to_deduction,material_quota_percentage
 */
@Service
public class InventoryPatchCsvService {

    private final InventoryRepository inventoryRepository;

    public InventoryPatchCsvService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    @Transactional(rollbackFor = Exception.class)
    public PatchResult patchFromCsv(MultipartFile file, UUID tenantId, UUID companyId) {
        PatchResult result = new PatchResult();
        List<String> errors = new ArrayList<>();
        int updatedCount = 0;
        int skippedCount = 0;

        try (InputStream is = file.getInputStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {

            // --- header ---
            String headerLine = reader.readLine();
            if (headerLine != null && headerLine.startsWith("\uFEFF")) {
                headerLine = headerLine.substring(1);  // strip UTF-8 BOM
            }
            
            if (headerLine == null) {
                result.setSuccess(false);
                result.setMessage("CSV file is empty");
                return result;
            }

            String[] headers = parseCsvLine(headerLine);
            Map<String, Integer> colMap = buildColumnMap(headers);

            if (!colMap.containsKey("id")) {
                result.setSuccess(false);
                result.setMessage("CSV must contain an 'id' column with the inventory UUID");
                return result;
            }

            boolean hasOrderCol    = colMap.containsKey("order_to_deduction");
            boolean hasQuotaCol    = colMap.containsKey("material_quota_percentage");
            boolean hasUnitPriceCol    = colMap.containsKey("unit_price");

            if (!hasOrderCol && !hasQuotaCol && !hasUnitPriceCol) {
                result.setSuccess(false);
                result.setMessage("CSV must contain at least one of: order_to_deduction, material_quota_percentage");
                return result;
            }

            // --- data rows ---
            String line;
            int lineNumber = 1;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) {
					continue;
				}

                String[] values = parseCsvLine(line);

                // --- resolve id ---
                String idStr = getCol(values, colMap, "id");
                if (idStr == null || idStr.isBlank()) {
                    skippedCount++;
                    continue;
                }

                UUID inventoryId;
                try {
                    inventoryId = UUID.fromString(idStr.trim());
                } catch (IllegalArgumentException e) {
                    errors.add("Line " + lineNumber + ": invalid UUID '" + idStr + "'");
                    continue;
                }

                Optional<InventoryEntity> opt = inventoryRepository.findById(inventoryId);
                if (opt.isEmpty()) {
                    errors.add("Line " + lineNumber + ": inventory not found for id=" + inventoryId);
                    continue;
                }

                InventoryEntity inv = opt.get();

                // tenant / company guard
                if (!inv.getTenantId().equals(tenantId) || !inv.getCompanyId().equals(companyId)) {
                    errors.add("Line " + lineNumber + ": id=" + inventoryId + " does not belong to this tenant/company");
                    continue;
                }

                boolean changed = false;

                // --- patch order_to_deduction ---
                if (hasOrderCol) {
                    String val = getCol(values, colMap, "order_to_deduction");
                    // empty string clears the field; null means column was missing (already handled above)
                    String newVal = (val == null || val.isBlank()) ? null : val.trim();
                    if (!java.util.Objects.equals(inv.getOrderToDeduction(), newVal)) {
                        inv.setOrderToDeduction(newVal);
                        changed = true;
                    }
                }

                // --- patch material_quota_percentage ---
                if (hasQuotaCol) {
                    String val = getCol(values, colMap, "material_quota_percentage");
                    if (val != null && !val.isBlank()) {
                        try {
                            BigDecimal quota = new BigDecimal(val.trim());
                            if (quota.compareTo(BigDecimal.ZERO) < 0) {
                                errors.add("Line " + lineNumber + ": material_quota_percentage cannot be negative");
                                continue;
                            }
                            inv.setMaterialQuotaPercentage(quota);
                            changed = true;
                        } catch (NumberFormatException e) {
                            errors.add("Line " + lineNumber + ": invalid number for material_quota_percentage: '" + val + "'");
                            continue;
                        }
                    }
                    // blank value → leave unchanged
                }

                if (hasUnitPriceCol) {
                    String val = getCol(values, colMap, "unit_price");
                    if (val != null && !val.isBlank()) {
                        try {
                            BigDecimal price = new BigDecimal(val.trim());
                            if (price.compareTo(BigDecimal.ZERO) < 0) {
                                errors.add("Line " + lineNumber + ": unit_price cannot be negative");
                                continue;
                            }
                            inv.setUnitPrice(price);
                            changed = true;
                        } catch (NumberFormatException e) {
                            errors.add("Line " + lineNumber + ": invalid number for unit_price: '" + val + "'");
                            continue;
                        }
                    }
                    // blank value → leave unchanged
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
            result.setMessage("Failed to read CSV: " + e.getMessage());
            result.setErrors(errors);
            return result;
        }

        result.setSuccess(errors.isEmpty());
        result.setUpdated(updatedCount);
        result.setSkipped(skippedCount);
        result.setErrors(errors);
        result.setMessage(String.format("Patch completed: %d updated, %d skipped, %d errors",
                updatedCount, skippedCount, errors.size()));
        return result;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Map<String, Integer> buildColumnMap(String[] headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            map.put(headers[i].trim().toLowerCase(), i);
        }
        return map;
    }

    private String[] parseCsvLine(String line) {
        return line.split(",", -1);
    }

    private String getCol(String[] values, Map<String, Integer> colMap, String name) {
        Integer idx = colMap.get(name);
        if (idx == null || idx >= values.length) {
			return null;
		}
        String v = values[idx].trim();
        return v.isEmpty() ? null : v;
    }

    // ── result DTO ────────────────────────────────────────────────────────────

    public static class PatchResult {
        private boolean success;
        private String message;
        private int updated;
        private int skipped;
        private List<String> errors = new ArrayList<>();

        public boolean isSuccess()                   { return success; }
        public void setSuccess(boolean success)      { this.success = success; }
        public String getMessage()                   { return message; }
        public void setMessage(String message)       { this.message = message; }
        public int getUpdated()                      { return updated; }
        public void setUpdated(int updated)          { this.updated = updated; }
        public int getSkipped()                      { return skipped; }
        public void setSkipped(int skipped)          { this.skipped = skipped; }
        public List<String> getErrors()              { return errors; }
        public void setErrors(List<String> errors)   { this.errors = errors; }
    }
}
