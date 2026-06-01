package io.github.tomascabralh.wiseoldai;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.inject.Provides;
import io.github.tomascabralh.wiseoldai.model.EquipmentState;
import io.github.tomascabralh.wiseoldai.model.InventoryItem;
import io.github.tomascabralh.wiseoldai.model.InventoryState;
import io.github.tomascabralh.wiseoldai.model.LocationState;
import io.github.tomascabralh.wiseoldai.model.Metadata;
import io.github.tomascabralh.wiseoldai.model.PlayerState;
import io.github.tomascabralh.wiseoldai.model.SkillEntry;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.inject.Inject;
import lombok.extern.slf4j.Slf4j;
import net.runelite.api.Client;
import net.runelite.api.EquipmentInventorySlot;
import net.runelite.api.GameState;
import net.runelite.api.InventoryID;
import net.runelite.api.Item;
import net.runelite.api.ItemContainer;
import net.runelite.api.Player;
import net.runelite.api.Skill;
import net.runelite.api.coords.WorldPoint;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.api.events.GameTick;
import net.runelite.client.game.ItemManager;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;

@Slf4j
@PluginDescriptor(
	name = "Wise Old AI",
	description = "Exports read-only account state for the Wise Old AI advisor.",
	tags = {"account", "export", "ai", "advisor"}
)
public class WiseOldAiPlugin extends Plugin
{
	@Inject
	private Client client;

	@Inject
	private ItemManager itemManager;

	@Inject
	private WiseOldAiConfig config;

	// serializeNulls so empty equipment slots are written as `null`, not omitted.
	private final Gson gson = new GsonBuilder().serializeNulls().create();
	private final Map<String, String> updatedAt = new LinkedHashMap<>();

	private StateExporter exporter;
	private long lastWriteMs;

	@Provides
	WiseOldAiConfig provideConfig(ConfigManager configManager)
	{
		return configManager.getConfig(WiseOldAiConfig.class);
	}

	@Override
	protected void startUp() throws Exception
	{
		Path dir = resolveStateDir();
		exporter = new StateExporter(dir);
		log.info("Wise Old AI exporting state to {}", dir);
	}

	@Override
	protected void shutDown()
	{
		if (exporter != null)
		{
			exporter.shutdown();
			exporter = null;
		}
	}

	@Subscribe
	public void onGameTick(GameTick tick)
	{
		if (exporter == null || client.getGameState() != GameState.LOGGED_IN)
		{
			return;
		}
		Player local = client.getLocalPlayer();
		if (local == null)
		{
			return;
		}

		long now = System.currentTimeMillis();
		if (now - lastWriteMs < config.minWriteIntervalMs())
		{
			return;
		}
		lastWriteMs = now;

		boolean changed = false;
		changed |= exportSlice("player", buildPlayer(local));
		changed |= exportSlice("skills", buildSkills());
		changed |= exportSlice("inventory", buildInventory());
		changed |= exportSlice("equipment", buildEquipment());
		changed |= exportSlice("location", buildLocation(local));

		if (changed)
		{
			exportSlice("metadata", buildMetadata());
		}
	}

	private boolean exportSlice(String slice, Object dto)
	{
		boolean wrote = exporter.write(slice, gson.toJson(dto));
		if (wrote && !"metadata".equals(slice))
		{
			updatedAt.put(slice, Instant.now().toString());
		}
		return wrote;
	}

	private PlayerState buildPlayer(Player local)
	{
		PlayerState p = new PlayerState();
		p.username = local.getName();
		p.combatLevel = local.getCombatLevel();
		p.totalLevel = client.getTotalLevel();
		p.world = client.getWorld();

		PlayerState.Hitpoints hp = new PlayerState.Hitpoints();
		hp.current = client.getBoostedSkillLevel(Skill.HITPOINTS);
		hp.max = client.getRealSkillLevel(Skill.HITPOINTS);
		p.hitpoints = hp;

		p.prayer = client.getBoostedSkillLevel(Skill.PRAYER);

		// getEnergy() is 0-10000 in current API (0-100 in older clients); normalize to a 0-100 percent.
		int energy = client.getEnergy();
		p.runEnergy = energy > 100 ? energy / 100 : energy;
		return p;
	}

	private Map<String, SkillEntry> buildSkills()
	{
		Map<String, SkillEntry> skills = new LinkedHashMap<>();
		for (Skill skill : Skill.values())
		{
			if ("OVERALL".equals(skill.name()))
			{
				continue;
			}
			skills.put(
				skill.name().toLowerCase(),
				new SkillEntry(
					client.getRealSkillLevel(skill),
					client.getBoostedSkillLevel(skill),
					client.getSkillExperience(skill)
				)
			);
		}
		return skills;
	}

	private InventoryState buildInventory()
	{
		InventoryState inv = new InventoryState();
		ItemContainer container = client.getItemContainer(InventoryID.INVENTORY);
		if (container != null)
		{
			for (Item item : container.getItems())
			{
				if (item.getId() < 0 || item.getQuantity() <= 0)
				{
					continue;
				}
				inv.items.add(toItem(item));
			}
		}
		return inv;
	}

	private EquipmentState buildEquipment()
	{
		EquipmentState eq = new EquipmentState();
		ItemContainer container = client.getItemContainer(InventoryID.EQUIPMENT);
		if (container == null)
		{
			return eq;
		}
		eq.helm = slot(container, EquipmentInventorySlot.HEAD);
		eq.cape = slot(container, EquipmentInventorySlot.CAPE);
		eq.amulet = slot(container, EquipmentInventorySlot.AMULET);
		eq.weapon = slot(container, EquipmentInventorySlot.WEAPON);
		eq.body = slot(container, EquipmentInventorySlot.BODY);
		eq.shield = slot(container, EquipmentInventorySlot.SHIELD);
		eq.legs = slot(container, EquipmentInventorySlot.LEGS);
		eq.gloves = slot(container, EquipmentInventorySlot.GLOVES);
		eq.boots = slot(container, EquipmentInventorySlot.BOOTS);
		eq.ring = slot(container, EquipmentInventorySlot.RING);
		eq.ammo = slot(container, EquipmentInventorySlot.AMMO);
		return eq;
	}

	private InventoryItem slot(ItemContainer container, EquipmentInventorySlot slot)
	{
		Item item = container.getItem(slot.getSlotIdx());
		if (item == null || item.getId() < 0 || item.getQuantity() <= 0)
		{
			return null;
		}
		return toItem(item);
	}

	private InventoryItem toItem(Item item)
	{
		String name = itemManager.getItemComposition(item.getId()).getName();
		return new InventoryItem(item.getId(), name, item.getQuantity());
	}

	private LocationState buildLocation(Player local)
	{
		LocationState loc = new LocationState();
		WorldPoint wp = local.getWorldLocation();
		if (wp != null)
		{
			loc.x = wp.getX();
			loc.y = wp.getY();
			loc.plane = wp.getPlane();
			loc.regionId = wp.getRegionID();
		}
		return loc;
	}

	private Metadata buildMetadata()
	{
		Metadata m = new Metadata();
		m.schemaVersion = 1;
		m.updatedAt = new LinkedHashMap<>(updatedAt);
		return m;
	}

	private Path resolveStateDir()
	{
		String override = config.stateDir();
		if (override != null && !override.trim().isEmpty())
		{
			return Paths.get(override.trim());
		}
		return Paths.get(System.getProperty("user.home"), ".wise-old-ai", "state");
	}
}
