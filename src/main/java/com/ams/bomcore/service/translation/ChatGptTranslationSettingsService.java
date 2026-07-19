package com.ams.bomcore.service.translation;

import org.springframework.core.env.Environment;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class ChatGptTranslationSettingsService {

    private static final String DEFAULT_MODEL = "gpt-4o";

    private final JdbcTemplate jdbcTemplate;
    private final Environment environment;

    public ChatGptTranslationSettingsService(JdbcTemplate jdbcTemplate, Environment environment) {
        this.jdbcTemplate = jdbcTemplate;
        this.environment = environment;
    }

    public TranslationSettings resolve() {
        String apiKey = configuredTokenValue("openai_api_key", "chatgpt_api_key");
        if (apiKey.isBlank()) {
            apiKey = firstPropertyOrEnv("OPENAI_API_KEY", "openai.api-key", "openai.api.key", "chatgpt.api-key");
        }
        if (apiKey.isBlank()) {
            throw new IllegalStateException("OpenAI token is required for translation. Configure TokenTb openai_api_key or chatgpt_api_key.");
        }

        String model = configuredTokenValue("chatgpt_model", "openai_model", "article_translate_model");
        if (model.isBlank()) {
            model = firstPropertyOrEnv("OPENAI_MODEL", "chatgpt.model", "openai.model", "article.translate.model");
        }
        if (model.isBlank()) {
            model = DEFAULT_MODEL;
        }

        String translatePrompt = configuredTokenValue("chatgpt_translate_prompt", "translate_prompt", "article_translate_prompt");
        if (translatePrompt.isBlank()) {
            translatePrompt = firstPropertyOrEnv(
                    "CHATGPT_TRANSLATE_PROMPT",
                    "chatgpt.translate-prompt",
                    "chatgpt.translate.prompt",
                    "article.translate.prompt"
            );
        }
        return new TranslationSettings(apiKey, model, translatePrompt);
    }

    private String configuredTokenValue(String... tokenIds) {
        Set<String> ids = new LinkedHashSet<>();
        if (tokenIds != null) {
            for (String tokenId : tokenIds) {
                if (!isBlank(tokenId)) {
                    ids.add(tokenId.trim());
                }
            }
        }
        for (String tokenId : ids) {
            String value = tokenValue(tokenId);
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String tokenValue(String tokenId) {
        String byType = firstTokenQuery(tokenId, List.of(
                "select token from tokentb where coalesce(isvisible, true) = true and tokentype = ? order by createdtime desc limit 1",
                "select token from tokentb where tokentype = ? order by createdtime desc limit 1",
                "select token from tokentb where coalesce(visible, true) = true and tokentype = ? order by createdtime desc limit 1",
                "select token from token_tb where coalesce(visible, true) = true and token_type = ? order by created_time desc limit 1",
                "select \"token\" from \"TokenTb\" where coalesce(\"visible\", true) = true and \"tokenType\" = ? order by \"createdTime\" desc limit 1"
        ));
        if (!byType.isBlank()) {
            return byType;
        }
        return firstTokenQuery(tokenId, List.of(
                "select token from tokentb where coalesce(isvisible, true) = true and userstringid = ? order by createdtime desc limit 1",
                "select token from tokentb where userstringid = ? order by createdtime desc limit 1",
                "select token from tokentb where coalesce(visible, true) = true and userstringid = ? order by createdtime desc limit 1",
                "select token from token_tb where coalesce(visible, true) = true and user_string_id = ? order by created_time desc limit 1",
                "select \"token\" from \"TokenTb\" where coalesce(\"visible\", true) = true and \"userStringId\" = ? order by \"createdTime\" desc limit 1"
        ));
    }

    private String firstTokenQuery(String tokenId, List<String> sqlCandidates) {
        for (String sql : sqlCandidates) {
            try {
                List<String> values = jdbcTemplate.query(sql, (rs, rowNum) -> clean(rs.getString(1)), tokenId);
                for (String value : values) {
                    if (isUsable(value)) {
                        return value;
                    }
                }
            } catch (DataAccessException ignored) {
                // Demo deployments may not have the portal TokenTb table.
            }
        }
        return "";
    }

    private String firstPropertyOrEnv(String envName, String... propertyNames) {
        String value = clean(System.getenv(envName));
        if (!value.isBlank()) {
            return value;
        }
        value = clean(System.getProperty(envName));
        if (!value.isBlank()) {
            return value;
        }
        if (propertyNames != null) {
            for (String propertyName : propertyNames) {
                value = clean(environment.getProperty(propertyName));
                if (!value.isBlank()) {
                    return value;
                }
            }
        }
        return "";
    }

    private boolean isUsable(String value) {
        return !isBlank(value) && !"none".equalsIgnoreCase(value.trim());
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record TranslationSettings(String apiKey, String model, String translatePrompt) {
    }
}
