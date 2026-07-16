package com.minebot.fabricbridge.bridge;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.minebot.fabricbridge.FabricBridgeMod;
import com.minebot.fabricbridge.command.CommandExecutor;
import com.minebot.fabricbridge.tick.ServerTickTracker;
import net.minecraft.entity.Entity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.RegistryKey;
import net.minecraft.scoreboard.Scoreboard;
import net.minecraft.scoreboard.ScoreboardObjective;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.sound.SoundEvent;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
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
            case "getServerInfo" -> getServerInfo();
            case "getPlayers" -> wrapArray("players", getPlayers());
            case "getPlayer" -> getPlayer(getString(arguments, "name"));
            case "getPlayerHealth" -> getPlayerHealth(getString(arguments, "name"));
            case "getPlayerPosition" -> getPlayerPosition(getString(arguments, "name"));
            case "getPlayerInventory" -> getPlayerInventory(getString(arguments, "name"));
            case "getPlayerEquipment" -> getPlayerEquipment(getString(arguments, "name"));
            case "getWorldInfo" -> getWorldInfo();
            case "getSpawn" -> getSpawn();
            case "getBedLocation" -> getBedLocation(getString(arguments, "name"));
            case "getNearbyPlayers" -> getNearbyPlayers(getString(arguments, "name"), getDouble(arguments, "radius", 50));
            case "getNearbyEntities" -> getNearbyEntities(getString(arguments, "name"), getDouble(arguments, "radius", 50));
            case "getScoreboard" -> getScoreboard();
            case "getBiome" -> getBiome(getString(arguments, "name"));
            case "locateBiome" -> locateBiome(getString(arguments, "biome"));
            case "locateStructure" -> locateStructure(getString(arguments, "structure"));
            case "sendChatMessage" -> sendChatMessage(getString(arguments, "text"));
            case "showTitle" -> showTitle(getString(arguments, "name"), getString(arguments, "title"), getString(arguments, "subtitle"));
            case "playSound" -> playSound(getString(arguments, "name"), getString(arguments, "sound"));
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
        info.addProperty("tps", round(ServerTickTracker.getInstance().getTps(), 2));
        info.addProperty("mspt", round(ServerTickTracker.getInstance().getMspt(), 2));
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
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }
        return buildPlayerJson(player);
    }

    private JsonObject getPlayerHealth(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        JsonObject health = new JsonObject();
        health.addProperty("success", true);
        health.addProperty("health", player.getHealth());
        health.addProperty("maxHealth", player.getMaxHealth());
        health.addProperty("food", player.getHungerManager().getFoodLevel());
        health.addProperty("saturation", player.getHungerManager().getSaturationLevel());
        health.addProperty("experience", player.experienceLevel);
        health.addProperty("experienceProgress", player.experienceProgress);
        health.addProperty("dead", player.isDead());
        return health;
    }

    private JsonObject getPlayerPosition(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        World world = player.getWorld();
        JsonObject pos = new JsonObject();
        pos.addProperty("success", true);
        pos.addProperty("name", player.getName().getString());
        pos.addProperty("x", Math.floor(player.getX()));
        pos.addProperty("y", Math.floor(player.getY()));
        pos.addProperty("z", Math.floor(player.getZ()));
        pos.addProperty("dimension", getDimensionName(world));
        pos.addProperty("biome", getBiomeName(world, player.getBlockPos()));
        return pos;
    }

    private JsonObject getPlayerInventory(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        JsonArray items = new JsonArray();
        for (ItemStack stack : player.getInventory().main) {
            if (!stack.isEmpty()) {
                items.add(serializeItem(stack));
            }
        }

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.add("inventory", items);
        return response;
    }

    private JsonObject getPlayerEquipment(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        JsonObject equipment = new JsonObject();
        equipment.addProperty("success", true);
        equipment.add("helmet", serializeItem(player.getInventory().getArmorStack(3)));
        equipment.add("chestplate", serializeItem(player.getInventory().getArmorStack(2)));
        equipment.add("leggings", serializeItem(player.getInventory().getArmorStack(1)));
        equipment.add("boots", serializeItem(player.getInventory().getArmorStack(0)));
        equipment.add("mainHand", serializeItem(player.getMainHandStack()));
        equipment.add("offHand", serializeItem(player.getOffHandStack()));
        return equipment;
    }

    private JsonObject getWorldInfo() {
        World world = server.getOverworld();

        JsonObject info = new JsonObject();
        info.addProperty("success", true);
        info.addProperty("time", world.getTimeOfDay());
        info.addProperty("weather", getWeather(world));
        info.addProperty("difficulty", world.getDifficulty().name().toLowerCase());
        info.addProperty("dimension", "overworld");
        info.addProperty("spawn", posToString(world.getSpawnPos()));
        info.addProperty("seed", String.valueOf(server.getOverworld().getSeed()));
        return info;
    }

    private JsonObject getSpawn() {
        BlockPos spawn = server.getOverworld().getSpawnPos();

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("x", spawn.getX());
        response.addProperty("y", spawn.getY());
        response.addProperty("z", spawn.getZ());
        return response;
    }

    private JsonObject getBedLocation(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        BlockPos bedPos = player.getSpawnPointPosition();
        RegistryKey<World> bedDim = player.getSpawnPointDimension();

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        if (bedPos != null) {
            response.addProperty("hasBed", true);
            response.addProperty("x", bedPos.getX());
            response.addProperty("y", bedPos.getY());
            response.addProperty("z", bedPos.getZ());
            response.addProperty("dimension", bedDim.getValue().toString());
        } else {
            response.addProperty("hasBed", false);
        }
        return response;
    }

    private JsonObject getNearbyPlayers(String name, double radius) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        Vec3d center = player.getPos();
        double radiusSq = radius * radius;

        JsonArray nearby = new JsonArray();
        for (ServerPlayerEntity other : server.getPlayerManager().getPlayerList()) {
            if (other.equals(player)) {
                continue;
            }
            if (other.getWorld().equals(player.getWorld()) && other.squaredDistanceTo(center) <= radiusSq) {
                JsonObject p = new JsonObject();
                p.addProperty("name", other.getName().getString());
                p.addProperty("distance", Math.sqrt(other.squaredDistanceTo(center)));
                nearby.add(p);
            }
        }

        return wrapArray("nearbyPlayers", nearby);
    }

    private JsonObject getNearbyEntities(String name, double radius) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        World world = player.getWorld();
        Vec3d center = player.getPos();
        Box box = Box.of(center, radius, radius, radius);

        JsonArray nearby = new JsonArray();
        for (Entity entity : world.getEntitiesByClass(Entity.class, box, e -> !e.equals(player))) {
            JsonObject e = new JsonObject();
            e.addProperty("type", entity.getType().getUntranslatedName());
            e.addProperty("name", entity.getName().getString());
            e.addProperty("distance", entity.distanceTo(player));
            nearby.add(e);
        }

        return wrapArray("nearbyEntities", nearby);
    }

    private JsonObject getScoreboard() {
        Scoreboard scoreboard = server.getScoreboard();

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        JsonArray objectives = new JsonArray();
        for (ScoreboardObjective objective : scoreboard.getObjectives()) {
            JsonObject obj = new JsonObject();
            obj.addProperty("name", objective.getName());
            obj.addProperty("displayName", objective.getDisplayName().getString());
            obj.addProperty("criteria", objective.getCriterion().getName());
            objectives.add(obj);
        }
        response.add("objectives", objectives);
        return response;
    }

    private JsonObject getBiome(String name) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        response.addProperty("biome", getBiomeName(player.getWorld(), player.getBlockPos()));
        return response;
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

    private JsonObject sendChatMessage(String text) {
        if (text == null || text.isEmpty()) {
            return error("Falta el argumento 'text'");
        }
        server.getPlayerManager().broadcast(Text.literal("[" + getBotName() + "] " + text), false);
        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        return response;
    }

    private JsonObject showTitle(String name, String title, String subtitle) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }
        if (title == null || title.isEmpty()) {
            return error("Falta el argumento 'title'");
        }

        // Nota: en 1.21.1 los paquetes de título varían; usamos el método del servidor
        // que envía el título directamente al jugador.
        player.sendMessage(Text.literal(title), true);
        if (subtitle != null && !subtitle.isEmpty()) {
            player.sendMessage(Text.literal(subtitle), true);
        }

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        return response;
    }

    private JsonObject playSound(String name, String sound) {
        ServerPlayerEntity player = findPlayer(name);
        if (player == null) {
            return playerNotFound(name);
        }
        if (sound == null || sound.isEmpty()) {
            return error("Falta el argumento 'sound'");
        }

        Identifier id = Identifier.tryParse(sound);
        if (id == null) {
            return error("Identificador de sonido inválido: " + sound);
        }

        SoundEvent soundEvent = SoundEvent.of(id);
        if (soundEvent == null) {
            return error("Sonido no encontrado: " + sound);
        }

        player.playSound(soundEvent, 1.0f, 1.0f);

        JsonObject response = new JsonObject();
        response.addProperty("success", true);
        return response;
    }

    private JsonObject buildPlayerJson(ServerPlayerEntity player) {
        JsonObject p = new JsonObject();
        p.addProperty("name", player.getName().getString());
        p.addProperty("x", Math.floor(player.getX()));
        p.addProperty("y", Math.floor(player.getY()));
        p.addProperty("z", Math.floor(player.getZ()));
        p.addProperty("dimension", getDimensionName(player.getWorld()));
        p.addProperty("biome", getBiomeName(player.getWorld(), player.getBlockPos()));
        p.addProperty("health", player.getHealth());
        p.addProperty("food", player.getHungerManager().getFoodLevel());
        p.addProperty("experience", player.experienceLevel);
        p.addProperty("gamemode", getGameModeName(player.interactionManager.getGameMode()));
        return p;
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

    private JsonObject serializeItem(ItemStack stack) {
        JsonObject item = new JsonObject();
        if (stack == null || stack.isEmpty()) {
            item.addProperty("empty", true);
            return item;
        }
        item.addProperty("empty", false);
        item.addProperty("name", stack.getName().getString());
        item.addProperty("count", stack.getCount());
        return item;
    }

    private ServerPlayerEntity findPlayer(String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        return server.getPlayerManager().getPlayer(name);
    }

    private JsonObject playerNotFound(String name) {
        JsonObject error = new JsonObject();
        error.addProperty("success", false);
        error.addProperty("error", "Jugador no encontrado: " + name);
        return error;
    }

    private JsonObject wrapArray(String key, JsonArray array) {
        JsonObject wrapper = new JsonObject();
        wrapper.addProperty("success", true);
        wrapper.add(key, array);
        return wrapper;
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

    private String getBiomeName(World world, BlockPos pos) {
        if (world == null || pos == null) {
            return "unknown";
        }
        return world.getBiome(pos).getKey()
                .map(key -> key.getValue().toString())
                .orElse("unknown");
    }

    private String getGameModeName(GameMode gameMode) {
        if (gameMode == null) {
            return "unknown";
        }
        return gameMode.getName().toLowerCase();
    }

    private String posToString(BlockPos pos) {
        return pos.getX() + ", " + pos.getY() + ", " + pos.getZ();
    }

    private double round(double value, int decimals) {
        double factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
    }

    private String getBotName() {
        String name = System.getenv("BOT_NAME");
        return name != null && !name.isEmpty() ? name : "SteveAI";
    }

    private String getString(JsonObject object, String key) {
        if (object == null || !object.has(key) || !object.get(key).isJsonPrimitive()) {
            return null;
        }
        return object.get(key).getAsString();
    }

    private double getDouble(JsonObject object, String key, double defaultValue) {
        if (object == null || !object.has(key) || !object.get(key).isJsonPrimitive()) {
            return defaultValue;
        }
        try {
            return object.get(key).getAsDouble();
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private JsonObject error(String message) {
        JsonObject error = new JsonObject();
        error.addProperty("success", false);
        error.addProperty("error", message);
        return error;
    }
}
