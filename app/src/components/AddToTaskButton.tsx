import { useState } from "react";
import type { Spark, TopicId, Task } from "../types";
import { usePlayer } from "../store/PlayerContext";

export function AddToTaskButton({ spark, topicId, levelId }: { spark: Spark; topicId: TopicId; levelId: string }) {
  const { addTask } = usePlayer();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState<Task | null>(null);

  const baseTask = (): Omit<Task, "id" | "createdAt" | "updatedAt" | "status"> => {
    if (spark.exercise.type === "buildcard") {
      return {
        kind: "build",
        title: spark.exercise.title,
        notes: spark.exercise.pitch,
        promptToCopy: spark.exercise.promptToCopy,
        source: { topicId, levelId, sparkId: spark.id },
      };
    }
    if (spark.exercise.type === "microread") {
      return {
        kind: "read",
        title: spark.exercise.title,
        notes: spark.exercise.takeaway,
        source: { topicId, levelId, sparkId: spark.id },
      };
    }
    if (spark.exercise.type === "tip") {
      return {
        kind: "explore",
        title: `Apply tip: ${spark.exercise.title}`,
        notes: spark.exercise.body,
        source: { topicId, levelId, sparkId: spark.id },
      };
    }
    return {
      kind: "explore",
      title: spark.title,
      source: { topicId, levelId, sparkId: spark.id },
    };
  };

  const onAdd = () => {
    const t = addTask(baseTask());
    setAdded(t);
    setOpen(false);
    setTimeout(() => setAdded(null), 2000);
  };

  return (
    <div className="relative">
      <button
        title="Add to Tasks"
        className="btn-ghost text-xs"
        onClick={onAdd}
      >
        ＋ Task
      </button>
      {added && (
        <div className="absolute right-0 top-10 z-30 card px-3 py-2 text-xs text-good whitespace-nowrap">
          ✓ Added to Tasks
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-10 z-30 card p-3 text-xs">
          Select task type
          <button onClick={onAdd} className="btn-primary w-full mt-2">Save</button>
        </div>
      )}
    </div>
  );
}
