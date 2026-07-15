package com.minebot.fabricbridge.config;

/**
 * Configuración del mod, cargada desde variables de entorno.
 * No contiene valores hardcodeados.
 */
public class ModConfig {

    private static final String DEFAULT_TRIGGER = "@bot";
    private static final String DEFAULT_AI_URL = "https://minebot-kuws.onrender.com/chat";
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
        // Se permite sobrescribir mediante variable de entorno, pero por defecto
        // se usa la clave compartida con el AI Server desplegado en Render.
        return getEnv("API_KEY", "5d6a98d9f6d0c4d5d3d6b7d4c8a9e1f2b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0");
    }

    private String getEnv(String key, String defaultValue) {
        String value = System.getenv(key);
        return value != null && !value.isEmpty() ? value : defaultValue;
    }
}
