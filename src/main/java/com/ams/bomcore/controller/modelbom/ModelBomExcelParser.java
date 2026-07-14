package com.ams.bomcore.controller.modelbom;

import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.web.multipart.MultipartFile;
import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;

public class ModelBomExcelParser {

    public static ParseResult parse(MultipartFile file) {
        ParseResult result = new ParseResult();
        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                result.getErrors().add("Excel file is empty");
                return result;
            }

            Map<String, Integer> columnMap = new HashMap<>();
            for (Cell cell : headerRow) {
                columnMap.put(cell.getStringCellValue().trim().toLowerCase(), cell.getColumnIndex());
            }

            DataFormatter formatter = new DataFormatter();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                ModelBomCsvRow dto = new ModelBomCsvRow();
                dto.setModelCode(getCellValue(row, columnMap, "model_code", formatter));
                dto.setModelName(getCellValue(row, columnMap, "model_name", formatter));
                dto.setMaterialCode(getCellValue(row, columnMap, "material_code", formatter));
                
                BigDecimal qtyPerUnit = parseDecimal(firstCellValue(row, columnMap, formatter, "qty_per_unit", "bom_qty", "bom_quantity"));
                BigDecimal warehouseQty = parseDecimal(firstCellValue(row, columnMap, formatter, "warehouse_qty", "warehouse_quantity", "warehouse_import_quantity"));
                BigDecimal bomUnitPerWarehouseUnit = parseDecimal(firstCellValue(row, columnMap, formatter, "bom_unit_per_warehouse_unit", "bom_qty_per_warehouse_unit", "conversion_factor"));

                dto.setWarehouseQty(warehouseQty);
                dto.setWarehouseUnit(firstCellValue(row, columnMap, formatter, "warehouse_unit", "warehouse_import_unit", "import_unit"));
                dto.setBomUnitPerWarehouseUnit(bomUnitPerWarehouseUnit);

                if (qtyPerUnit == null && warehouseQty != null && bomUnitPerWarehouseUnit != null) {
                    qtyPerUnit = warehouseQty.multiply(bomUnitPerWarehouseUnit);
                }
                dto.setQtyPerUnit(qtyPerUnit);

                result.getRows().add(dto);
            }
        } catch (Exception e) {
            result.getErrors().add("Excel error: " + e.getMessage());
        }
        return result;
    }

    private static String getCellValue(Row row, Map<String, Integer> map, String colName, DataFormatter formatter) {
        Integer idx = map.get(colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        String value = formatter.formatCellValue(cell).trim();
        return value.isBlank() ? null : value;
    }

    private static String firstCellValue(Row row, Map<String, Integer> map, DataFormatter formatter, String... colNames) {
        for (String colName : colNames) {
            String value = getCellValue(row, map, colName, formatter);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static BigDecimal parseDecimal(String value) {
        if (value == null || value.isBlank()) return null;
        return new BigDecimal(value.replace(",", "").trim());
    }

    private static boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    public static class ParseResult {
        private final List<ModelBomCsvRow> rows = new ArrayList<>();
        private final List<String> errors = new ArrayList<>();
        public List<ModelBomCsvRow> getRows() { return rows; }
        public List<String> getErrors() { return errors; }
        public boolean hasErrors() { return !errors.isEmpty(); }
    }
}