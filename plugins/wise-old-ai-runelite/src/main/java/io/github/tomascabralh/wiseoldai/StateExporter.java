package io.github.tomascabralh.wiseoldai;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Writes state slices to disk. Pure string/file logic with no RuneLite dependency,
 * so it is unit-testable. Two guarantees:
 *   - hash-diff: a slice whose content is unchanged since the last write is skipped.
 *   - atomic write: content is written to {@code <slice>.json.tmp} then atomically
 *     renamed over {@code <slice>.json}, so readers never see a half-written file.
 * Disk I/O runs on a single daemon thread to keep the caller (the client thread) free.
 */
public class StateExporter
{
	private final Path stateDir;
	private final Map<String, String> lastHash = new HashMap<>();
	private final ExecutorService io = Executors.newSingleThreadExecutor(r ->
	{
		Thread t = new Thread(r, "wise-old-ai-exporter");
		t.setDaemon(true);
		return t;
	});

	public StateExporter(Path stateDir) throws IOException
	{
		this.stateDir = stateDir;
		Files.createDirectories(stateDir);
	}

	/**
	 * Schedule an atomic write of {@code json} to {@code <slice>.json} unless the content
	 * is byte-identical to the last write of this slice.
	 *
	 * @return true if a write was scheduled (content changed), false if skipped.
	 */
	public synchronized boolean write(String slice, String json)
	{
		String hash = sha256(json);
		if (hash.equals(lastHash.get(slice)))
		{
			return false;
		}
		lastHash.put(slice, hash);
		io.submit(() ->
		{
			try
			{
				writeAtomic(slice, json);
			}
			catch (IOException ignored)
			{
				// Never propagate to the client thread; a dropped frame is recoverable next tick.
			}
		});
		return true;
	}

	/** Synchronous atomic write. Package-visible for tests. */
	void writeAtomic(String slice, String json) throws IOException
	{
		Path target = stateDir.resolve(slice + ".json");
		Path tmp = stateDir.resolve(slice + ".json.tmp");
		Files.write(tmp, json.getBytes(StandardCharsets.UTF_8));
		try
		{
			Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
		}
		catch (AtomicMoveNotSupportedException e)
		{
			Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
		}
	}

	public void shutdown()
	{
		io.shutdown();
	}

	private static String sha256(String s)
	{
		try
		{
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
			StringBuilder sb = new StringBuilder(digest.length * 2);
			for (byte b : digest)
			{
				sb.append(String.format("%02x", b));
			}
			return sb.toString();
		}
		catch (Exception e)
		{
			return s; // Fallback: compare raw content if SHA-256 is somehow unavailable.
		}
	}
}
