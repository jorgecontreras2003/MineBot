package com.minebot.fabricbridge.http;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.minebot.fabricbridge.FabricBridgeMod;
import com.minebot.fabricbridge.config.ModConfig;
import com.minebot.fabricbridge.context.ServerContext;
import net.minecraft.server.MinecraftServer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Cliente HTTP que envía el contexto al AI Server y recibe la respuesta.
 */
public class AIServerClient {

    private final ModConfig config;
    private final HttpClient httpClient;
    private MinecraftServer server;

    public AIServerClient(ModConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(config.getTimeoutMs()))
                .build();
    }

    public void setServer(MinecraftServer server) {
        this.server = server;
    }

    public void close() {
        // HttpClient no requiere cierre explícito en la mayoría de los casos.
    }

    /**
     * Envía el contexto al AI Server y devuelve la respuesta.
     *
     * @param playerName nombre del jugador que pregunta
     * @param message    mensaje del jugador
     * @return respuesta de texto o null si hubo error
     */
    public String sendChat(String playerName, String message) {
        if (server == null) {
            FabricBridgeMod.LOGGER.warn("[MineBot] Servidor no disponible para enviar contexto.");
            return null;
        }

        try {
            ServerContext contextBuilder = new ServerContext(server);
            JsonObject payload = contextBuilder.build(playerName, message);
            String body = payload.toString();

            FabricBridgeMod.LOGGER.debug("[MineBot] Enviando a AI Server: {}", body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(config.getAiServerUrl()))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(config.getTimeoutMs()))
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                FabricBridgeMod.LOGGER.warn("[MineBot] AI Server respondió con código {}", response.statusCode());
                return null;
            }

            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
            return json.has("reply") ? json.get("reply").getAsString() : null;

        } catch (Exception e) {
            FabricBridgeMod.LOGGER.error("[MineBot] Error contactando al AI Server: {}", e.getMessage());
            return null;
        }
    }
}
