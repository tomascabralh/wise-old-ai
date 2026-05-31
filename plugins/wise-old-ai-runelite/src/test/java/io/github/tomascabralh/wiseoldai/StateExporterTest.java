package io.github.tomascabralh.wiseoldai;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class StateExporterTest
{
	@Rule
	public TemporaryFolder folder = new TemporaryFolder();

	@Test
	public void writesContentAtomically() throws Exception
	{
		StateExporter exporter = new StateExporter(folder.getRoot().toPath());
		exporter.writeAtomic("skills", "{\"a\":1}");

		Path file = folder.getRoot().toPath().resolve("skills.json");
		assertTrue(Files.exists(file));
		assertEquals("{\"a\":1}", new String(Files.readAllBytes(file), StandardCharsets.UTF_8));
	}

	@Test
	public void leavesNoTempFileBehind() throws Exception
	{
		StateExporter exporter = new StateExporter(folder.getRoot().toPath());
		exporter.writeAtomic("player", "{}");
		assertFalse(Files.exists(folder.getRoot().toPath().resolve("player.json.tmp")));
	}

	@Test
	public void skipsUnchangedContentButWritesChanges() throws Exception
	{
		StateExporter exporter = new StateExporter(folder.getRoot().toPath());
		assertTrue("first write of new content", exporter.write("location", "{\"x\":1}"));
		assertFalse("identical content is skipped", exporter.write("location", "{\"x\":1}"));
		assertTrue("changed content writes again", exporter.write("location", "{\"x\":2}"));
		exporter.shutdown();
	}
}
