package io.github.tomascabralh.wiseoldai;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.inject.Provides;
import io.github.tomascabralh.wiseoldai.model.ActivitiesState;
import io.github.tomascabralh.wiseoldai.model.Advice;
import io.github.tomascabralh.wiseoldai.model.BankItem;
import io.github.tomascabralh.wiseoldai.model.BankState;
import io.github.tomascabralh.wiseoldai.model.DiaryTiers;
import io.github.tomascabralh.wiseoldai.model.EquipmentState;
import io.github.tomascabralh.wiseoldai.model.InventoryItem;
import io.github.tomascabralh.wiseoldai.model.InventoryState;
import io.github.tomascabralh.wiseoldai.model.LocationState;
import io.github.tomascabralh.wiseoldai.model.Metadata;
import io.github.tomascabralh.wiseoldai.model.PlayerState;
import io.github.tomascabralh.wiseoldai.model.QuestsState;
import io.github.tomascabralh.wiseoldai.model.SkillEntry;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
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
import net.runelite.api.Quest;
import net.runelite.api.Skill;
import net.runelite.api.VarPlayer;
import net.runelite.api.Varbits;
import net.runelite.api.coords.WorldPoint;
import net.runelite.api.events.GameStateChanged;
import net.runelite.api.events.GameTick;
import net.runelite.api.gameval.DBTableID;
import net.runelite.api.gameval.VarPlayerID;
import net.runelite.client.config.ConfigManager;
import net.runelite.client.eventbus.Subscribe;
import net.runelite.client.game.ItemManager;
import net.runelite.client.plugins.Plugin;
import net.runelite.client.plugins.PluginDescriptor;
import net.runelite.client.ui.ClientToolbar;
import net.runelite.client.ui.NavigationButton;
import net.runelite.client.util.ImageUtil;
import java.awt.image.BufferedImage;

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

	@Inject
	private ClientToolbar clientToolbar;

	// serializeNulls so empty equipment slots are written as `null`, not omitted.
	private final Gson gson = new GsonBuilder().serializeNulls().create();
	private final Map<String, String> updatedAt = new LinkedHashMap<>();

	private StateExporter exporter;
	private WiseOldAiPanel panel;
	private NavigationButton navButton;
	private Path stateDir;
	private long lastWriteMs;
	private long lastChangeMs;
	private long lastAdviceMtime;

	@Provides
	WiseOldAiConfig provideConfig(ConfigManager configManager)
	{
		return configManager.getConfig(WiseOldAiConfig.class);
	}

	@Override
	protected void startUp() throws Exception
	{
		stateDir = resolveStateDir();
		exporter = new StateExporter(stateDir);

		panel = new WiseOldAiPanel();
		panel.update(false, null, 0L, 0, stateDir.toString());
		BufferedImage icon = ImageUtil.loadImageResource(getClass(), "icon.png");
		navButton = NavigationButton.builder()
			.tooltip("Wise Old AI")
			.icon(icon)
			.priority(7)
			.panel(panel)
			.build();
		clientToolbar.addNavigation(navButton);

		log.info("Wise Old AI exporting state to {}", stateDir);
	}

	@Override
	protected void shutDown()
	{
		if (navButton != null)
		{
			clientToolbar.removeNavigation(navButton);
			navButton = null;
		}
		if (exporter != null)
		{
			exporter.shutdown();
			exporter = null;
		}
	}

	@Subscribe
	public void onGameStateChanged(GameStateChanged event)
	{
		if (panel != null && event.getGameState() != GameState.LOGGED_IN)
		{
			panel.update(false, null, lastChangeMs, updatedAt.size(),
				stateDir == null ? "" : stateDir.toString());
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
		changed |= exportSlice("quests", buildQuests());
		changed |= exportSlice("diaries", buildDiaries());
		changed |= exportSlice("activities", buildActivities());

		// Bank is only readable once the player has opened it this session.
		ItemContainer bank = client.getItemContainer(InventoryID.BANK);
		if (bank != null)
		{
			changed |= exportSlice("bank", buildBank(bank));
		}

		if (changed)
		{
			exportSlice("metadata", buildMetadata());
			lastChangeMs = now;
		}

		if (panel != null)
		{
			panel.update(true, local.getName(), lastChangeMs, updatedAt.size(), stateDir.toString());
		}

		refreshAdvice();
	}

	/** Pick up advice.json (written by the MCP client) and show it, re-reading only on change. */
	private void refreshAdvice()
	{
		if (panel == null || stateDir == null)
		{
			return;
		}
		Path file = stateDir.resolve("advice.json");
		try
		{
			if (!Files.exists(file))
			{
				return;
			}
			long mtime = Files.getLastModifiedTime(file).toMillis();
			if (mtime == lastAdviceMtime)
			{
				return;
			}
			lastAdviceMtime = mtime;

			Advice advice = gson.fromJson(new String(Files.readAllBytes(file), StandardCharsets.UTF_8), Advice.class);
			if (advice != null && advice.body != null)
			{
				long created = 0L;
				try
				{
					created = Instant.parse(advice.createdAt).toEpochMilli();
				}
				catch (Exception ignored)
				{
					// Leave created at 0 if the timestamp is missing/unparseable.
				}
				panel.setAdvice(advice.title, advice.body, created);
			}
		}
		catch (Exception ignored)
		{
			// Advice is best-effort; never disrupt the game thread.
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

	private QuestsState buildQuests()
	{
		QuestsState q = new QuestsState();
		q.questPoints = client.getVarpValue(VarPlayer.QUEST_POINTS);
		for (Quest quest : Quest.values())
		{
			try
			{
				q.quests.put(quest.getName(), quest.getState(client).name());
			}
			catch (Exception ignored)
			{
				// A quest whose varbits aren't loaded yet is simply skipped this tick.
			}
		}
		return q;
	}

	private Map<String, DiaryTiers> buildDiaries()
	{
		Map<String, DiaryTiers> d = new LinkedHashMap<>();
		addDiary(d, "ardougne", Varbits.DIARY_ARDOUGNE_EASY, Varbits.DIARY_ARDOUGNE_MEDIUM, Varbits.DIARY_ARDOUGNE_HARD, Varbits.DIARY_ARDOUGNE_ELITE);
		addDiary(d, "desert", Varbits.DIARY_DESERT_EASY, Varbits.DIARY_DESERT_MEDIUM, Varbits.DIARY_DESERT_HARD, Varbits.DIARY_DESERT_ELITE);
		addDiary(d, "falador", Varbits.DIARY_FALADOR_EASY, Varbits.DIARY_FALADOR_MEDIUM, Varbits.DIARY_FALADOR_HARD, Varbits.DIARY_FALADOR_ELITE);
		addDiary(d, "fremennik", Varbits.DIARY_FREMENNIK_EASY, Varbits.DIARY_FREMENNIK_MEDIUM, Varbits.DIARY_FREMENNIK_HARD, Varbits.DIARY_FREMENNIK_ELITE);
		addDiary(d, "kandarin", Varbits.DIARY_KANDARIN_EASY, Varbits.DIARY_KANDARIN_MEDIUM, Varbits.DIARY_KANDARIN_HARD, Varbits.DIARY_KANDARIN_ELITE);
		addDiary(d, "karamja", Varbits.DIARY_KARAMJA_EASY, Varbits.DIARY_KARAMJA_MEDIUM, Varbits.DIARY_KARAMJA_HARD, Varbits.DIARY_KARAMJA_ELITE);
		addDiary(d, "kourend", Varbits.DIARY_KOUREND_EASY, Varbits.DIARY_KOUREND_MEDIUM, Varbits.DIARY_KOUREND_HARD, Varbits.DIARY_KOUREND_ELITE);
		addDiary(d, "lumbridge", Varbits.DIARY_LUMBRIDGE_EASY, Varbits.DIARY_LUMBRIDGE_MEDIUM, Varbits.DIARY_LUMBRIDGE_HARD, Varbits.DIARY_LUMBRIDGE_ELITE);
		addDiary(d, "morytania", Varbits.DIARY_MORYTANIA_EASY, Varbits.DIARY_MORYTANIA_MEDIUM, Varbits.DIARY_MORYTANIA_HARD, Varbits.DIARY_MORYTANIA_ELITE);
		addDiary(d, "varrock", Varbits.DIARY_VARROCK_EASY, Varbits.DIARY_VARROCK_MEDIUM, Varbits.DIARY_VARROCK_HARD, Varbits.DIARY_VARROCK_ELITE);
		addDiary(d, "western", Varbits.DIARY_WESTERN_EASY, Varbits.DIARY_WESTERN_MEDIUM, Varbits.DIARY_WESTERN_HARD, Varbits.DIARY_WESTERN_ELITE);
		addDiary(d, "wilderness", Varbits.DIARY_WILDERNESS_EASY, Varbits.DIARY_WILDERNESS_MEDIUM, Varbits.DIARY_WILDERNESS_HARD, Varbits.DIARY_WILDERNESS_ELITE);
		return d;
	}

	private void addDiary(Map<String, DiaryTiers> map, String area, int easy, int medium, int hard, int elite)
	{
		DiaryTiers t = new DiaryTiers();
		t.easy = client.getVarbitValue(easy) > 0;
		t.medium = client.getVarbitValue(medium) > 0;
		t.hard = client.getVarbitValue(hard) > 0;
		t.elite = client.getVarbitValue(elite) > 0;
		map.put(area, t);
	}

	private BankState buildBank(ItemContainer container)
	{
		BankState b = new BankState();
		long total = 0;
		for (Item item : container.getItems())
		{
			if (item.getId() < 0 || item.getQuantity() <= 0)
			{
				continue;
			}
			int price = itemManager.getItemPrice(item.getId());
			String name = itemManager.getItemComposition(item.getId()).getName();
			b.items.add(new BankItem(item.getId(), name, item.getQuantity(), price));
			total += (long) price * item.getQuantity();
		}
		b.geValue = total;
		return b;
	}

	private ActivitiesState buildActivities()
	{
		ActivitiesState a = new ActivitiesState();
		a.slayer.taskAmountRemaining = client.getVarpValue(VarPlayer.SLAYER_TASK_SIZE);
		a.slayer.points = client.getVarbitValue(Varbits.SLAYER_POINTS);
		a.slayer.streak = client.getVarbitValue(Varbits.SLAYER_TASK_STREAK);
		a.slayer.bossTask = client.getVarbitValue(Varbits.SLAYER_TASK_BOSS) > 0;
		// Resolve the task's monster name from the game's own DB table — works on login,
		// no chat needed. taskLocation isn't derived from the DB, so it stays null.
		a.slayer.taskName = lookupSlayerTaskName(client.getVarpValue(VarPlayerID.SLAYER_TARGET));
		a.slayer.taskLocation = null;
		return a;
	}

	private Metadata buildMetadata()
	{
		Metadata m = new Metadata();
		m.schemaVersion = 1;
		m.updatedAt = new LinkedHashMap<>(updatedAt);
		return m;
	}

	/**
	 * Resolve the Slayer task's monster name from the game's SlayerTask DB table.
	 * Returns null when there's no task or the lookup fails. Runs on the client thread.
	 */
	private String lookupSlayerTaskName(int taskId)
	{
		if (taskId <= 0)
		{
			return null;
		}
		try
		{
			List<Integer> rows = client.getDBRowsByValue(
				DBTableID.SlayerTask.ID, DBTableID.SlayerTask.COL_ID, 0, taskId);
			if (rows == null || rows.isEmpty())
			{
				return null;
			}
			Object[] field = client.getDBTableField(rows.get(0), DBTableID.SlayerTask.COL_NAME_LOWERCASE, 0);
			if (field == null || field.length == 0 || field[0] == null)
			{
				return null;
			}
			return capitalize(field[0].toString());
		}
		catch (Exception e)
		{
			return null;
		}
	}

	private static String capitalize(String s)
	{
		return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
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
