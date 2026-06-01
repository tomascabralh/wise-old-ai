package io.github.tomascabralh.wiseoldai;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Desktop;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import net.runelite.client.ui.ColorScheme;
import net.runelite.client.ui.PluginPanel;

/**
 * Sidebar status panel for the Wise Old AI exporter. It shows whether state is
 * being exported, for whom, when it last wrote, and where — plus buttons to open
 * or copy the state folder. It does not show AI advice: the model lives in the
 * MCP client (e.g. Claude Desktop), not in the plugin.
 */
class WiseOldAiPanel extends PluginPanel
{
	private static final Color GREEN = new Color(0x4c, 0xaf, 0x50);
	private static final SimpleDateFormat TIME = new SimpleDateFormat("HH:mm:ss");

	private final JLabel status = new JLabel();
	private final JLabel account = new JLabel();
	private final JLabel lastExport = new JLabel();
	private final JLabel slices = new JLabel();
	private final JLabel dir = new JLabel();
	private final JButton openButton = new JButton("Open state folder");
	private final JButton copyButton = new JButton("Copy folder path");

	private String stateDir = "";

	WiseOldAiPanel()
	{
		setLayout(new BorderLayout());
		setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

		JPanel body = new JPanel();
		body.setLayout(new BoxLayout(body, BoxLayout.Y_AXIS));

		JLabel title = new JLabel("Wise Old AI");
		title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
		title.setForeground(Color.WHITE);
		title.setAlignmentX(Component.LEFT_ALIGNMENT);

		JLabel subtitle = new JLabel("Account state exporter");
		subtitle.setForeground(ColorScheme.LIGHT_GRAY_COLOR);
		subtitle.setAlignmentX(Component.LEFT_ALIGNMENT);
		subtitle.setBorder(BorderFactory.createEmptyBorder(0, 0, 10, 0));

		for (JLabel l : new JLabel[]{status, account, lastExport, slices})
		{
			l.setAlignmentX(Component.LEFT_ALIGNMENT);
			l.setBorder(BorderFactory.createEmptyBorder(2, 0, 2, 0));
		}

		dir.setForeground(ColorScheme.LIGHT_GRAY_COLOR);
		dir.setAlignmentX(Component.LEFT_ALIGNMENT);
		dir.setBorder(BorderFactory.createEmptyBorder(8, 0, 8, 0));

		JPanel buttons = new JPanel(new GridLayout(2, 1, 0, 6));
		buttons.setAlignmentX(Component.LEFT_ALIGNMENT);
		buttons.setMaximumSize(new Dimension(Integer.MAX_VALUE, 64));
		openButton.addActionListener(e -> openFolder());
		copyButton.addActionListener(e -> copyPath());
		buttons.add(openButton);
		buttons.add(copyButton);

		body.add(title);
		body.add(subtitle);
		body.add(status);
		body.add(account);
		body.add(lastExport);
		body.add(slices);
		body.add(dir);
		body.add(buttons);

		add(body, BorderLayout.NORTH);

		update(false, null, 0L, 0, "");
	}

	/** Refresh the panel. Safe to call from any thread — marshals onto the EDT. */
	void update(boolean loggedIn, String username, long lastExportMs, int sliceCount, String stateDirPath)
	{
		javax.swing.SwingUtilities.invokeLater(() ->
		{
			this.stateDir = stateDirPath == null ? "" : stateDirPath;

			if (loggedIn)
			{
				status.setText("● Exporting live");
				status.setForeground(GREEN);
			}
			else
			{
				status.setText("○ Waiting for login");
				status.setForeground(ColorScheme.LIGHT_GRAY_COLOR);
			}

			account.setText("Account: " + (username == null || username.isEmpty() ? "—" : username));
			lastExport.setText("Last export: " + (lastExportMs > 0 ? TIME.format(new Date(lastExportMs)) : "—"));
			slices.setText("Files written: " + sliceCount + " / 5");
			dir.setText("<html><div style='width:190px'>Folder: " + this.stateDir + "</div></html>");

			boolean haveDir = !this.stateDir.isEmpty();
			openButton.setEnabled(haveDir);
			copyButton.setEnabled(haveDir);
		});
	}

	private void openFolder()
	{
		try
		{
			if (!stateDir.isEmpty() && Desktop.isDesktopSupported())
			{
				Desktop.getDesktop().open(new File(stateDir));
			}
		}
		catch (Exception ignored)
		{
			// Opening a file browser is best-effort.
		}
	}

	private void copyPath()
	{
		if (!stateDir.isEmpty())
		{
			Toolkit.getDefaultToolkit().getSystemClipboard()
				.setContents(new StringSelection(stateDir), null);
		}
	}
}
