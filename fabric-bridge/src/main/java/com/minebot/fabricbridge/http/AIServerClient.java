package com.minebot.fabricbridge.http;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.minebot.fabricbridge.FabricBridgeMod;
import com.minebot.fabricbridge.bridge.BridgeExecutor;
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
 * Soporta el round-trip del Bridge: si el AI Server pide ejecutar una herramienta,
 * el mod la ejecuta localmente y devuelve el resultado.
 */
public class AIServerClient {

    private final ModConfig config;
    private final HttpClient httpClient;
    private MinecraftServer server;
    private BridgeExecutor bridgeExecutor;

    public AIServerClient(ModConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(config.getTimeoutMs()))
                .build();
    }

    public void setServer(MinecraftServer server) {
        this.server = server;
        this.bridgeExecutor = new BridgeExecutor(server);
    }

    public void close() {
        // HttpClient no requiere cierre explícito en la mayoría de los casos.
    }

    /**
     * Envía el contexto al AI Server y devuelve la respuesta.
     * Si el AI Server solicita una herramienta, la ejecuta y repite la llamada.
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

        ServerContext contextBuilder = new ServerContext(server);
        JsonObject payload = contextBuilder.build(playerName, message);

        return sendChatWithPayload(payload, 0);
    }

    private String sendChatWithPayload(JsonObject payload, int depth) {
        if (depth > 3) {
            FabricBridgeMod.LOGGER.warn("[MineBot] Demasiados ciclos de Bridge. Abortando.");
            return "No pude resolver la consulta, hay demasiados pasos.";
        }

        try {
            String body = payload.toString();
            FabricBridgeMod.LOGGER.debug("[MineBot] Enviando a AI Server: {}", body);

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(config.getAiServerUrl()))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofMillis(config.getTimeoutMs()))
                    .POST(HttpRequest.BodyPublishers.ofString(body));

            if (!config.getApiKey().isEmpty()) {
                requestBuilder.header("X-API-Key", config.getApiKey());
            }

            HttpRequest request = requestBuilder.build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                FabricBridgeMod.LOGGER.warn("[MineBot] AI Server respondió con código {}", response.statusCode());
                return null;
            }

            JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();

            if (json.has("bridge")) {
                JsonObject bridge = json.getAsJsonObject("bridge");
                String callId = bridge.get("callId").getAsString();
                String tool = bridge.get("tool").getAsString();
                String previousResponseId = bridge.get("previousResponseId").getAsString();
                JsonObject arguments = bridge.has("arguments") && bridge.get("arguments").isJsonObject()
                        ? bridge.getAsJsonObject("arguments")
                        : new JsonObject();

                FabricBridgeMod.LOGGER.info("[MineBot] AI Server solicitó herramienta '{}' (callId: {})", tool, callId);

                JsonObject result = bridgeExecutor.executeTool(tool, arguments);

                JsonObject bridgeResult = new JsonObject();
                bridgeResult.addProperty("callId", callId);
                bridgeResult.addProperty("previousResponseId", previousResponseId);
                bridgeResult.add("result", result);

                payload.add("bridgeResult", bridgeResult);
                return sendChatWithPayload(payload, depth + 1);
            }

            return json.has("reply") ? json.get("reply").getAsString() : null;

        } catch (Exception e) {
            FabricBridgeMod.LOGGER.error("[MineBot] Error contactando al AI Server: {}", e.getMessage());
            return null;
        }
    }
}
