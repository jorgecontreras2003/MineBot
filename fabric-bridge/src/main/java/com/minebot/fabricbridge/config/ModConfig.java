package com.minebot.fabricbridge.config;

/**
 * Configuración del mod, cargada desde variables de entorno.
 * No contiene valores hardcodeados.
 */
public class ModConfig {

    private static final String DEFAULT_TRIGGER = "@bot";
    private static final String DEFAULT_AI_URL = "http://localhost:3000/chat";
    private static final String DEFAULT_TIMEOUT = "90000";

    public String getTrigger() {
        return getEnv("BOT_TRIGGER", DEFAULT_TRIGGER);
    }

    public String getAiServerUrl() {
        return getEnv("AI_SERVER_URL", DEFAULT_AI_URL);
    }

    public int getTimeoutMs() {
        return Integer.parseInt(getEnv("AI_SERVER_TIMEOUT_MS", DEFAULT_TIMEOUT));
    }

    public String getBotName() {
        return getEnv("BOT_NAME", "SteveAI");
    }

    public String getApiKey() {
        return getEnv("API_KEY", "");
    }

    private String getEnv(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null && !value.isEmpty() ? value : defaultValue;
    }
}
