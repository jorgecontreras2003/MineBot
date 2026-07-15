package com.minebot.fabricbridge.context;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

import java.util.List;

/**
 * Recolecta información del servidor de Minecraft para enviarla al AI Server.
 */
public class ServerContext {

    private final MinecraftServer server;

    public ServerContext(MinecraftServer server) {
        this.server = server;
    }

    /**
     * Construye el JSON completo de contexto.
     *
     * @param playerName nombre del jugador que pregunta
     * @param message    mensaje original
     * @return JsonObject con toda la información
     */
    public JsonObject build(String playerName, String message) {
        JsonObject root = new JsonObject();
        root.addProperty("player", playerName);
        root.addProperty("message", message);

        root.add("server", buildServerInfo());
        root.add("bot", buildBotInfo());
        root.add("players", buildPlayersList());
        root.add("mods", buildModsList());

        return root;
    }

    private JsonObject buildServerInfo() {
        JsonObject serverInfo = new JsonObject();

        World world = server.getOverworld();
        long time = world.getTimeOfDay();
        boolean raining = world.isRaining();
        boolean thundering = world.isThundering();

        serverInfo.addProperty("time", isDay(time) ? "day" : "night");
        serverInfo.addProperty("weather", thundering ? "thunder" : (raining ? "rain" : "clear"));
        serverInfo.addProperty("dimension", "overworld");
        serverInfo.addProperty("biome", getBiomeName(world, playerPosition()));

        return serverInfo;
    }

    private JsonObject buildBotInfo() {
        JsonObject botInfo = new JsonObject();
        botInfo.addProperty("health", 20);
        botInfo.addProperty("food", 20);
        return botInfo;
    }

    private JsonArray buildPlayersList() {
        JsonArray players = new JsonArray();
        List<ServerPlayerEntity> playerList = server.getPlayerManager().getPlayerList();

        for (ServerPlayerEntity player : playerList) {
            JsonObject p = new JsonObject();
            p.addProperty("name", player.getName().getString());
            p.addProperty("x", player.getX());
            p.addProperty("y", player.getY());
            p.addProperty("z", player.getZ());
            players.add(p);
        }

        return players;
    }

    private JsonArray buildModsList() {
        JsonArray mods = new JsonArray();
        FabricLoader.getInstance().getAllMods().forEach(mod ->
                mods.add(mod.getMetadata().getId())
        );
        return mods;
    }

    private boolean isDay(long timeOfDay) {
        long cycle = timeOfDay % 24000;
        return cycle >= 0 && cycle < 13000;
    }

    private String getBiomeName(World world, BlockPos pos) {
        if (world == null || pos == null) {
            return "unknown";
        }
        return world.getBiome(pos).getKey()
                .map(key -> key.getValue().toString())
                .orElse("unknown");
    }

    private BlockPos playerPosition() {
        ServerPlayerEntity player = server.getPlayerManager().getPlayerList().stream().findFirst().orElse(null);
        if (player == null) {
            return worldSpawn();
        }
        return player.getBlockPos();
    }

    private BlockPos worldSpawn() {
        return server.getOverworld().getSpawnPos();
    }
}
