package com.ams.bomcore.controller.contract;

import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.validation.Valid;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.ams.bomcore.domain.contract.Contract;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.ContractRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.contract.ContractService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/contracts")
public class ContractController {

    private final ContractService contractService;
    private final ContractRepository contractRepository;
    private final CompanyRepository companyRepository;
    private final TenantRepository tenantRepository;

    public ContractController(ContractService contractService, ContractRepository contractRepository, CompanyRepository companyRepository, TenantRepository tenantRepository) {
        this.contractService = contractService;
        this.contractRepository = contractRepository;
        this.companyRepository = companyRepository;
        this.tenantRepository = tenantRepository;
    }

    private UUID resolveTenant(UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    private UUID resolveCompany(UUID companyId, String headerCompanyId) {
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            try { return UUID.fromString(headerCompanyId); } catch (Exception e) { }
        }
        return companyId;
    }

    @GetMapping
    public List<ContractDTO> list(
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("company does not belong to tenant");
        }

        List<Contract> contracts = contractService.findAllByCompany(company);
        return contracts.stream().map(ContractDTO::fromEntity).collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") UUID id) {
        Optional<Contract> oc = contractService.findById(id);
        return oc.map(c -> ResponseEntity.ok(ContractDTO.fromEntity(c)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Contract contract,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // uniqueness check per company
        if (contract.getContractNumber() != null && !contract.getContractNumber().isBlank()) {
            Optional<Contract> existing = contractRepository.findByContractNumberAndCompany(contract.getContractNumber(), company);
            if (existing.isPresent()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("contract_number already exists for this company");
            }
        }

        Contract saved = contractService.createForCompany(contract, company, tenant);
        return ResponseEntity.status(HttpStatus.CREATED).body(ContractDTO.fromEntity(saved));
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id,
                                    @Valid @RequestBody Contract contract,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

        if (!contractRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        contract.setId(id);
        Contract saved = contractService.updateForCompany(contract, company, tenant);
        return ResponseEntity.ok(ContractDTO.fromEntity(saved));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!contractRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        contractService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> importExcel(@RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ImportResult.error("companyId is required for import"));
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".xlsx") && !filename.toLowerCase().endsWith(".xls")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ImportResult.error("Only Excel (.xlsx/.xls) files are supported currently"));
        }

        List<String> errors = new ArrayList<>();
        List<Contract> toSave = new ArrayList<>();
        try (InputStream is = file.getInputStream(); XSSFWorkbook workbook = new XSSFWorkbook(is)) {
            Sheet sheet = workbook.getSheetAt(0);
            int rowNum = 0;
            for (Row row : sheet) {
                rowNum++;
                if (rowNum == 1) {
                    // assume header, skip
                    continue;
                }
                // columns expected: contractNumber, title, supplierCompanyId, status, startDate (ISO), endDate (ISO), totalValue, currency
                String contractNumber = getStringCell(row, 0);
                String title = getStringCell(row, 1);
                String supplierCompanyIdStr = getStringCell(row, 2);
                String status = getStringCell(row, 3);
                String startDateStr = getStringCell(row, 4);
                String endDateStr = getStringCell(row, 5);
                String totalValueStr = getStringCell(row, 6);
                String currency = getStringCell(row, 7);

                if (contractNumber == null || contractNumber.isBlank()) {
                    errors.add("Row " + rowNum + ": contractNumber is required");
                    continue;
                }

                UUID supplierCompanyId = null;
                if (supplierCompanyIdStr != null && !supplierCompanyIdStr.isBlank()) {
                    try { supplierCompanyId = UUID.fromString(supplierCompanyIdStr.trim()); } catch (Exception ex) { errors.add("Row " + rowNum + ": invalid supplierCompanyId"); continue; }
                } else {
                    errors.add("Row " + rowNum + ": supplierCompanyId is required");
                    continue;
                }

                Company supplierCompany = companyRepository.findById(supplierCompanyId).orElse(null);
                if (supplierCompany == null) {
                    errors.add("Row " + rowNum + ": supplierCompany not found: " + supplierCompanyIdStr);
                    continue;
                }

                // uniqueness check within company
                Optional<Contract> existing = contractRepository.findByContractNumberAndCompany(contractNumber, company);
                if (existing.isPresent()) {
                    errors.add("Row " + rowNum + ": contractNumber already exists for this company");
                    continue;
                }

                Contract c = new Contract();
                c.setContractNumber(contractNumber);
                c.setTitle(title);
                c.setSupplierCompany(supplierCompany);
                c.setCompany(company);
                c.setTenant(tenant);
                c.setStatus(status == null ? "DRAFT" : status);
                try { if (startDateStr != null && !startDateStr.isBlank()) c.setStartDate(Instant.parse(startDateStr)); } catch (Exception ex) { errors.add("Row " + rowNum + ": invalid startDate"); }
                try { if (endDateStr != null && !endDateStr.isBlank()) c.setEndDate(Instant.parse(endDateStr)); } catch (Exception ex) { errors.add("Row " + rowNum + ": invalid endDate"); }
                try { if (totalValueStr != null && !totalValueStr.isBlank()) c.setTotalValue(new BigDecimal(totalValueStr)); } catch (Exception ex) { errors.add("Row " + rowNum + ": invalid totalValue"); }
                c.setCurrency(currency);

                toSave.add(c);
            }

            if (!toSave.isEmpty()) {
                List<Contract> saved = contractRepository.saveAll(toSave);
                return ResponseEntity.ok(ImportResult.success(saved.size(), errors));
            } else {
                return ResponseEntity.ok(ImportResult.success(0, errors));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ImportResult.error("Failed to parse file: " + e.getMessage()));
        }
    }

    @GetMapping(path = "/export", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<StreamingResponseBody> exportToExcel(@RequestParam(value = "ids", required = false) List<String> ids) {
        List<String> incoming = ids == null ? new ArrayList<>() : new ArrayList<>(ids);
        List<UUID> uuidList = incoming.stream().map(s -> {
            try { return UUID.fromString(s.trim()); } catch (Exception e) { return null; }
        }).filter(u -> u != null).collect(Collectors.toList());

        List<Contract> list = uuidList.isEmpty() ? new ArrayList<>() : contractRepository.findAllById(uuidList);

        StreamingResponseBody stream = (OutputStream os) -> {
            try (XSSFWorkbook workbook = new XSSFWorkbook()) {
                Sheet sheet = workbook.createSheet("Contracts");
                int rownum = 0;
                Row header = sheet.createRow(rownum++);
                String[] headers = new String[] { "ID", "ContractNumber", "Title", "SupplierCompanyId", "PurchasingCompanyId", "Status", "StartDate", "EndDate", "TotalValue", "Currency", "Notes" };
                for (int i = 0; i < headers.length; i++) {
                    Cell c = header.createCell(i);
                    c.setCellValue(headers[i]);
                }

                for (Contract c : list) {
                    Row r = sheet.createRow(rownum++);
                    r.createCell(0).setCellValue(c.getId() == null ? "" : c.getId().toString());
                    r.createCell(1).setCellValue(c.getContractNumber() == null ? "" : c.getContractNumber());
                    r.createCell(2).setCellValue(c.getTitle() == null ? "" : c.getTitle());
                    r.createCell(3).setCellValue(c.getSupplierCompany() == null ? "" : c.getSupplierCompany().getId().toString());
                    r.createCell(4).setCellValue(c.getPurchasingCompany() == null ? "" : c.getPurchasingCompany().getId().toString());
                    r.createCell(5).setCellValue(c.getStatus() == null ? "" : c.getStatus());
                    r.createCell(6).setCellValue(c.getStartDate() == null ? "" : c.getStartDate().toString());
                    r.createCell(7).setCellValue(c.getEndDate() == null ? "" : c.getEndDate().toString());
                    r.createCell(8).setCellValue(c.getTotalValue() == null ? "" : c.getTotalValue().toString());
                    r.createCell(9).setCellValue(c.getCurrency() == null ? "" : c.getCurrency());
                    r.createCell(10).setCellValue(c.getNotes() == null ? "" : c.getNotes());
                }

                for (int i = 0; i < headers.length; i++) sheet.autoSizeColumn(i);
                workbook.write(os);
                os.flush();
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=contracts_selected_export.xlsx");
        headers.add(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        return ResponseEntity.ok().headers(headers).body(stream);
    }

    private static String getStringCell(Row row, int idx) {
        Cell c = row.getCell(idx);
        if (c == null) return null;
        switch (c.getCellType()) {
            case STRING: return c.getStringCellValue();
            case NUMERIC: return String.valueOf(c.getNumericCellValue());
            case BOOLEAN: return String.valueOf(c.getBooleanCellValue());
            default: return c.toString();
        }
    }

    public static class ImportResult {
        private boolean success;
        private String message;
        private int created;
        private List<String> errors = new ArrayList<>();

        public static ImportResult success(int created, List<String> errors) {
            ImportResult r = new ImportResult();
            r.success = true;
            r.message = "Imported";
            r.created = created;
            r.errors = errors == null ? new ArrayList<>() : errors;
            return r;
        }

        public static ImportResult error(String message) {
            ImportResult r = new ImportResult();
            r.success = false;
            r.message = message;
            return r;
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public int getCreated() { return created; }
        public void setCreated(int created) { this.created = created; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
    }
}
