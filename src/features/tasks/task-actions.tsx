"use client";
import { useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import type { ClientTask } from "./use-tasks";
import type { Board } from "./day-board";

export function DeleteButton({
  task,
  board,
}: {
  task: ClientTask;
  board: Board;
}) {
  const t = useTranslations("tasks");
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon btn-sm board-delete"
      onClick={() => board.deleteTasks([task])}
      aria-label={t("board.deleteLabel", { title: task.title })}
      title={t("board.delete")}
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}

export function CheckButton({
  task,
  board,
  large,
}: {
  task: ClientTask;
  board: Board;
  large?: boolean;
}) {
  const t = useTranslations("tasks");
  const done = task.status === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={t("markDone", { title: task.title })}
      className={`board-check${done ? " is-done" : ""}${large ? " is-large" : ""}`}
      onClick={() => void board.setDone(task, !done)}
    >
      {done && (
        <Check size={large ? 16 : 13} strokeWidth={3} aria-hidden="true" />
      )}
    </button>
  );
}
