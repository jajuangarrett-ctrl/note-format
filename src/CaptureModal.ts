import { App, ButtonComponent, Modal, Notice, Setting, TFile } from "obsidian";
import { saveNote } from "./append";
import {
  formatSummaryNotes,
  formatTranscript,
  startRecording,
  transcribeWhisper,
  type VoiceRecorder,
} from "./transcribe";
import { fetchTranscriptFromUrl } from "./web";
import type { WebFetchSource } from "./webParse";
import type NoteFormatPlugin from "../main";

export class CaptureModal extends Modal {
  private plugin: NoteFormatPlugin;
  private text: string;
  private url: string;
  private fetchSource: WebFetchSource = "transcript";
  private contentSource: WebFetchSource = "transcript";

  private textArea: HTMLTextAreaElement | null = null;
  private urlInput: HTMLInputElement | null = null;
  private fetchButton: ButtonComponent | null = null;
  private recordButton: ButtonComponent | null = null;
  private pasteButton: ButtonComponent | null = null;
  private saveButton: ButtonComponent | null = null;
  private saveAnotherButton: ButtonComponent | null = null;
  private recorder: VoiceRecorder | null = null;
  private recording = false;
  private busy = false;

  constructor(app: App, plugin: NoteFormatPlugin, initialText = "", initialUrl = "") {
    super(app);
    this.plugin = plugin;
    this.text = initialText;
    this.url = initialUrl;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Format transcript" });

    new Setting(contentEl)
      .setName("Website transcript URL")
      .setDesc("Paste a Mira public transcript URL, then choose whether to fetch the raw transcript or the page's summarized notes into the text box. Save still uses this plugin's AI formatting instructions.")
      .addText((t) => {
        this.urlInput = t.inputEl;
        t.setPlaceholder("https://mira-staging-transcriptpublic.s3...")
          .setValue(this.url)
          .onChange((v) => {
            this.url = v;
          });
      })
      .addDropdown((d) => {
        d.addOption("transcript", "Transcript")
          .addOption("summary", "Summary")
          .setValue(this.fetchSource)
          .onChange((v) => {
            this.fetchSource = v === "summary" ? "summary" : "transcript";
            this.fetchButton?.setButtonText(this.fetchButtonText());
          });
      })
      .addButton((b) => {
        this.fetchButton = b;
        b.setButtonText(this.fetchButtonText()).onClick(() => this.fetchWebsiteTranscript());
      });

    new Setting(contentEl)
      .setName("Transcript")
      .setDesc("Paste a transcript, fetch from a website URL, tap Paste to drop in your clipboard, tap Record to dictate, or arrive here from the iOS share sheet (text/PDF). On Save, the format model reformats the content into operational meeting notes with topic sections, Discussion, Decisions, Open Questions, and an Action Items table, then writes it to AI Team/Formatted_Notes. Requires OpenAI API key.")
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

    if (this.url && !this.text) {
      setTimeout(() => this.fetchWebsiteTranscript(), 0);
    }

    setTimeout(() => this.textArea?.focus(), 0);
  }

  private async fetchWebsiteTranscript() {
    if (this.busy || !this.fetchButton) return;
    const url = this.url.trim();
    if (!url) {
      new Notice("Add a website URL first.");
      return;
    }

    this.busy = true;
    this.fetchButton.setDisabled(true);
    this.fetchButton.setButtonText("Fetching...");

    try {
      const fetchedText = await fetchTranscriptFromUrl(url, this.fetchSource);
      if (!fetchedText) {
        new Notice(`No ${this.fetchSourceLabel()} text found at that URL.`);
        return;
      }

      this.text = fetchedText;
      this.contentSource = this.fetchSource;
      if (this.textArea) {
        this.textArea.value = this.text;
        this.textArea.focus();
      }
      new Notice(`${this.fetchSourceLabel(true)} fetched.`);
    } catch (e) {
      new Notice(`Website ${this.fetchSourceLabel()} fetch failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.busy = false;
      if (this.fetchButton) {
        this.fetchButton.setDisabled(false);
        this.fetchButton.setButtonText(this.fetchButtonText());
      }
    }
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
    this.contentSource = "transcript";
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
      this.contentSource = "transcript";
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
    let raw = this.text.trim();
    if (!raw && this.url.trim()) {
      this.busy = true;
      this.setSaveButtonsDisabled(true);
      this.saveButton?.setButtonText(`Fetching ${this.fetchSourceLabel()}...`);

      try {
        const fetchedText = await fetchTranscriptFromUrl(this.url.trim(), this.fetchSource);
        if (!fetchedText) {
          new Notice(`No ${this.fetchSourceLabel()} text found at that URL.`);
          this.busy = false;
          this.setSaveButtonsDisabled(false);
          this.saveButton?.setButtonText("Save");
          return;
        }

        this.text = fetchedText;
        this.contentSource = this.fetchSource;
        raw = fetchedText.trim();
        if (this.textArea) {
          this.textArea.value = this.text;
        }
      } catch (e) {
        new Notice(`Website ${this.fetchSourceLabel()} fetch failed: ${e instanceof Error ? e.message : String(e)}`);
        this.busy = false;
        this.setSaveButtonsDisabled(false);
        this.saveButton?.setButtonText("Save");
        return;
      }
    }

    if (!raw) {
      new Notice("Add some text before saving.");
      return;
    }

    if (!this.busy) {
      this.busy = true;
      this.setSaveButtonsDisabled(true);
    }
    this.saveButton?.setButtonText("Formatting...");

    let finalText = raw;
    if (this.plugin.settings.openaiApiKey) {
      try {
        const formatter = this.contentSource === "summary"
          ? formatSummaryNotes
          : formatTranscript;
        finalText = await formatter(
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
    if (this.plugin.settings.openSavedFileAfterSave) {
      await this.openSavedFile(savedPath);
    }
    if (reopen) {
      setTimeout(() => new CaptureModal(this.app, this.plugin).open(), 200);
    }
  }

  private async openSavedFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private setSaveButtonsDisabled(disabled: boolean) {
    this.saveButton?.setDisabled(disabled);
    this.saveAnotherButton?.setDisabled(disabled);
    this.fetchButton?.setDisabled(disabled);
  }

  onClose() {
    if (this.recorder) {
      this.recorder.cancel();
      this.recorder = null;
    }
    this.contentEl.empty();
  }

  private fetchButtonText(): string {
    return this.fetchSource === "summary" ? "Fetch summary" : "Fetch transcript";
  }

  private fetchSourceLabel(sentenceStart = false): string {
    const label = this.fetchSource === "summary" ? "summary" : "transcript";
    return sentenceStart ? label.charAt(0).toUpperCase() + label.slice(1) : label;
  }
}

function mergeTranscript(existing: string, addition: string): string {
  const a = existing.trim();
  const b = addition.trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}
