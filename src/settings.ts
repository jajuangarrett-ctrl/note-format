import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteFormatPlugin from "../main";

export interface NoteFormatSettings {
  openaiApiKey: string;
  inboxFolderPath: string;
  showAnotherAfterSave: boolean;
  customAcronyms: string;
}

export const DEFAULT_SETTINGS: NoteFormatSettings = {
  openaiApiKey: "",
  inboxFolderPath: "AI Team/Formatted_Notes",
  showAnotherAfterSave: false,
  customAcronyms: "CalWORKs, VPSS, FJG",
};

export class NoteFormatSettingTab extends PluginSettingTab {
  plugin: NoteFormatPlugin;

  constructor(app: App, plugin: NoteFormatPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Note Format" });

    new Setting(containerEl)
      .setName("Inbox folder path")
      .setDesc("Folder where each formatted note is saved as its own file (relative to vault root).")
      .addText((t) =>
        t
          .setPlaceholder("AI Team/Formatted_Notes")
          .setValue(this.plugin.settings.inboxFolderPath)
          .onChange(async (v) => {
            this.plugin.settings.inboxFolderPath = v.trim() || DEFAULT_SETTINGS.inboxFolderPath;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show another after save")
      .setDesc("After saving a note, immediately reopen the capture modal.")
      .addToggle((t) =>
        t.setValue(this.plugin.settings.showAnotherAfterSave).onChange(async (v) => {
          this.plugin.settings.showAnotherAfterSave = v;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("h3", { text: "OpenAI" });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Used by Whisper for voice transcription AND by GPT-4o to reformat the transcript on save. Required for both. Stored locally in plugin data.")
      .addText((t) => {
        t.inputEl.type = "password";
        t
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (v) => {
            this.plugin.settings.openaiApiKey = v.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Custom acronyms")
      .setDesc("Comma-separated acronyms and proper nouns the formatting pass should preserve verbatim.")
      .addText((t) =>
        t
          .setPlaceholder("CalWORKs, VPSS, FJG")
          .setValue(this.plugin.settings.customAcronyms)
          .onChange(async (v) => {
            this.plugin.settings.customAcronyms = v;
            await this.plugin.saveSettings();
          })
      );
  }
}
