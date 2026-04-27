import type { Level, Spark, TopicId, Exercise } from "../types";

let _id = 0;
const sid = (prefix: string) => `${prefix}-${++_id}`;

export function spark(title: string, exercise: Exercise): Spark {
  return { id: sid("s"), title, exercise };
}

export function level(
  topic: TopicId,
  index: number,
  title: string,
  goal: string,
  estMinutes: number,
  sparks: Spark[]
): Level {
  return {
    id: `${topic}-l${index}`,
    index,
    title,
    goal,
    estMinutes,
    sparks,
  };
}
