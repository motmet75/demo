package com.ams.bomcore.controller.modelbom;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;

/**
 * Utility parser that reads a CSV MultipartFile and returns parsed DTO rows
 * with basic validation applied. This does not perform any database writes.
 *
 * Expected CSV columns (in order):
 * modelCode,modelName,materialCode,qtyPerUnit[,modelId][,tenantId][,companyId][,hsCode][,coCriteria][,warehouseQty][,warehouseUnit][,bomUnitPerWarehouseUnit]
 *
 * Header row is allowed and will be skipped when detected.
 */
public class ModelBomCsvParser {

    public static class ParseResult {
        private final List<ModelBomCsvRow> rows = new ArrayList<>();
        private final List<String> errors = new ArrayList<>();

        public List<ModelBomCsvRow> getRows() {
            return rows;
        }

        public List<String> getErrors() {
            return errors;
        }

        public boolean hasErrors() {
            return !errors.isEmpty();
        }
    }

    /**
     * Parse CSV and validate basic column presence and types.
     * It will NOT check database existence of materialCode - that should be done
     * by the caller (service layer) to avoid repository coupling in parser.
     *
     * Validation performed here:
     *  - required columns exist
     *  - modelCode and materialCode are non-empty
     *  - qtyPerUnit parses as BigDecimal and is > 0
     */
    public static ParseResult parse(MultipartFile file) {
        ParseResult result = new ParseResult();
        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".csv")) {
            result.getErrors().add("Only CSV files are supported");
            return result;
        }

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            int row = 0;
            while ((line = br.readLine()) != null) {
                row++;
                if (line.trim().isEmpty()) {
					continue;
				}
                String[] cols = line.split(",");
                // header detection: first row containing column names or too few columns
                if (row == 1) {
                    String low = cols[0].toLowerCase();
                    if (low.contains("model") || low.contains("material") || cols.length < 4) {
                        // assume header row
                        continue;
                    }
                }

                if (cols.length < 4) {
                    result.getErrors().add("Row " + row + ": expected at least 4 columns (modelCode,modelName,materialCode,qtyPerUnit)");
                    continue;
                }

                String modelCode = cols[0].trim();
                String modelName = cols[1].trim();
                String materialCode = cols[2].trim();
                String qtyText = cols[3].trim();
                String warehouseQtyText = cols.length >= 10 ? cols[9].trim() : "";
                String warehouseUnitText = cols.length >= 11 ? cols[10].trim() : "";
                String bomUnitPerWarehouseUnitText = cols.length >= 12 ? cols[11].trim() : "";

                // Validate required text fields
                if (modelCode.isEmpty()) {
                    result.getErrors().add("Row " + row + ": modelCode is required and cannot be empty");
                    continue;
                }
                if (materialCode.isEmpty()) {
                    result.getErrors().add("Row " + row + ": materialCode is required and cannot be empty");
                    continue;
                }
                BigDecimal warehouseQty = null;
                BigDecimal bomUnitPerWarehouseUnit = null;
                if (!warehouseQtyText.isEmpty()) {
                    try {
                        warehouseQty = new BigDecimal(warehouseQtyText.trim());
                    } catch (Exception ex) {
                        result.getErrors().add("Row " + row + ": warehouseQty is not a valid decimal: '" + warehouseQtyText + "'");
                        continue;
                    }
                    if (warehouseQty.compareTo(BigDecimal.ZERO) <= 0) {
                        result.getErrors().add("Row " + row + ": warehouseQty must be greater than 0");
                        continue;
                    }
                }
                if (!bomUnitPerWarehouseUnitText.isEmpty()) {
                    try {
                        bomUnitPerWarehouseUnit = new BigDecimal(bomUnitPerWarehouseUnitText.trim());
                    } catch (Exception ex) {
                        result.getErrors().add("Row " + row + ": bomUnitPerWarehouseUnit is not a valid decimal: '" + bomUnitPerWarehouseUnitText + "'");
                        continue;
                    }
                    if (bomUnitPerWarehouseUnit.compareTo(BigDecimal.ZERO) <= 0) {
                        result.getErrors().add("Row " + row + ": bomUnitPerWarehouseUnit must be greater than 0");
                        continue;
                    }
                }

                BigDecimal qty = null;
                if (!qtyText.isEmpty()) {
                    try {
                        qty = new BigDecimal(qtyText.trim());
                    } catch (Exception ex) {
                        result.getErrors().add("Row " + row + ": qtyPerUnit is not a valid decimal: '" + qtyText + "'");
                        continue;
                    }
                } else if (warehouseQty != null && bomUnitPerWarehouseUnit != null) {
                    qty = warehouseQty.multiply(bomUnitPerWarehouseUnit);
                }

                if (qty == null) {
                    result.getErrors().add("Row " + row + ": qtyPerUnit is required unless warehouseQty and bomUnitPerWarehouseUnit are provided");
                    continue;
                }
                if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                    result.getErrors().add("Row " + row + ": qtyPerUnit must be greater than 0");
                    continue;
                }

                ModelBomCsvRow dto = new ModelBomCsvRow();
                dto.setModelCode(modelCode);
                dto.setModelName(modelName);
                dto.setMaterialCode(materialCode);
                dto.setQtyPerUnit(qty);
                dto.setWarehouseQty(warehouseQty);
                dto.setWarehouseUnit(warehouseUnitText.isEmpty() ? null : warehouseUnitText);
                dto.setBomUnitPerWarehouseUnit(bomUnitPerWarehouseUnit);

                // optional: try to parse model UUID if present in 5th column
                if (cols.length >= 5) {
                    String idText = cols[4].trim();
                    if (!idText.isEmpty()) {
                        try {
                            UUID mid = UUID.fromString(idText);
                            dto.setModelId(mid);
                        } catch (Exception ignored) {
                            // invalid uuid in optional column -> collect warning but continue
                            result.getErrors().add("Row " + row + ": invalid model UUID, ignoring: '" + idText + "'");
                        }
                    }
                }

                // optional tenantId in 6th column
                if (cols.length >= 6) {
                    String tText = cols[5].trim();
                    if (!tText.isEmpty()) {
                        try {
                            UUID tid = UUID.fromString(tText);
                            dto.setTenantId(tid);
                        } catch (Exception ignored) {
                            result.getErrors().add("Row " + row + ": invalid tenant UUID, ignoring: '" + tText + "'");
                        }
                    }
                }

                // optional companyId in 7th column
                if (cols.length >= 7) {
                    String cText = cols[6].trim();
                    if (!cText.isEmpty()) {
                        try {
                            UUID cid = UUID.fromString(cText);
                            dto.setCompanyId(cid);
                        } catch (Exception ignored) {
                            result.getErrors().add("Row " + row + ": invalid company UUID, ignoring: '" + cText + "'");
                        }
                    }
                }

                // optional hs_code in 8th column
                if (cols.length >= 8) {
                    String hs = cols[7].trim();
                    if (!hs.isEmpty()) {
                        dto.setHsCode(hs);
                    }
                }

                // optional co_criteria in 9th column
                if (cols.length >= 9) {
                    String co = cols[8].trim();
                    if (!co.isEmpty()) {
                        dto.setCoCriteria(co);
                    }
                }

                result.getRows().add(dto);
            }
        } catch (Exception e) {
            result.getErrors().add("Failed to parse file: " + e.getMessage());
        }

        return result;
    }
}