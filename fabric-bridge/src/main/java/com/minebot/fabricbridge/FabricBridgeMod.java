package com.minebot.fabricbridge;

import com.minebot.fabricbridge.chat.ChatListener;
import com.minebot.fabricbridge.config.ModConfig;
import com.minebot.fabricbridge.http.AIServerClient;
import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Punto de entrada del mod Fabric Bridge.
 * Se ejecuta únicamente en el servidor dedicado.
 */
public class FabricBridgeMod implements DedicatedServerModInitializer {

    public static final Logger LOGGER = LoggerFactory.getLogger("minebot-fabric-bridge");

    private final ModConfig config = new ModConfig();
    private final AIServerClient aiClient = new AIServerClient(config);
    private MinecraftServer server;

    @Override
    public void onInitializeServer() {
        LOGGER.info("[MineBot] Fabric Bridge iniciado. Prefijo: {}", config.getTrigger());
        LOGGER.info("[MineBot] AI Server URL: {}", config.getAiServerUrl());

        ServerLifecycleEvents.SERVER_STARTED.register(this::onServerStarted);
        ServerLifecycleEvents.SERVER_STOPPING.register(this::onServerStopping);

        ChatListener chatListener = new ChatListener(config, aiClient);
        ServerMessageEvents.CHAT_MESSAGE.register(chatListener::onChatMessage);
    }

    private void onServerStarted(MinecraftServer server) {
        this.server = server;
        aiClient.setServer(server);
        LOGGER.info("[MineBot] Servidor iniciado y listo para recibir mensajes.");
    }

    private void onServerStopping(MinecraftServer server) {
        LOGGER.info("[MineBot] Servidor deteniéndose. Cerrando conexiones.");
        aiClient.close();
    }
}
