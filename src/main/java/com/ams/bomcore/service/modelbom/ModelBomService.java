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
import com.ams.bomcore.service.model.ModelService;

@Service
public class ModelBomService {

    private final ModelBomRepository modelBomRepository;
    private final ModelRepository modelRepository;
    private final MaterialRepository materialRepository;
    private final ModelService modelService;

    public ModelBomService(ModelBomRepository modelBomRepository, ModelRepository modelRepository, MaterialRepository materialRepository, ModelService modelService) {
        this.modelBomRepository = modelBomRepository;
        this.modelRepository = modelRepository;
        this.materialRepository = materialRepository;
        this.modelService = modelService;
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
    public ImportResult importFromParsedRows(List<ModelBomCsvRow> rows, String tenantId) {
        ImportResult result = new ImportResult();
        if (rows == null || rows.isEmpty()) return result;

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
        if (result.hasErrors()) return result; // fail fast on duplicate inputs

        // Gather distinct material codes and verify they exist
        Set<String> materialCodes = rows.stream().map(r -> r.getMaterialCode().trim()).collect(Collectors.toSet());
        Map<String, Material> materialByCode = new HashMap<>();
        for (String mc : materialCodes) {
            materialRepository.findByMaterialCode(mc).ifPresent(m -> materialByCode.put(mc, m));
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
            // tenant-aware model lookup
            modelRepository.findByModelCodeAndTenantId(mc, tenantId).ifPresent(m -> existingModels.put(mc, m));
        }

        for (Map.Entry<String, List<ModelBomCsvRow>> e : byModel.entrySet()) {
            String modelCode = e.getKey();
            Model model = existingModels.get(modelCode);
            if (model == null) continue; // nothing to check for models that will be created
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
        if (result.hasErrors()) return result; // fail fast if DB is inconsistent

        // Now perform creation/upsert within the transaction
        for (Map.Entry<String, List<ModelBomCsvRow>> e : byModel.entrySet()) {
            String modelCode = e.getKey();
            List<ModelBomCsvRow> modelRows = e.getValue();

            // find existing model (tenant-scoped)
            Model model = modelRepository.findByModelCodeAndTenantId(modelCode, tenantId).orElse(null);
            boolean createdModel = false;
            if (model == null) {
                // create new model
                Model newModel = new Model();
                if (modelRows.size() > 0) {
                    ModelBomCsvRow first = modelRows.get(0);
                    newModel.setModelCode(first.getModelCode());
                    newModel.setModelName(first.getModelName());
                    newModel.setTenantId(tenantId);
                    // Do NOT preserve client-provided modelId here - backend must generate UUIDs via JPA @PrePersist
                } else {
                    newModel.setModelCode(modelCode);
                    newModel.setModelName(modelCode);
                    newModel.setTenantId(tenantId);
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
                    modelBomRepository.save(mb);
                    result.setModelBomsCreated(result.getModelBomsCreated() + 1);
                }
            }
        }

        return result;
    }
}
