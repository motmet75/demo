package com.ams.bomcore.service.translation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class ChatGPTTranslatorService implements AutoCloseable {

    private static final String DEFAULT_MODEL = "gpt-4o";
    private static final String DEFAULT_TRANSLATE_PROMPT =
            "You are a careful translation engine. Translate from {sourceLang} to {targetLang}. "
                    + "Preserve meaning, names, numbers, URLs, formatting, line breaks, and any HTML tags or attributes. "
                    + "Return only the translated content.";
    private static final int MAX_COMPLETION_TOKENS = 4096;
    private static final URI CHAT_COMPLETIONS_URI = URI.create("https://api.openai.com/v1/chat/completions");

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient;
    private final String apiKey;
    private final String model;
    private final String translatePrompt;

    public ChatGPTTranslatorService(String apiKey) {
        this(apiKey, DEFAULT_MODEL, DEFAULT_TRANSLATE_PROMPT);
    }

    public ChatGPTTranslatorService(String apiKey, String model, String translatePrompt) {
        if (isBlank(apiKey)) {
            throw new IllegalArgumentException("OpenAI API key is required");
        }
        this.apiKey = apiKey.trim();
        this.model = isBlank(model) ? DEFAULT_MODEL : model.trim();
        this.translatePrompt = isBlank(translatePrompt) ? DEFAULT_TRANSLATE_PROMPT : translatePrompt.trim();
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    public String translate(String content, String sourceLang, String targetLang, String type) {
        if (isBlank(content)) return "";
        String instruction = translatePrompt
                .replace("{sourceLang}", safeLanguage(sourceLang))
                .replace("{targetLang}", safeLanguage(targetLang));
        if ("html".equalsIgnoreCase(type)) {
            instruction += " The content may contain HTML. Keep all tags and attributes unchanged.";
        }
        return TranslationCleaner.cleanTrainingPattern(callOpenAI(instruction, content));
    }

    public Map<String, String> translateValues(Map<String, String> values, String sourceLang, String targetLang) {
        Map<String, String> cleaned = new LinkedHashMap<>();
        if (values != null) {
            values.forEach((key, value) -> {
                if (!isBlank(key) && !isBlank(value)) {
                    cleaned.put(key, value.trim());
                }
            });
        }
        if (cleaned.isEmpty()) return Map.of();

        try {
            String json = objectMapper.writeValueAsString(cleaned);
            String instruction = translatePrompt
                    .replace("{sourceLang}", safeLanguage(sourceLang))
                    .replace("{targetLang}", safeLanguage(targetLang))
                    + " The user message is a JSON object. Translate every string value, keep every key unchanged, "
                    + "and return only a valid JSON object with the same keys.";
            String response = callOpenAI(instruction, json);
            Map<String, String> translated = parseJsonObjectResponse(response);
            if (translated.keySet().containsAll(cleaned.keySet())) {
                return translated;
            }
            for (Map.Entry<String, String> entry : cleaned.entrySet()) {
                if (isBlank(translated.get(entry.getKey()))) {
                    translated.put(entry.getKey(), translate(entry.getValue(), sourceLang, targetLang, "text"));
                }
            }
            return translated;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to serialize menu translation payload", e);
        }
    }

    private String callOpenAI(String instruction, String content) {
        try {
            List<Map<String, String>> messages = new ArrayList<>();
            messages.add(Map.of("role", "system", "content", instruction));
            messages.add(Map.of("role", "user", "content", content));

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("messages", messages);
            body.put("max_tokens", MAX_COMPLETION_TOKENS);
            body.put("temperature", 0.1);
            body.put("n", 1);

            HttpRequest request = HttpRequest.newBuilder(CHAT_COMPLETIONS_URI)
                    .timeout(Duration.ofSeconds(90))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("OpenAI translation failed with HTTP " + response.statusCode());
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            String translated = contentNode.isTextual() ? contentNode.asText() : "";
            if (translated.isBlank()) {
                throw new IllegalStateException("OpenAI translation returned no content");
            }
            return TranslationCleaner.cleanTrainingPattern(translated);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("OpenAI translation interrupted", e);
        } catch (IOException e) {
            throw new IllegalStateException("OpenAI translation failed", e);
        }
    }

    private Map<String, String> parseJsonObjectResponse(String response) {
        String json = extractJsonObject(response);
        try {
            Map<String, Object> raw = objectMapper.readValue(json, new TypeReference<>() {});
            Map<String, String> result = new LinkedHashMap<>();
            raw.forEach((key, value) -> {
                if (value != null) {
                    result.put(key, value.toString().trim());
                }
            });
            return result;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String extractJsonObject(String response) {
        String cleaned = TranslationCleaner.cleanTrainingPattern(response);
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return cleaned.substring(start, end + 1);
        }
        return cleaned;
    }

    private String safeLanguage(String language) {
        return isBlank(language) ? "auto" : language.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    @Override
    public void close() {
        // HttpClient does not require explicit shutdown.
    }
}
