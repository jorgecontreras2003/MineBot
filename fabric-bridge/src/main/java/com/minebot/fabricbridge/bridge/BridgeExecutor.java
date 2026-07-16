package com.minebot.fabricbridge.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.minebot.fabricbridge.FabricBridgeMod;
import com.minebot.fabricbridge.command.CommandExecutor;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.world.GameMode;
import net.minecraft.world.World;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ejecuta herramientas del Bridge usando la API de Minecraft.
 * El mod recibe peticiones de herramientas del AI Server, las ejecuta y devuelve
 * el resultado para que el LLM genere la respuesta final.
 */
public class BridgeExecutor {

    private static final Pattern LOCATE_PATTERN = Pattern.compile("\\[(-?\\d+),\\s*~,\\s*(-?\\d+)\\]");

    private final MinecraftServer server;
    private final CommandExecutor commandExecutor;

    public BridgeExecutor(MinecraftServer server) {
        this.server = server;
        this.commandExecutor = new CommandExecutor(server);
    }

    /**
     * Ejecuta una herramienta solicitada por el AI Server.
     *
     * @param tool      nombre de la herramienta
     * @param arguments argumentos de la herramienta
     * @return JsonObject con el resultado
     */
    public JsonObject executeTool(String tool, JsonObject arguments) {
        if (tool == null || tool.isEmpty()) {
            return error("Falta el campo 'tool'");
        }

        return switch (tool) {
            case "get_server_info" -> getServerInfo();
            case "get_players" -> {
                JsonObject wrapper = new JsonObject();
                wrapper.addProperty("success", true);
                wrapper.add("players", getPlayers());
                yield wrapper;
            }
            case "get_player" -> getPlayer(getString(arguments, "name"));
            case "locate_biome" -> locateBiome(getString(arguments, "biome"));
            case "locate_structure" -> locateStructure(getString(arguments, "structure"));
            case "get_weather" -> getWeatherTool();
            case "get_time" -> getTimeTool();
            case "get_spawn" -> getSpawnTool();
            case "execute_command" -> executeCommandTool(getString(arguments, "command"));
            default -> error("Herramienta desconocida: " + tool);
        };
    }

    private JsonObject getServerInfo() {
        World world = server.getOverworld();
        List<ServerPlayerEntity> online = server.getPlayerManager().getPlayerList();

        JsonObject info = new JsonObject();
        info.addProperty("onlinePlayers", online.size());
        info.addProperty("maxPlayers", server.getPlayerManager().getMaxPlayerCount());
        info.addProperty("difficulty", world.getDifficulty().name().toLowerCase());
        info.addProperty("weather", getWeather(world));
        info.addProperty("time", world.getTimeOfDay());
        info.addProperty("dimension", "overworld");
        return info;
    }

    private JsonArray getPlayers() {
        JsonArray players = new JsonArray();
        for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
            players.add(buildPlayerJson(player));
        }
        return players;
    }

    private JsonObject getPlayer(String name) {
        ServerPlayerEntity player = server.getPlayerManager().getPlayer(name);
        if (player == null) {
            JsonObject error = new JsonObject();
            error.addProperty("success", false);
            error.addProperty("error", "Jugador no encontrado");
            return error;
        }
        return buildPlayerJson(player);
    }

    private JsonObject buildPlayerJson(ServerPlayerEntity player) {
        JsonObject p = new JsonObject();
        p.addProperty("name", player.getName().getString());
        p.addProperty("x", Math.floor(player.getX()));
        p.addProperty("y", Math.floor(player.getY()));
        p.addProperty("z", Math.floor(player.getZ()));
        p.addProperty("dimension", getDimensionName(player.getWorld()));
        p.addProperty("health", player.getHealth());
        p.addProperty("food", player.getHungerManager().getFoodLevel());
        p.addProperty("gamemode", getGameModeName(player.interactionManager.getGameMode()));
        return p;
    }

    private JsonObject locateBiome(String biome) {
        if (biome == null || biome.isEmpty()) {
            return error("Falta el argumento 'biome'");
        }
        CommandExecutor.Result result = commandExecutor.execute("locate biome " + biome);
        return parseLocateResult(result);
    }

    private JsonObject locateStructure(String structure) {
        if (structure == null || structure.isEmpty()) {
            return error("Falta el argumento 'structure'");
        }
        CommandExecutor.Result result = commandExecutor.execute("locate structure " + structure);
        return parseLocateResult(result);
    }

    private JsonObject parseLocateResult(CommandExecutor.Result result) {
        if (!result.success) {
            return error(result.output);
        }

        Matcher matcher = LOCATE_PATTERN.matcher(result.output);
        if (!matcher.find()) {
            JsonObject response = new JsonObject();
            response.addProperty("success", false);
            response.addProperty("result", result.output);
            return response;
        }

        JsonObject location = new JsonObject();
        location.addProperty("x", Integer.parseInt(matcher.group(1)));
        location.addProperty("z", Integer.parseInt(matcher.group(2)));

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.add("location", location);
        return response;
    }

    private JsonObject getWeatherTool() {
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("weather", getWeather(server.getOverworld()));
        return response;
    }

    private JsonObject getTimeTool() {
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("time", server.getOverworld().getTimeOfDay());
        return response;
    }

    private JsonObject getSpawnTool() {
        JsonObject pos = new JsonObject();
        pos.addProperty("x", server.getOverworld().getSpawnPos().getX());
        pos.addProperty("y", server.getOverworld().getSpawnPos().getY());
        pos.addProperty("z", server.getOverworld().getSpawnPos().getZ());

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.add("location", pos);
        return response;
    }

    private JsonObject executeCommandTool(String command) {
        if (command == null || command.isEmpty()) {
            return error("Falta el argumento 'command'");
        }
        CommandExecutor.Result result = commandExecutor.execute(command);
        JsonObject response = new JsonObject();
        response.addProperty("success", result.success);
        response.addProperty("result", result.output);
        return response;
    }

    private String getWeather(World world) {
        if (world.isThundering()) {
            return "thunder";
        }
        return world.isRaining() ? "rain" : "clear";
    }

    private String getDimensionName(World world) {
        return world.getRegistryKey().getValue().toString();
    }

    private String getGameModeName(GameMode gameMode) {
        if (gameMode == null) {
            return "unknown";
        }
        return gameMode.getName().toLowerCase();
    }

    private JsonObject error(String message) {
        JsonObject error = new JsonObject();
        error.addProperty("success", false);
        error.addProperty("error", message);
        return error;
    }

    private String getString(JsonObject object, String key) {
        if (object == null || !object.has(key) || !object.get(key).isJsonPrimitive()) {
            return null;
        }
        return object.get(key).getAsString();
    }
}
