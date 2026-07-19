package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.repository.ModelMenuOptionRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.service.translation.ChatGPTTranslatorService;
import com.ams.bomcore.service.translation.ChatGptTranslationSettingsService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
public class ShopMenuTranslationService {

    private static final List<String> TARGET_LANGUAGES = List.of("cn", "tw", "ja", "ko", "es", "dv", "ms", "id", "vi", "th");
    private static final Set<String> SOURCE_LANGUAGES = Set.of("en", "cn", "tw", "ja", "ko", "es", "dv", "ms", "id", "vi", "th");
    private static final Map<String, String> LANGUAGE_NAMES = Map.ofEntries(
            Map.entry("en", "English"),
            Map.entry("cn", "Simplified Chinese"),
            Map.entry("tw", "Traditional Chinese"),
            Map.entry("ja", "Japanese"),
            Map.entry("ko", "Korean"),
            Map.entry("es", "Spanish"),
            Map.entry("dv", "Dhivehi"),
            Map.entry("ms", "Malay"),
            Map.entry("id", "Indonesian"),
            Map.entry("vi", "Vietnamese"),
            Map.entry("th", "Thai")
    );

    private final ModelRepository modelRepository;
    private final ModelMenuOptionRepository menuOptionRepository;
    private final ChatGptTranslationSettingsService settingsService;
    private final ObjectMapper objectMapper;

    public ShopMenuTranslationService(ModelRepository modelRepository,
                                      ModelMenuOptionRepository menuOptionRepository,
                                      ChatGptTranslationSettingsService settingsService,
                                      ObjectMapper objectMapper) {
        this.modelRepository = modelRepository;
        this.menuOptionRepository = menuOptionRepository;
        this.settingsService = settingsService;
        this.objectMapper = objectMapper;
    }

    public MenuTranslationResult translateMenuItem(UUID modelId, UUID tenantId, UUID companyId, MenuTranslationRequest request) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new NoSuchElementException("Menu item not found"));
        if (!tenantId.equals(model.getTenantId()) || !companyId.equals(model.getCompanyId())) {
            throw new IllegalArgumentException("Menu item does not belong to this company");
        }

        String sourceLanguage = normalizeSourceLanguage(request == null ? null : request.sourceLanguage());
        List<String> targetLanguages = normalizeTargetLanguages(request == null ? null : request.targetLanguages(), sourceLanguage);
        if (targetLanguages.isEmpty()) {
            throw new IllegalArgumentException("Select at least one target language");
        }

        List<ModelMenuOption> options = menuOptionRepository
                .findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(modelId, tenantId, companyId);
        Map<String, String> sourceValues = collectSourceValues(model, options, sourceLanguage);
        if (sourceValues.isEmpty()) {
            throw new IllegalArgumentException("Menu item has no text to translate");
        }

        ChatGptTranslationSettingsService.TranslationSettings settings = settingsService.resolve();
        List<String> translatedLanguages = new ArrayList<>();
        try (ChatGPTTranslatorService translator =
                     new ChatGPTTranslatorService(settings.apiKey(), settings.model(), settings.translatePrompt())) {
            for (String targetLanguage : targetLanguages) {
                Map<String, String> translated = translator.translateValues(
                        sourceValues,
                        languageName(sourceLanguage),
                        languageName(targetLanguage)
                );
                applyTranslations(model, options, targetLanguage, translated);
                translatedLanguages.add(targetLanguage);
            }
        }

        Model savedModel = modelRepository.save(model);
        List<ModelMenuOption> savedOptions = menuOptionRepository.saveAll(options);
        return new MenuTranslationResult(savedModel, savedOptions, translatedLanguages);
    }

    private Map<String, String> collectSourceValues(Model model, List<ModelMenuOption> options, String sourceLanguage) {
        Map<String, String> values = new LinkedHashMap<>();
        putSource(values, "model.name", sourceValue(model.getModelName(), model.getModelNameTranslations(), sourceLanguage));
        putSource(values, "model.category", sourceValue(model.getCategory(), model.getCategoryTranslations(), sourceLanguage));

        for (ModelMenuOption option : options) {
            String optionId = option.getId() == null ? "" : option.getId().toString();
            putSource(values, optionGroupKey(optionId), sourceValue(option.getGroupName(), option.getGroupNameTranslations(), sourceLanguage));

            List<Map<String, Object>> choices = readChoiceObjects(option.getChoices());
            for (int i = 0; i < choices.size(); i++) {
                Map<String, Object> choice = choices.get(i);
                putSource(values,
                        optionChoiceKey(optionId, i),
                        sourceValue(asText(choice.get("label")), choice.get("labelTranslations"), sourceLanguage));
            }
        }
        return values;
    }

    private void applyTranslations(Model model, List<ModelMenuOption> options, String targetLanguage, Map<String, String> translated) {
        model.setModelNameTranslations(stringifyWithTranslation(model.getModelNameTranslations(), targetLanguage, translated.get("model.name")));
        model.setCategoryTranslations(stringifyWithTranslation(model.getCategoryTranslations(), targetLanguage, translated.get("model.category")));

        for (ModelMenuOption option : options) {
            String optionId = option.getId() == null ? "" : option.getId().toString();
            option.setGroupNameTranslations(stringifyWithTranslation(
                    option.getGroupNameTranslations(),
                    targetLanguage,
                    translated.get(optionGroupKey(optionId))
            ));

            List<Map<String, Object>> choices = readChoiceObjects(option.getChoices());
            boolean choicesChanged = false;
            for (int i = 0; i < choices.size(); i++) {
                String label = translated.get(optionChoiceKey(optionId, i));
                if (isBlank(label)) continue;

                Map<String, String> labelTranslations = parseTranslationMap(choices.get(i).get("labelTranslations"));
                labelTranslations.put(targetLanguage, label.trim());
                choices.get(i).put("labelTranslations", labelTranslations);
                choicesChanged = true;
            }
            if (choicesChanged) {
                option.setChoices(writeJson(choices));
            }
        }
    }

    private String stringifyWithTranslation(Object existing, String language, String value) {
        Map<String, String> translations = parseTranslationMap(existing);
        if (!isBlank(value)) {
            translations.put(language, value.trim());
        }
        translations.entrySet().removeIf(entry -> isBlank(entry.getKey()) || isBlank(entry.getValue()));
        return translations.isEmpty() ? null : writeJson(translations);
    }

    private String sourceValue(String baseValue, Object translationsRaw, String sourceLanguage) {
        if ("en".equals(sourceLanguage)) {
            return clean(baseValue);
        }
        Map<String, String> translations = parseTranslationMap(translationsRaw);
        String translated = clean(translations.get(sourceLanguage));
        return translated.isBlank() ? clean(baseValue) : translated;
    }

    private Map<String, String> parseTranslationMap(Object raw) {
        Map<String, String> result = new LinkedHashMap<>();
        if (raw == null) return result;
        try {
            if (raw instanceof Map<?, ?> map) {
                map.forEach((key, value) -> {
                    if (key != null && value != null && !value.toString().trim().isEmpty()) {
                        result.put(key.toString(), value.toString().trim());
                    }
                });
                return result;
            }
            String text = raw.toString().trim();
            if (text.isEmpty()) return result;
            Map<String, Object> parsed = objectMapper.readValue(text, new TypeReference<>() {});
            parsed.forEach((key, value) -> {
                if (value != null && !value.toString().trim().isEmpty()) {
                    result.put(key, value.toString().trim());
                }
            });
        } catch (Exception ignored) {
        }
        return result;
    }

    private List<Map<String, Object>> readChoiceObjects(String raw) {
        List<Map<String, Object>> choices = new ArrayList<>();
        if (isBlank(raw)) return choices;
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (!root.isArray()) return choices;
            for (JsonNode node : root) {
                if (node.isObject()) {
                    choices.add(objectMapper.convertValue(node, new TypeReference<Map<String, Object>>() {}));
                } else {
                    Map<String, Object> choice = new LinkedHashMap<>();
                    choice.put("label", node.asText());
                    choice.put("price", 0);
                    choices.add(choice);
                }
            }
        } catch (Exception ignored) {
        }
        return choices;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to write translation JSON", e);
        }
    }

    private String optionGroupKey(String optionId) {
        return "option." + optionId + ".group";
    }

    private String optionChoiceKey(String optionId, int index) {
        return "option." + optionId + ".choice." + index;
    }

    private void putSource(Map<String, String> values, String key, String value) {
        if (!isBlank(value)) {
            values.put(key, value.trim());
        }
    }

    private List<String> normalizeTargetLanguages(List<String> requestedLanguages, String sourceLanguage) {
        List<String> incoming = requestedLanguages == null || requestedLanguages.isEmpty()
                ? TARGET_LANGUAGES
                : requestedLanguages;
        Set<String> normalized = new LinkedHashSet<>();
        for (String requested : incoming) {
            String language = normalizeLanguage(requested);
            if (language != null && TARGET_LANGUAGES.contains(language) && !language.equals(sourceLanguage)) {
                normalized.add(language);
            }
        }
        return new ArrayList<>(normalized);
    }

    private String normalizeSourceLanguage(String raw) {
        String language = normalizeLanguage(raw);
        if (language == null) {
            language = "en";
        }
        if (!SOURCE_LANGUAGES.contains(language)) {
            throw new IllegalArgumentException("Unsupported source language: " + raw);
        }
        return language;
    }

    private String normalizeLanguage(String raw) {
        if (isBlank(raw)) return null;
        String value = raw.trim().toLowerCase().replace('_', '-');
        return switch (value) {
            case "en", "eng", "english" -> "en";
            case "cn", "zh", "zh-cn", "zh-hans", "china", "chinese", "simplified chinese" -> "cn";
            case "tw", "zh-tw", "zh-hant", "taiwan", "traditional chinese" -> "tw";
            case "ja", "jp", "japanese" -> "ja";
            case "ko", "kr", "korean" -> "ko";
            case "es", "spanish" -> "es";
            case "dv", "dhivehi", "maldivian" -> "dv";
            case "ms", "malay" -> "ms";
            case "id", "indonesian" -> "id";
            case "vi", "vn", "vietnamese" -> "vi";
            case "th", "tha", "thai", "thailand", "th-th" -> "th";
            default -> null;
        };
    }

    private String languageName(String code) {
        return LANGUAGE_NAMES.getOrDefault(code, code);
    }

    private String asText(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record MenuTranslationRequest(String sourceLanguage, List<String> targetLanguages) {
    }

    public record MenuTranslationResult(Model model, List<ModelMenuOption> options, List<String> translatedLanguages) {
    }
}
