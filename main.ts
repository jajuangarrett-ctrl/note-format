import { Plugin } from "obsidian";
import {
  NoteFormatSettings,
  NoteFormatSettingTab,
  DEFAULT_SETTINGS,
} from "./src/settings";
import { CaptureModal } from "./src/CaptureModal";

export default class NoteFormatPlugin extends Plugin {
  settings: NoteFormatSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addRibbonIcon("file-text", "Format transcript", () => {
      new CaptureModal(this.app, this).open();
    });

    this.addCommand({
      id: "format",
      name: "Format transcript",
      callback: () => new CaptureModal(this.app, this).open(),
    });

    this.registerObsidianProtocolHandler("note-format", (params) => {
      const text = typeof params.text === "string" ? params.text : "";
      const url = typeof params.url === "string" ? params.url : "";
      new CaptureModal(this.app, this, text, url).open();
    });

    this.addSettingTab(new NoteFormatSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
