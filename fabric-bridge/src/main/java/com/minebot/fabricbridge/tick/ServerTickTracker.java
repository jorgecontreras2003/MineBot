package com.minebot.fabricbridge.tick;

import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;

import java.util.concurrent.TimeUnit;

/**
 * Mide el tiempo por tick (MSPT) y los ticks por segundo (TPS) del servidor.
 */
public class ServerTickTracker {

    private static final long NANOS_PER_SECOND = 1_000_000_000L;
    private static final int SAMPLE_SIZE = 20;

    private static ServerTickTracker instance;

    private final long[] tickTimes = new long[SAMPLE_SIZE];
    private int index = 0;
    private long lastTickStart = 0;

    private ServerTickTracker() {
    }

    public static ServerTickTracker getInstance() {
        if (instance == null) {
            instance = new ServerTickTracker();
        }
        return instance;
    }

    public static void register() {
        ServerTickTracker tracker = getInstance();
        ServerTickEvents.START_SERVER_TICK.register(server -> tracker.onStartTick());
        ServerTickEvents.END_SERVER_TICK.register(server -> tracker.onEndTick());
    }

    private void onStartTick() {
        lastTickStart = System.nanoTime();
    }

    private void onEndTick() {
        long duration = System.nanoTime() - lastTickStart;
        tickTimes[index] = duration;
        index = (index + 1) % SAMPLE_SIZE;
    }

    /**
     * @return MSPT promedio de los últimos 20 ticks
     */
    public double getMspt() {
        long sum = 0;
        for (long time : tickTimes) {
            sum += time;
        }
        double avgNanos = sum / (double) SAMPLE_SIZE;
        return avgNanos / 1_000_000.0;
    }

    /**
     * @return TPS calculado a partir del MSPT, limitado a 20.0
     */
    public double getTps() {
        double mspt = getMspt();
        if (mspt <= 0) {
            return 20.0;
        }
        return Math.min(20.0, 1000.0 / mspt);
    }
}
