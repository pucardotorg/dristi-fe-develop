"use client";

import * as React from "react";
import { AlignLeftIcon, BoldIcon, ItalicIcon, ListIcon, ListOrderedIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { translateText } from "@/i18n/translate-text";

type Command = "bold" | "italic" | "insertOrderedList" | "insertUnorderedList" | "justifyLeft";

const TOOLS: { cmd: Command; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { cmd: "bold", label: "richTextEditor_bold", icon: BoldIcon },
    { cmd: "italic", label: "richTextEditor_italic", icon: ItalicIcon },
    { cmd: "insertOrderedList", label: "richTextEditor_numberedList", icon: ListOrderedIcon },
    { cmd: "insertUnorderedList", label: "richTextEditor_bulletedList", icon: ListIcon },
    { cmd: "justifyLeft", label: "richTextEditor_alignLeft", icon: AlignLeftIcon },
  ];

/** What a caller can do to the text from outside it — a picker that is not in the box. */
export type RichTextEditorHandle = {
  /** Put `text` where the caret last was in the box, or at the end if it never was. */
  insertText: (text: string) => void;
};

/**
 * Small rich text editor for prayer / affidavit / other-details copy. Stores HTML.
 * Uses the browser's editing commands — enough for bold, italic and lists.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "richTextEditor_writeHere",
  ariaLabel,
  minHeightClassName = "min-h-40",
  className,
  id,
  toolbarEnd,
  handleRef,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  minHeightClassName?: string;
  className?: string;
  id?: string;
  /** Actions at the far end of the formatting strip. */
  toolbarEnd?: React.ReactNode;
  handleRef?: React.Ref<RichTextEditorHandle>;
}) {
  const tr = useTranslations();
  const ref = React.useRef<HTMLDivElement>(null);
  const lastValue = React.useRef<string>("");
  // The caret, kept while focus is away in a picker so an insert lands where it was.
  const caret = React.useRef<Range | null>(null);

  React.useEffect(() => {
    const keep = () => {
      const sel = document.getSelection();
      if (!sel?.rangeCount || !ref.current) return;
      const range = sel.getRangeAt(0);
      if (ref.current.contains(range.commonAncestorContainer)) caret.current = range.cloneRange();
    };
    document.addEventListener("selectionchange", keep);
    return () => document.removeEventListener("selectionchange", keep);
  }, []);

  // Only write into the DOM when the incoming value differs from what we last emitted,
  // so the caret is not reset on every keystroke.
  React.useEffect(() => {
    if (!ref.current) return;
    if (value !== lastValue.current) {
      ref.current.innerHTML = value || "";
      lastValue.current = value || "";
    }
  }, [value]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? "";
    lastValue.current = html;
    onChange(html);
  };

  const run = (cmd: Command) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  /** Put the caret back where it was in the box, or at the end if it never was. */
  const restoreCaret = () => {
    const box = ref.current;
    if (!box) return false;
    box.focus();
    const sel = document.getSelection();
    let range = caret.current;
    if (!range || !box.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
    }
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  };

  React.useImperativeHandle(handleRef, () => ({
    insertText(text: string) {
      if (!restoreCaret()) return;
      document.execCommand("insertText", false, text);
      emit();
    },
  }));

  const empty = !value || value === "<br>" || value === "<p></p>";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className,
      )}
    >
      {/* Five packed controls: the buttons stay 36px so the strip reads as chrome, and
          `after:-inset-1` grows each hit area to 44px. The gap is 8px so those boxes
          meet rather than overlap. */}
      <div
        role="toolbar"
        aria-label={tr("richTextEditor_textFormatting")}
        className="flex flex-wrap items-center gap-2 border-b border-hairline bg-surface-sunken px-2 py-1"
      >
        {TOOLS.map((t) => (
          <Button
            key={t.cmd}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={translateText(tr, t.label)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(t.cmd)}
            className="relative after:absolute after:-inset-1"
          >
            <t.icon className="size-4" aria-hidden />
          </Button>
        ))}
        {toolbarEnd ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            {toolbarEnd}
          </div>
        ) : null}
      </div>
      <div className="relative">
        {empty ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-4 top-3 text-body-compact text-muted-foreground"
          >
            {translateText(tr, placeholder)}
          </span>
        ) : null}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className={cn(
            "prose-p:my-2 px-4 py-3 text-body-compact leading-relaxed text-foreground outline-none [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc",
            minHeightClassName,
          )}
        />
      </div>
    </div>
  );
}
