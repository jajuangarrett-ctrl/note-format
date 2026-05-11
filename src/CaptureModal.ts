import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { saveNote } from "./append";
import {
  formatTranscript,
  startRecording,
  transcribeWhisper,
  type VoiceRecorder,
} from "./transcribe";
import type NoteFormatPlugin from "../main";

export class CaptureModal extends Modal {
  private plugin: NoteFormatPlugin;
  private text: string;

  private textArea: HTMLTextAreaElement | null = null;
  private recordButton: ButtonComponent | null = null;
  private pasteButton: ButtonComponent | null = null;
  private saveButton: ButtonComponent | null = null;
  private saveAnotherButton: ButtonComponent | null = null;
  private recorder: VoiceRecorder | null = null;
  private recording = false;
  private busy = false;

  constructor(app: App, plugin: NoteFormatPlugin, initialText = "") {
    super(app);
    this.plugin = plugin;
    this.text = initialText;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Format transcript" });

    new Setting(contentEl)
      .setName("Transcript")
      .setDesc("Paste a transcript, tap Paste to drop in your clipboard, tap Record to dictate, or arrive here from the iOS share sheet (text/PDF). On Save, the format model reformats the content into an analytical Markdown note (overview, H3 sections, optional tables, Conclusion, Keywords) and writes it to AI Team/Formatted_Notes. Requires OpenAI API key.")
      .addTextArea((t) => {
        this.textArea = t.inputEl;
        t.inputEl.rows = 10;
        t.inputEl.style.width = "100%";
        t.setValue(this.text);
        t.onChange((v) => {
          this.text = v;
        });
      });

    new Setting(contentEl)
      .setName("Quick capture")
      .addButton((b) => {
        this.pasteButton = b;
        b.setButtonText("Paste").onClick(() => this.pasteFromClipboard());
      })
      .addButton((b) => {
        this.recordButton = b;
        b.setButtonText("Record").onClick(() => this.toggleRecord());
      });

    new Setting(contentEl)
      .addButton((b) => {
        this.saveButton = b;
        b.setButtonText("Save")
          .setCta()
          .onClick(() => this.save(false));
      })
      .addButton((b) => {
        this.saveAnotherButton = b;
        b.setButtonText("Save & format another").onClick(() => this.save(true));
      });

    setTimeout(() => this.textArea?.focus(), 0);
  }

  private async pasteFromClipboard() {
    if (this.busy || !this.pasteButton) return;
    let clip: string;
    try {
      clip = await navigator.clipboard.readText();
    } catch (e) {
      new Notice(`Clipboard read failed: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const trimmed = (clip || "").trim();
    if (!trimmed) {
      new Notice("Clipboard is empty.");
      return;
    }
    this.text = mergeTranscript(this.text, trimmed);
    if (this.textArea) {
      this.textArea.value = this.text;
      this.textArea.focus();
    }
  }

  private async toggleRecord() {
    if (this.busy || !this.recordButton) return;

    if (!this.recording) {
      if (!this.plugin.settings.openaiApiKey) {
        new Notice("Add your OpenAI API key in plugin settings before recording.");
        return;
      }
      try {
        this.recorder = await startRecording();
        this.recording = true;
        this.recordButton.setButtonText("Stop");
        this.recordButton.setWarning();
      } catch (e) {
        new Notice(`Microphone error: ${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }

    this.recording = false;
    this.busy = true;
    this.recordButton.setDisabled(true);
    this.recordButton.removeCta();
    this.recordButton.setButtonText("Transcribing...");

    try {
      const audio = await this.recorder!.stop();
      const transcript = await transcribeWhisper(
        audio,
        this.plugin.settings.openaiApiKey
      );

      this.text = mergeTranscript(this.text, transcript);
      if (this.textArea) {
        this.textArea.value = this.text;
        this.textArea.focus();
      }
    } catch (e) {
      new Notice(`Voice capture failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.busy = false;
      this.recorder = null;
      if (this.recordButton) {
        this.recordButton.setDisabled(false);
        this.recordButton.setButtonText("Record");
      }
    }
  }

  private async save(forceAnother: boolean) {
    if (this.busy) {
      new Notice("Voice capture still running.");
      return;
    }
    const raw = this.text.trim();
    if (!raw) {
      new Notice("Add some text before saving.");
      return;
    }

    this.busy = true;
    this.setSaveButtonsDisabled(true);
    this.saveButton?.setButtonText("Formatting...");

    let finalText = raw;
    if (this.plugin.settings.openaiApiKey) {
      try {
        finalText = await formatTranscript(
          raw,
          this.plugin.settings.openaiApiKey,
          {
            acronyms: this.plugin.settings.customAcronyms,
            model: this.plugin.settings.formatModel,
          }
        );
      } catch (e) {
        new Notice(`Formatting failed, saving raw text: ${e instanceof Error ? e.message : String(e)}`);
        finalText = raw;
      }
    }

    let savedPath: string;
    try {
      savedPath = await saveNote(
        this.app,
        this.plugin.settings.inboxFolderPath,
        { text: finalText }
      );
    } catch (e) {
      new Notice(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      this.busy = false;
      this.setSaveButtonsDisabled(false);
      this.saveButton?.setButtonText("Save");
      return;
    }

    this.busy = false;
    new Notice(`Saved ${savedPath}`);

    const reopen = forceAnother || this.plugin.settings.showAnotherAfterSave;
    this.close();
    if (reopen) {
      setTimeout(() => new CaptureModal(this.app, this.plugin).open(), 200);
    }
  }

  private setSaveButtonsDisabled(disabled: boolean) {
    this.saveButton?.setDisabled(disabled);
    this.saveAnotherButton?.setDisabled(disabled);
  }

  onClose() {
    if (this.recorder) {
      this.recorder.cancel();
      this.recorder = null;
    }
    this.contentEl.empty();
  }
}

function mergeTranscript(existing: string, addition: string): string {
  const a = existing.trim();
  const b = addition.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}
