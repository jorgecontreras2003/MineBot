package com.minebot.fabricbridge.chat;

import com.minebot.fabricbridge.config.ModConfig;
import com.minebot.fabricbridge.http.AIServerClient;
import com.minebot.fabricbridge.tellraw.TellrawSender;
import net.minecraft.network.message.MessageType;
import net.minecraft.network.message.SignedMessage;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.concurrent.CompletableFuture;

/**
 * Escucha mensajes del chat y activa el asistente cuando se usa el prefijo.
 */
public class ChatListener {

    private final ModConfig config;
    private final AIServerClient aiClient;

    public ChatListener(ModConfig config, AIServerClient aiClient) {
        this.config = config;
        this.aiClient = aiClient;
    }

    public void onChatMessage(SignedMessage message, ServerPlayerEntity sender, MessageType.Parameters params) {
        String content = message.getContent().getString();
        String trigger = config.getTrigger();

        if (!content.startsWith(trigger)) {
            return;
        }

        String question = content.substring(trigger.length()).trim();
        if (question.isEmpty()) {
            TellrawSender.send(sender, "¿Qué necesitas? Escribe tu pregunta después de " + trigger + ".");
            return;
        }

        String playerName = sender.getName().getString();

        MinecraftServer server = sender.getServer();

        // Procesar en segundo plano para no bloquear el hilo principal.
        CompletableFuture.supplyAsync(() -> aiClient.sendChat(playerName, question))
                .thenAccept(reply -> {
                    // Volver al hilo del servidor para enviar mensajes de forma segura.
                    server.execute(() -> {
                        String text = reply != null ? reply : "No pude contactar con la IA. Intenta más tarde.";
                        TellrawSender.sendToAll(server, config.getBotName(), text);
                    });
                });
    }
}
