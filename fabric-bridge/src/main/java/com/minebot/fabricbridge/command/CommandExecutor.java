package com.minebot.fabricbridge.command;

import com.minebot.fabricbridge.FabricBridgeMod;
import net.minecraft.server.command.CommandOutput;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.text.Text;
import net.minecraft.util.math.Vec2f;
import net.minecraft.util.math.Vec3d;

/**
 * Ejecuta comandos de Minecraft capturando su salida para devolverla como texto.
 * No utiliza RCON; usa directamente la API del servidor.
 */
public class CommandExecutor {

    private final MinecraftServer server;

    public CommandExecutor(MinecraftServer server) {
        this.server = server;
    }

    /**
     * Ejecuta un comando y devuelve su salida capturada.
     *
     * @param command comando sin la barra inicial
     * @return resultado de la ejecución
     */
    public Result execute(String command) {
        if (server == null) {
            return Result.fail("Servidor no disponible");
        }

        String normalized = command.startsWith("/") ? command.substring(1) : command;
        CapturingCommandOutput output = new CapturingCommandOutput();

        ServerCommandSource source = new ServerCommandSource(
                output,
                Vec3d.ZERO,
                Vec2f.ZERO,
                server.getOverworld(),
                4,
                "MineBotBridge",
                Text.literal("MineBot Bridge"),
                server,
                null
        );

        try {
            server.getCommandManager().executeWithPrefix(source, normalized);
            String captured = output.getOutput().trim();
            return new Result(true, captured.isEmpty() ? "Comando ejecutado" : captured);
        } catch (Exception e) {
            FabricBridgeMod.LOGGER.error("[MineBot] Error ejecutando comando '{}': {}", normalized, e.getMessage());
            return Result.fail("Error ejecutando comando: " + e.getMessage());
        }
    }

    /**
     * Resultado de la ejecución de un comando.
     */
    public static class Result {
        public final boolean success;
        public final String output;

        public Result(boolean success, String output) {
            this.success = success;
            this.output = output;
        }

        public static Result fail(String output) {
            return new Result(false, output);
        }
    }

    /**
     * Captura los mensajes enviados por un comando.
     */
    private static class CapturingCommandOutput implements CommandOutput {
        private final StringBuilder output = new StringBuilder();

        @Override
        public void sendMessage(Text message) {
            output.append(message.getString()).append("\n");
        }

        @Override
        public boolean shouldReceiveFeedback() {
            return true;
        }

        @Override
        public boolean shouldTrackOutput() {
            return true;
        }

        @Override
        public boolean shouldBroadcastConsoleToOps() {
            return false;
        }

        public String getOutput() {
            return output.toString();
        }
    }
}
