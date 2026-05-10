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
                
                String qtyStr = getCellValue(row, columnMap, "qty_per_unit", formatter);
                if (qtyStr != null) {
                    dto.setQtyPerUnit(new BigDecimal(qtyStr.replace(",", "")));
                }

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
        return formatter.formatCellValue(cell).trim();
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