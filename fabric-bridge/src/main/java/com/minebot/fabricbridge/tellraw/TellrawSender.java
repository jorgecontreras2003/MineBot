package com.minebot.fabricbridge.tellraw;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

/**
 * Envía mensajes formateados al chat mediante tellraw.
 */
public class TellrawSender {

    /**
     * Envía un mensaje privado a un jugador.
     *
     * @param player  jugador destino
     * @param message mensaje
     */
    public static void send(ServerPlayerEntity player, String message) {
        player.sendMessage(Text.literal(message), false);
    }

    /**
     * Envía un mensaje público al chat con el prefijo del bot.
     *
     * @param server  servidor
     * @param botName nombre del bot
     * @param message mensaje
     */
    public static void sendToAll(MinecraftServer server, String botName, String message) {
        if (server == null) {
            return;
        }

        Text prefix = Text.literal("<" + botName + "> ").styled(s -> s.withColor(0x55FF55));
        Text content = Text.literal(message);

        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            player.sendMessage(prefix.copy().append(content), false);
        }
    }
}
