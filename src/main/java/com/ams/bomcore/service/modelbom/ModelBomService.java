package com.ams.bomcore.service.modelbom;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.service.bom.BomService;
import com.ams.bomcore.service.model.ModelService;

@Service
public class ModelBomService {

    private final ModelBomRepository modelBomRepository;
    private final ModelRepository modelRepository;
    private final MaterialRepository materialRepository;
    private final ModelService modelService;
    private BomService bomService; // setter-injected to avoid circular dependency

    public ModelBomService(ModelBomRepository modelBomRepository, ModelRepository modelRepository, MaterialRepository materialRepository, ModelService modelService) {
        this.modelBomRepository = modelBomRepository;
        this.modelRepository = modelRepository;
        this.materialRepository = materialRepository;
        this.modelService = modelService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public void setBomService(BomService bomService) {
        this.bomService = bomService;
    }

    public ModelBom create(ModelBom modelBom) {
        return modelBomRepository.save(modelBom);
    }

    public List<ModelBom> findAll() {
        return modelBomRepository.findAll();
    }

    public void delete(UUID id) {
        modelBomRepository.deleteById(id);
    }

    /**
     * Find all model BOMs by model ID.
     */
    public List<ModelBom> findAllByModelId(UUID modelId) {
        return modelBomRepository.findAllByModelId(modelId);
    }

    /**
     * Find all model BOMs by model ID with tenant/company scope.
     */
    public List<ModelBom> findAllByModelIdAndTenantAndCompany(UUID modelId, UUID tenantId, UUID companyId) {
        return modelBomRepository.findAllByModelIdAndTenantIdAndCompanyId(modelId, tenantId, companyId);
    }

    /**
     * Find all model BOMs by tenant and company.
     */
    public List<ModelBom> findAllByTenantAndCompany(UUID tenantId, UUID companyId) {
        return modelBomRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
    }

    /**
     * Get a model BOM by ID.
     */
    public java.util.Optional<ModelBom> getById(UUID id) {
        return modelBomRepository.findById(id);
    }

    /**
     * Create a new model BOM entry.
     */
    @Transactional(rollbackFor = Exception.class)
    public ModelBom createModelBom(UUID modelId, UUID materialId, java.math.BigDecimal qtyPerUnit, UUID tenantId, UUID companyId) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));

        // Check if already exists
        java.util.Optional<ModelBom> existing = modelBomRepository.findByModelAndMaterialAndTenantIdAndCompanyId(model, material, tenantId, companyId);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("ModelBom already exists for this model and material");
        }

        ModelBom modelBom = new ModelBom();
        modelBom.setModel(model);
        modelBom.setMaterial(material);
        modelBom.setQtyPerUnit(qtyPerUnit);
        modelBom.setTenantId(tenantId);
        modelBom.setCompanyId(companyId);

        return modelBomRepository.save(modelBom);
    }

    /**
     * Update an existing model BOM entry.
     */
    @Transactional(rollbackFor = Exception.class)
    public ModelBom updateModelBom(UUID id, UUID materialId, java.math.BigDecimal qtyPerUnit, UUID tenantId, UUID companyId) {
        ModelBom modelBom = modelBomRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("ModelBom not found: " + id));

        if (materialId != null) {
            Material material = materialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));
            modelBom.setMaterial(material);
        }

        if (qtyPerUnit != null) {
            modelBom.setQtyPerUnit(qtyPerUnit);
        }

        modelBom.setTenantId(tenantId);
        modelBom.setCompanyId(companyId);

        return modelBomRepository.save(modelBom);
    }

    /**
     * Delete all model BOMs for a model.
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteAllByModelId(UUID modelId) {
        Model model = modelRepository.findById(modelId).orElse(null);
        if (model != null) {
            modelBomRepository.deleteAllByModel(model);
        }
    }

    public static class ImportResult {
        private int modelsCreated = 0;
        private int modelBomsCreated = 0;
        private int modelBomsUpdated = 0;
        private final List<String> errors = new ArrayList<>();

        public int getModelsCreated() { return modelsCreated; }
        public void setModelsCreated(int modelsCreated) { this.modelsCreated = modelsCreated; }
        public int getModelBomsCreated() { return modelBomsCreated; }
        public void setModelBomsCreated(int modelBomsCreated) { this.modelBomsCreated = modelBomsCreated; }
        public int getModelBomsUpdated() { return modelBomsUpdated; }
        public void setModelBomsUpdated(int modelBomsUpdated) { this.modelBomsUpdated = modelBomsUpdated; }
        public List<String> getErrors() { return errors; }
        public boolean hasErrors() { return !errors.isEmpty(); }
    }

    /**
     * Import parsed CSV rows (no persistence done by parser). This method is transactional
     * and will create/reuse Models and create/update ModelBom entries.
     *
     * Rules enforced:
     * - Fail fast if any materialCode in the input does not exist in DB
     * - No duplicate modelCode+materialCode combos in input (error if duplicates)
     * - When a ModelBom exists, update its qtyPerUnit; otherwise create new ModelBom
     * - Group rows by modelCode and create Model if missing
     * - Detect existing duplicate ModelBom records in DB and fail to avoid silent merges
     */
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromParsedRows(List<ModelBomCsvRow> rows, UUID tenantId, UUID companyId) {
        ImportResult result = new ImportResult();
        if (rows == null || rows.isEmpty()) {
			return result;
		}

        // Validate duplicates in input: modelCode + materialCode combos
        Set<String> seenCombos = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            ModelBomCsvRow r = rows.get(i);
            String key = (r.getModelCode() == null ? "" : r.getModelCode().trim()) + "::" + (r.getMaterialCode() == null ? "" : r.getMaterialCode().trim());
            if (seenCombos.contains(key)) {
                result.getErrors().add("Duplicate row in input for modelCode+materialCode at input row index " + (i + 1) + ": " + key);
            } else {
                seenCombos.add(key);
            }
        }
        if (result.hasErrors()) {
			return result; // fail fast on duplicate inputs
		}

        // Gather distinct material codes and verify they exist
        Set<String> materialCodes = rows.stream().map(r -> r.getMaterialCode().trim()).collect(Collectors.toSet());
        Map<String, Material> materialByCode = new HashMap<>();
        for (String mc : materialCodes) {
            if (companyId != null) {
                materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(mc, tenantId, companyId).ifPresent(m -> materialByCode.put(mc, m));
            } else {
              //  materialRepository.findByMaterialCode(mc).ifPresent(m -> materialByCode.put(mc, m));
            }
        }
        List<String> missingMaterials = materialCodes.stream().filter(mc -> !materialByCode.containsKey(mc)).collect(Collectors.toList());
        if (!missingMaterials.isEmpty()) {
            // Fail fast as required
            result.getErrors().add("Missing materials: " + String.join(", ", missingMaterials));
            return result;
        }

        // Group rows by modelCode
        Map<String, List<ModelBomCsvRow>> byModel = rows.stream().collect(Collectors.groupingBy(r -> r.getModelCode().trim()));

        // Pre-check existing DB ModelBom duplicates for existing models (before any writes)
        Set<String> modelCodes = byModel.keySet();
        Map<String, Model> existingModels = new HashMap<>();
        for (String mc : modelCodes) {
            // tenant-aware model lookup; if companyId provided prefer tenant+company lookup
            if (companyId != null) {
                modelRepository.findByModelCodeAndTenantIdAndCompanyId(mc, tenantId, companyId).ifPresent(m -> existingModels.put(mc, m));
            } else {
               // modelRepository.findByModelCodeAndTenantId(mc, tenantId).ifPresent(m -> existingModels.put(mc, m));
            }
        }

        for (Map.Entry<String, List<ModelBomCsvRow>> e : byModel.entrySet()) {
            String modelCode = e.getKey();
            Model model = existingModels.get(modelCode);
            if (model == null) {
				continue; // nothing to check for models that will be created
			}
            List<ModelBomCsvRow> modelRows = e.getValue();
            for (ModelBomCsvRow row : modelRows) {
                String mcode = row.getMaterialCode().trim();
                Material material = materialByCode.get(mcode);
                List<ModelBom> existingList = modelBomRepository.findAllByModelAndMaterial(model, material);
                if (existingList != null && existingList.size() > 1) {
                    result.getErrors().add("Database contains duplicate ModelBom records for modelCode='" + modelCode + "' and materialCode='" + mcode + "'; please clean data before importing");
                }
            }
        }
        if (result.hasErrors()) {
			return result; // fail fast if DB is inconsistent
		}

        // Now perform creation/upsert within the transaction
        for (Map.Entry<String, List<ModelBomCsvRow>> e : byModel.entrySet()) {
            String modelCode = e.getKey();
            List<ModelBomCsvRow> modelRows = e.getValue();

            // find existing model (tenant-scoped)
            Model model = null;
            if (companyId != null) {
                model = modelRepository.findByModelCodeAndTenantIdAndCompanyId(modelCode, tenantId, companyId).orElse(null);
            } else {
                model = modelRepository.findByModelCodeAndTenantId(modelCode, tenantId).orElse(null);
            }
            boolean createdModel = false;
            if (model == null) {
                // create new model
                Model newModel = new Model();
                if (modelRows.size() > 0) {
                    ModelBomCsvRow first = modelRows.get(0);
                    newModel.setModelCode(first.getModelCode());
                    newModel.setModelName(first.getModelName());
                    newModel.setTenantId(tenantId);
                    if (companyId != null) {
						newModel.setCompanyId(companyId);
					}
                    // Apply new fields from SQL schema
                    if (first.getHsCode() != null) {
						newModel.setHsCode(first.getHsCode());
					}
                    if (first.getCoCriteria() != null) {
						newModel.setCoCriteria(first.getCoCriteria());
					}
                } else {
                    newModel.setModelCode(modelCode);
                    newModel.setModelName(modelCode);
                    newModel.setTenantId(tenantId);
                    if (companyId != null) {
						newModel.setCompanyId(companyId);
					}
                }
                model = modelService.createForTenant(newModel, tenantId);
                createdModel = true;
                result.setModelsCreated(result.getModelsCreated() + 1);
            }

            // For each row for this model, create or update ModelBom
            for (ModelBomCsvRow row : modelRows) {
                String mcode = row.getMaterialCode().trim();
                Material material = materialByCode.get(mcode);

                // normalize qtyPerUnit to DB scale and rounding
                BigDecimal normalizedQty = row.getQtyPerUnit() == null ? null : row.getQtyPerUnit().setScale(4, RoundingMode.HALF_UP);

                // find existing ModelBom by model+material
                List<ModelBom> existingList = modelBomRepository.findAllByModelAndMaterial(model, material);
                ModelBom existing = (existingList != null && !existingList.isEmpty()) ? existingList.get(0) : null;
                if (existing != null) {
                    // update qtyPerUnit if changed
                    BigDecimal oldQty = existing.getQtyPerUnit();
                    BigDecimal oldNormalized = oldQty == null ? null : oldQty.setScale(4, RoundingMode.HALF_UP);
                    if (oldNormalized == null || (normalizedQty != null && oldNormalized.compareTo(normalizedQty) != 0)) {
                        existing.setQtyPerUnit(normalizedQty);
                        // ensure tenantId on existing record
                        existing.setTenantId(tenantId);
                        modelBomRepository.save(existing);
                        result.setModelBomsUpdated(result.getModelBomsUpdated() + 1);
                    }
                } else {
                    ModelBom mb = new ModelBom();
                    mb.setModel(model);
                    mb.setMaterial(material);
                    mb.setQtyPerUnit(normalizedQty);
                    mb.setTenantId(tenantId);
                    mb.setCompanyId(companyId);
                    modelBomRepository.save(mb);
                    result.setModelBomsCreated(result.getModelBomsCreated() + 1);
                }
            }
            // After all rows for this model are written, auto-sync the BOM
            if (bomService != null) {
                try {
                    bomService.syncBomFromModelBoms(model.getId(), tenantId, companyId);
                } catch (Exception ex) {
                    // Non-fatal: log and continue. BOM can be manually synced later.
                    result.getErrors().add("BOM auto-sync warning for model '" + modelCode + "': " + ex.getMessage());
                }
            }
        }

        return result;
    }

    /**
     * Import parsed rows into an existing Model specified by modelId (bomId). This method
     * validates materials exist, ensures model belongs to tenant, then creates/updates ModelBom
     * records for the provided rows (rows' modelCode values are ignored and modelId is used).
     */
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importIntoModel(List<ModelBomCsvRow> rows, UUID tenantId, UUID companyId, UUID modelId) {
        ImportResult result = new ImportResult();
        if (rows == null || rows.isEmpty()) {
			return result;
		}

        // Validate tenant and model existence
        Model model = modelRepository.findById(modelId).orElse(null);
        if (model == null) {
            result.getErrors().add("Model with id " + modelId + " not found");
            return result;
        }
        if (model.getTenantId() == null || !model.getTenantId().equals(tenantId)) {
            result.getErrors().add("Model does not belong to the specified tenant");
            return result;
        }
        if (companyId != null && model.getCompanyId() != null && !model.getCompanyId().equals(companyId)) {
            result.getErrors().add("Model does not belong to the specified company");
            return result;
        }

        // Validate duplicate material codes in input
        Set<String> seenMaterials = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            String mcode = rows.get(i).getMaterialCode() == null ? "" : rows.get(i).getMaterialCode().trim();
            if (seenMaterials.contains(mcode)) {
                result.getErrors().add("Duplicate materialCode in input at row " + (i + 1) + ": " + mcode);
            } else {
                seenMaterials.add(mcode);
            }
        }
        if (result.hasErrors()) {
			return result;
		}

        // Gather distinct material codes and verify they exist
        Set<String> materialCodes = rows.stream().map(r -> r.getMaterialCode().trim()).collect(Collectors.toSet());
        Map<String, Material> materialByCode = new HashMap<>();
        for (String mc : materialCodes) {
            if (companyId != null) {
                materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(mc, tenantId, companyId).ifPresent(m -> materialByCode.put(mc, m));
            } else {
              //  materialRepository.findByMaterialCode(mc).ifPresent(m -> materialByCode.put(mc, m));
            }
        }
        List<String> missingMaterials = materialCodes.stream().filter(mc -> !materialByCode.containsKey(mc)).collect(Collectors.toList());
        if (!missingMaterials.isEmpty()) {
            result.getErrors().add("Missing materials: " + String.join(", ", missingMaterials));
            return result;
        }

        // Pre-check DB duplicates for material within this model
        for (String mc : materialCodes) {
            Material mat = materialByCode.get(mc);
            List<ModelBom> existingList = modelBomRepository.findAllByModelAndMaterial(model, mat);
            if (existingList != null && existingList.size() > 1) {
                result.getErrors().add("Database contains duplicate ModelBom records for modelId='" + modelId + "' and materialCode='" + mc + "' -- clean DB first");
            }
        }
        if (result.hasErrors()) {
			return result;
		}

        // Now create/update records
        for (ModelBomCsvRow row : rows) {
            String mcode = row.getMaterialCode().trim();
            Material material = materialByCode.get(mcode);
            BigDecimal normalizedQty = row.getQtyPerUnit() == null ? null : row.getQtyPerUnit().setScale(4, RoundingMode.HALF_UP);

            List<ModelBom> existingList = modelBomRepository.findAllByModelAndMaterial(model, material);
            ModelBom existing = (existingList != null && !existingList.isEmpty()) ? existingList.get(0) : null;
            if (existing != null) {
                BigDecimal oldQty = existing.getQtyPerUnit();
                BigDecimal oldNormalized = oldQty == null ? null : oldQty.setScale(4, RoundingMode.HALF_UP);
                if (oldNormalized == null || (normalizedQty != null && oldNormalized.compareTo(normalizedQty) != 0)) {
                    existing.setQtyPerUnit(normalizedQty);
                    existing.setTenantId(tenantId);
                    modelBomRepository.save(existing);
                    result.setModelBomsUpdated(result.getModelBomsUpdated() + 1);
                }
            } else {
                ModelBom mb = new ModelBom();
                mb.setModel(model);
                mb.setMaterial(material);
                mb.setQtyPerUnit(normalizedQty);
                mb.setTenantId(tenantId);
                mb.setCompanyId(companyId);
                modelBomRepository.save(mb);
                result.setModelBomsCreated(result.getModelBomsCreated() + 1);
            }
        }

        // Auto-sync BOM for this model after import
        if (bomService != null) {
            try {
                bomService.syncBomFromModelBoms(modelId, tenantId, companyId);
            } catch (Exception ex) {
                result.getErrors().add("BOM auto-sync warning: " + ex.getMessage());
            }
        }

        return result;
    }
}